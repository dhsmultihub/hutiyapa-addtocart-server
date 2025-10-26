import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  NotificationPreferences,
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  CreateNotificationRequest,
  NotificationResponse,
  NotificationListResponse,
  NotificationSearchFilters,
  NotificationAnalytics,
  NotificationTemplate,
  NotificationDelivery,
  NotificationContent
} from '../types/events.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create and send notification
   */
  async createNotification(request: CreateNotificationRequest): Promise<NotificationResponse> {
    try {
      this.logger.log(`Creating notification for user: ${request.userId}`);

      // Validate request
      const validation = await this.validateNotificationRequest(request);
      if (!validation.isValid) {
        throw new BadRequestException(`Invalid notification request: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Check user notification preferences
      const preferences = await this.getUserNotificationPreferences(request.userId);
      if (!this.shouldSendNotification(request, preferences)) {
        this.logger.log(`Notification blocked by user preferences for user: ${request.userId}`);
        return null;
      }

      // Create notification
      const notificationId = uuidv4();
      const now = new Date();

      const notification = {
        id: notificationId,
        userId: request.userId,
        type: request.type,
        channel: request.channel,
        priority: request.priority,
        status: NotificationStatus.PENDING,
        content: request.content,
        scheduledAt: request.scheduledAt || now,
        metadata: request.metadata,
        createdAt: now,
        updatedAt: now
      };

      // Save to database
      await this.databaseService.notification.create({
        data: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          channel: notification.channel,
          priority: notification.priority,
          status: notification.status,
          content: notification.content,
          scheduledAt: notification.scheduledAt,
          metadata: notification.metadata,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt
        }
      });

      // Send notification
      await this.sendNotification(notification);

      this.logger.log(`Notification created and sent: ${notificationId}`);
      return this.mapNotificationToResponse(notification);

    } catch (error) {
      this.logger.error('Notification creation failed:', error.message);
      throw new BadRequestException(`Notification creation failed: ${error.message}`);
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(notificationId: string): Promise<NotificationResponse> {
    try {
      const notification = await this.databaseService.notification.findUnique({
        where: { id: notificationId }
      });

      if (!notification) {
        throw new NotFoundException(`Notification with ID ${notificationId} not found`);
      }

      return this.mapNotificationToResponse(notification);

    } catch (error) {
      this.logger.error('Notification retrieval failed:', error.message);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string, 
    filters: NotificationSearchFilters = {}
  ): Promise<NotificationListResponse> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.channel) {
        where.channel = filters.channel;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
      }

      const [notifications, total] = await Promise.all([
        this.databaseService.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder }
        }),
        this.databaseService.notification.count({ where })
      ]);

      return {
        notifications: notifications.map(notification => this.mapNotificationToResponse(notification)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      this.logger.error('User notifications retrieval failed:', error.message);
      throw new BadRequestException(`User notifications retrieval failed: ${error.message}`);
    }
  }

  /**
   * Search notifications
   */
  async searchNotifications(filters: NotificationSearchFilters): Promise<NotificationListResponse> {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.channel) {
        where.channel = filters.channel;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
      }

      const [notifications, total] = await Promise.all([
        this.databaseService.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder }
        }),
        this.databaseService.notification.count({ where })
      ]);

      return {
        notifications: notifications.map(notification => this.mapNotificationToResponse(notification)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      this.logger.error('Notification search failed:', error.message);
      throw new BadRequestException(`Notification search failed: ${error.message}`);
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(
    notificationId: string, 
    status: NotificationStatus,
    metadata?: Record<string, any>
  ): Promise<NotificationResponse> {
    try {
      const notification = await this.databaseService.notification.update({
        where: { id: notificationId },
        data: {
          status,
          updatedAt: new Date(),
          metadata: {
            ...metadata,
            statusUpdatedAt: new Date()
          }
        }
      });

      this.logger.log(`Notification status updated: ${notificationId} -> ${status}`);
      return this.mapNotificationToResponse(notification);

    } catch (error) {
      this.logger.error('Notification status update failed:', error.message);
      throw new BadRequestException(`Notification status update failed: ${error.message}`);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.databaseService.notification.update({
        where: { 
          id: notificationId,
          userId 
        },
        data: {
          status: NotificationStatus.DELIVERED,
          updatedAt: new Date(),
          metadata: {
            readAt: new Date()
          }
        }
      });

      this.logger.log(`Notification marked as read: ${notificationId}`);

    } catch (error) {
      this.logger.error('Notification read marking failed:', error.message);
    }
  }

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(dateFrom?: Date, dateTo?: Date): Promise<NotificationAnalytics> {
    try {
      const where: any = {};

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = dateFrom;
        if (dateTo) where.createdAt.lte = dateTo;
      }

      const [
        totalSent,
        totalDelivered,
        totalFailed,
        byChannel,
        byType,
        byStatus
      ] = await Promise.all([
        this.databaseService.notification.count({ where }),
        this.databaseService.notification.count({ 
          where: { ...where, status: NotificationStatus.DELIVERED } 
        }),
        this.databaseService.notification.count({ 
          where: { ...where, status: NotificationStatus.FAILED } 
        }),
        this.databaseService.notification.groupBy({
          by: ['channel'],
          where,
          _count: { channel: true }
        }),
        this.databaseService.notification.groupBy({
          by: ['type'],
          where,
          _count: { type: true }
        }),
        this.databaseService.notification.groupBy({
          by: ['status'],
          where,
          _count: { status: true }
        })
      ]);

      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

      return {
        totalSent,
        totalDelivered,
        totalFailed,
        deliveryRate,
        byChannel: this.mapGroupByToRecord(byChannel, 'channel'),
        byType: this.mapGroupByToRecord(byType, 'type'),
        byStatus: this.mapGroupByToRecord(byStatus, 'status'),
        averageDeliveryTime: 0, // Would be calculated from delivery data
        topUsers: [], // Would be calculated from user data
        trends: [] // Would be calculated from time series data
      };

    } catch (error) {
      this.logger.error('Notification analytics retrieval failed:', error.message);
      throw new BadRequestException(`Notification analytics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: any): Promise<void> {
    try {
      // Update status to sent
      await this.databaseService.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Simulate delivery (in real implementation, this would call external services)
      setTimeout(async () => {
        await this.databaseService.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.DELIVERED,
            deliveredAt: new Date(),
            updatedAt: new Date()
          }
        });
      }, 1000);

      this.logger.log(`Notification sent: ${notification.id}`);

    } catch (error) {
      this.logger.error('Notification sending failed:', error.message);
      
      // Update status to failed
      await this.databaseService.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          failedAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            ...notification.metadata,
            error: error.message
          }
        }
      });
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const preferences = await this.databaseService.notificationPreferences.findUnique({
        where: { userId }
      });

      return preferences as NotificationPreferences;

    } catch (error) {
      this.logger.error('Notification preferences retrieval failed:', error.message);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const updatedPreferences = await this.databaseService.notificationPreferences.upsert({
        where: { userId },
        update: {
          ...preferences,
          updatedAt: new Date()
        },
        create: {
          id: uuidv4(),
          userId,
          channels: preferences.channels || {
            email: true,
            push: true,
            sms: false,
            inApp: true,
            webhook: false
          },
          types: preferences.types || {
            cartReminder: true,
            priceDrop: true,
            stockAlert: true,
            promotion: true,
            orderUpdate: true,
            shippingUpdate: true,
            paymentConfirmation: true,
            cartAbandonment: true,
            productDiscontinued: true,
            systemAlert: true
          },
          frequency: preferences.frequency || {
            immediate: true,
            daily: false,
            weekly: false,
            monthly: false,
            custom: { enabled: false, interval: 24 }
          },
          quietHours: preferences.quietHours || {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            days: [0, 1, 2, 3, 4, 5, 6]
          },
          isActive: preferences.isActive !== undefined ? preferences.isActive : true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.log(`Notification preferences updated for user: ${userId}`);
      return updatedPreferences as NotificationPreferences;

    } catch (error) {
      this.logger.error('Notification preferences update failed:', error.message);
      throw new BadRequestException(`Notification preferences update failed: ${error.message}`);
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(
    request: CreateNotificationRequest, 
    preferences: NotificationPreferences | null
  ): boolean {
    if (!preferences || !preferences.isActive) {
      return false;
    }

    // Check channel preference
    if (!preferences.channels[request.channel]) {
      return false;
    }

    // Check type preference
    const typePreference = preferences.types[request.type];
    if (!typePreference) {
      return false;
    }

    // Check quiet hours
    if (preferences.quietHours.enabled) {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        timeZone: preferences.quietHours.timezone 
      });
      const currentDay = now.getDay();

      if (preferences.quietHours.days.includes(currentDay)) {
        if (currentTime >= preferences.quietHours.startTime && 
            currentTime <= preferences.quietHours.endTime) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validate notification request
   */
  private async validateNotificationRequest(request: CreateNotificationRequest): Promise<any> {
    const errors: any[] = [];

    if (!request.userId) {
      errors.push({ code: 'MISSING_USER_ID', message: 'User ID is required', field: 'userId' });
    }

    if (!request.type) {
      errors.push({ code: 'MISSING_TYPE', message: 'Notification type is required', field: 'type' });
    }

    if (!request.channel) {
      errors.push({ code: 'MISSING_CHANNEL', message: 'Notification channel is required', field: 'channel' });
    }

    if (!request.content || !request.content.title || !request.content.message) {
      errors.push({ code: 'MISSING_CONTENT', message: 'Notification content is required', field: 'content' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Map notification to response format
   */
  private mapNotificationToResponse(notification: any): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      channel: notification.channel,
      status: notification.status,
      content: notification.content,
      sentAt: notification.sentAt,
      deliveredAt: notification.deliveredAt,
      metadata: notification.metadata
    };
  }

  /**
   * Map group by result to record
   */
  private mapGroupByToRecord(groupByResult: any[], key: string): Record<string, number> {
    return groupByResult.reduce((acc, item) => {
      const value = item[key];
      acc[value] = item._count[key];
      return acc;
    }, {});
  }
}
