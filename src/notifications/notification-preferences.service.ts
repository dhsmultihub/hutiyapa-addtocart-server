import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  NotificationPreferences,
  NotificationChannelPreferences,
  NotificationTypePreferences,
  NotificationFrequency,
  QuietHours,
  NotificationChannel,
  NotificationType
} from '../types/events.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      this.logger.log(`Getting notification preferences for user: ${userId}`);

      let preferences = await this.databaseService.notificationPreferences.findUnique({
        where: { userId }
      });

      // Create default preferences if none exist
      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }

      return preferences as NotificationPreferences;

    } catch (error) {
      this.logger.error('Notification preferences retrieval failed:', error.message);
      throw new BadRequestException(`Notification preferences retrieval failed: ${error.message}`);
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      this.logger.log(`Updating notification preferences for user: ${userId}`);

      const updatedPreferences = await this.databaseService.notificationPreferences.upsert({
        where: { userId },
        update: {
          ...updates,
          updatedAt: new Date()
        },
        create: {
          id: uuidv4(),
          userId,
          channels: updates.channels || this.getDefaultChannelPreferences(),
          types: updates.types || this.getDefaultTypePreferences(),
          frequency: updates.frequency || this.getDefaultFrequency(),
          quietHours: updates.quietHours || this.getDefaultQuietHours(),
          isActive: updates.isActive !== undefined ? updates.isActive : true,
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
   * Update channel preferences
   */
  async updateChannelPreferences(
    userId: string,
    channelPreferences: Partial<NotificationChannelPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const updatedPreferences = await this.updateUserPreferences(userId, {
        channels: {
          ...currentPreferences.channels,
          ...channelPreferences
        }
      });

      this.logger.log(`Channel preferences updated for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Channel preferences update failed:', error.message);
      throw new BadRequestException(`Channel preferences update failed: ${error.message}`);
    }
  }

  /**
   * Update type preferences
   */
  async updateTypePreferences(
    userId: string,
    typePreferences: Partial<NotificationTypePreferences>
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const updatedPreferences = await this.updateUserPreferences(userId, {
        types: {
          ...currentPreferences.types,
          ...typePreferences
        }
      });

      this.logger.log(`Type preferences updated for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Type preferences update failed:', error.message);
      throw new BadRequestException(`Type preferences update failed: ${error.message}`);
    }
  }

  /**
   * Update frequency preferences
   */
  async updateFrequencyPreferences(
    userId: string,
    frequency: Partial<NotificationFrequency>
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const updatedPreferences = await this.updateUserPreferences(userId, {
        frequency: {
          ...currentPreferences.frequency,
          ...frequency
        }
      });

      this.logger.log(`Frequency preferences updated for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Frequency preferences update failed:', error.message);
      throw new BadRequestException(`Frequency preferences update failed: ${error.message}`);
    }
  }

  /**
   * Update quiet hours
   */
  async updateQuietHours(
    userId: string,
    quietHours: Partial<QuietHours>
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const updatedPreferences = await this.updateUserPreferences(userId, {
        quietHours: {
          ...currentPreferences.quietHours,
          ...quietHours
        }
      });

      this.logger.log(`Quiet hours updated for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Quiet hours update failed:', error.message);
      throw new BadRequestException(`Quiet hours update failed: ${error.message}`);
    }
  }

  /**
   * Enable/disable notifications
   */
  async toggleNotifications(userId: string, isActive: boolean): Promise<NotificationPreferences> {
    try {
      const updatedPreferences = await this.updateUserPreferences(userId, {
        isActive
      });

      this.logger.log(`Notifications ${isActive ? 'enabled' : 'disabled'} for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Notification toggle failed:', error.message);
      throw new BadRequestException(`Notification toggle failed: ${error.message}`);
    }
  }

  /**
   * Enable/disable specific notification type
   */
  async toggleNotificationType(
    userId: string, 
    type: NotificationType, 
    enabled: boolean
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const typePreferences = { ...currentPreferences.types };
      typePreferences[type] = enabled;
      
      const updatedPreferences = await this.updateUserPreferences(userId, {
        types: typePreferences
      });

      this.logger.log(`Notification type ${type} ${enabled ? 'enabled' : 'disabled'} for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Notification type toggle failed:', error.message);
      throw new BadRequestException(`Notification type toggle failed: ${error.message}`);
    }
  }

  /**
   * Enable/disable specific notification channel
   */
  async toggleNotificationChannel(
    userId: string, 
    channel: NotificationChannel, 
    enabled: boolean
  ): Promise<NotificationPreferences> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      
      const channelPreferences = { ...currentPreferences.channels };
      channelPreferences[channel] = enabled;
      
      const updatedPreferences = await this.updateUserPreferences(userId, {
        channels: channelPreferences
      });

      this.logger.log(`Notification channel ${channel} ${enabled ? 'enabled' : 'disabled'} for user: ${userId}`);
      return updatedPreferences;

    } catch (error) {
      this.logger.error('Notification channel toggle failed:', error.message);
      throw new BadRequestException(`Notification channel toggle failed: ${error.message}`);
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    try {
      const defaultPreferences = await this.createDefaultPreferences(userId);
      
      this.logger.log(`Preferences reset to defaults for user: ${userId}`);
      return defaultPreferences;

    } catch (error) {
      this.logger.error('Preferences reset failed:', error.message);
      throw new BadRequestException(`Preferences reset failed: ${error.message}`);
    }
  }

  /**
   * Get preferences analytics
   */
  async getPreferencesAnalytics(): Promise<any> {
    try {
      const [
        totalUsers,
        activeUsers,
        byChannel,
        byType,
        byFrequency
      ] = await Promise.all([
        this.databaseService.notificationPreferences.count(),
        this.databaseService.notificationPreferences.count({
          where: { isActive: true }
        }),
        this.databaseService.notificationPreferences.groupBy({
          by: ['channels'],
          _count: { channels: true }
        }),
        this.databaseService.notificationPreferences.groupBy({
          by: ['types'],
          _count: { types: true }
        }),
        this.databaseService.notificationPreferences.groupBy({
          by: ['frequency'],
          _count: { frequency: true }
        })
      ]);

      return {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        byChannel: this.mapGroupByToRecord(byChannel, 'channels'),
        byType: this.mapGroupByToRecord(byType, 'types'),
        byFrequency: this.mapGroupByToRecord(byFrequency, 'frequency'),
        averageChannelsPerUser: 0, // Would be calculated
        mostPopularChannels: [], // Would be calculated
        mostPopularTypes: [] // Would be calculated
      };

    } catch (error) {
      this.logger.error('Preferences analytics retrieval failed:', error.message);
      throw new BadRequestException(`Preferences analytics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Create default preferences for user
   */
  private async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences: NotificationPreferences = {
        id: uuidv4(),
        userId,
        channels: this.getDefaultChannelPreferences(),
        types: this.getDefaultTypePreferences(),
        frequency: this.getDefaultFrequency(),
        quietHours: this.getDefaultQuietHours(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.databaseService.notificationPreferences.create({
        data: {
          id: preferences.id,
          userId: preferences.userId,
          channels: preferences.channels,
          types: preferences.types,
          frequency: preferences.frequency,
          quietHours: preferences.quietHours,
          isActive: preferences.isActive,
          createdAt: preferences.createdAt,
          updatedAt: preferences.updatedAt
        }
      });

      this.logger.log(`Default preferences created for user: ${userId}`);
      return preferences;

    } catch (error) {
      this.logger.error('Default preferences creation failed:', error.message);
      throw new BadRequestException(`Default preferences creation failed: ${error.message}`);
    }
  }

  /**
   * Get default channel preferences
   */
  private getDefaultChannelPreferences(): NotificationChannelPreferences {
    return {
      email: true,
      push: true,
      sms: false,
      inApp: true,
      webhook: false
    };
  }

  /**
   * Get default type preferences
   */
  private getDefaultTypePreferences(): NotificationTypePreferences {
    return {
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
    };
  }

  /**
   * Get default frequency preferences
   */
  private getDefaultFrequency(): NotificationFrequency {
    return {
      immediate: true,
      daily: false,
      weekly: false,
      monthly: false,
      custom: {
        enabled: false,
        interval: 24
      }
    };
  }

  /**
   * Get default quiet hours
   */
  private getDefaultQuietHours(): QuietHours {
    return {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
      days: [0, 1, 2, 3, 4, 5, 6] // All days
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

  /**
   * Validate preferences
   */
  private validatePreferences(preferences: Partial<NotificationPreferences>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate quiet hours
    if (preferences.quietHours) {
      const { startTime, endTime, timezone } = preferences.quietHours;
      
      if (startTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
        errors.push('Invalid start time format. Use HH:MM format.');
      }
      
      if (endTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
        errors.push('Invalid end time format. Use HH:MM format.');
      }
      
      if (timezone && typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf && !(Intl as any).supportedValuesOf('timeZone').includes(timezone)) {
        errors.push('Invalid timezone.');
      }
    }

    // Validate frequency
    if (preferences.frequency) {
      const { custom } = preferences.frequency;
      
      if (custom?.enabled && custom.interval < 1) {
        errors.push('Custom interval must be at least 1 hour.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
