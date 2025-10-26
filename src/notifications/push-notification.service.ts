import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { 
  NotificationType,
  NotificationChannel,
  NotificationPriority,
  CreateNotificationRequest,
  NotificationContent
} from '../types/events.types';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Send price drop notification
   */
  async sendPriceDropNotification(
    userId: string,
    productId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    discountPercentage: number
  ): Promise<void> {
    try {
      this.logger.log(`Sending price drop notification for product: ${productId}`);

      const content: NotificationContent = {
        title: 'Price Drop Alert! 🎉',
        message: `${productName} is now ${discountPercentage}% off! Was $${oldPrice}, now $${newPrice}`,
        actionUrl: `/products/${productId}`,
        data: {
          productId,
          oldPrice,
          newPrice,
          discountPercentage,
          type: 'price_drop'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.PRICE_DROP,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        content,
        metadata: {
          productId,
          oldPrice,
          newPrice,
          discountPercentage,
          triggeredBy: 'price_monitor'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Price drop notification failed:', error.message);
    }
  }

  /**
   * Send stock alert notification
   */
  async sendStockAlertNotification(
    userId: string,
    productId: string,
    productName: string,
    stockLevel: number,
    isBackInStock: boolean = false
  ): Promise<void> {
    try {
      this.logger.log(`Sending stock alert notification for product: ${productId}`);

      const content: NotificationContent = {
        title: isBackInStock ? 'Back in Stock! 📦' : 'Low Stock Alert! ⚠️',
        message: isBackInStock 
          ? `${productName} is back in stock! Order now before it's gone.`
          : `${productName} is running low on stock (${stockLevel} left). Order now!`,
        actionUrl: `/products/${productId}`,
        data: {
          productId,
          stockLevel,
          isBackInStock,
          type: 'stock_alert'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.STOCK_ALERT,
        channel: NotificationChannel.PUSH,
        priority: isBackInStock ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
        content,
        metadata: {
          productId,
          stockLevel,
          isBackInStock,
          triggeredBy: 'stock_monitor'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Stock alert notification failed:', error.message);
    }
  }

  /**
   * Send cart abandonment notification
   */
  async sendCartAbandonmentNotification(
    userId: string,
    cartId: string,
    itemCount: number,
    totalValue: number,
    items: any[]
  ): Promise<void> {
    try {
      this.logger.log(`Sending cart abandonment notification for user: ${userId}`);

      const content: NotificationContent = {
        title: 'Don\'t forget your items! 🛒',
        message: `You have ${itemCount} item${itemCount > 1 ? 's' : ''} worth $${totalValue} in your cart. Complete your purchase now!`,
        actionUrl: `/cart`,
        data: {
          cartId,
          itemCount,
          totalValue,
          type: 'cart_abandonment'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.CART_ABANDONMENT,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        content,
        metadata: {
          cartId,
          itemCount,
          totalValue,
          triggeredBy: 'cart_monitor'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Cart abandonment notification failed:', error.message);
    }
  }

  /**
   * Send promotion notification
   */
  async sendPromotionNotification(
    userId: string,
    promotionTitle: string,
    promotionDescription: string,
    discountCode: string,
    discountPercentage: number,
    validUntil: Date
  ): Promise<void> {
    try {
      this.logger.log(`Sending promotion notification for user: ${userId}`);

      const content: NotificationContent = {
        title: 'Special Offer! 🎁',
        message: `${promotionTitle}: ${promotionDescription} Use code ${discountCode} for ${discountPercentage}% off!`,
        actionUrl: `/promotions/${discountCode}`,
        data: {
          discountCode,
          discountPercentage,
          validUntil,
          type: 'promotion'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.PROMOTION,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        content,
        metadata: {
          discountCode,
          discountPercentage,
          validUntil,
          triggeredBy: 'promotion_system'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Promotion notification failed:', error.message);
    }
  }

  /**
   * Send order update notification
   */
  async sendOrderUpdateNotification(
    userId: string,
    orderId: string,
    orderNumber: string,
    status: string,
    statusMessage: string,
    trackingNumber?: string
  ): Promise<void> {
    try {
      this.logger.log(`Sending order update notification for order: ${orderNumber}`);

      const content: NotificationContent = {
        title: 'Order Update 📦',
        message: `Your order #${orderNumber} is now ${statusMessage}`,
        actionUrl: `/orders/${orderId}`,
        data: {
          orderId,
          orderNumber,
          status,
          trackingNumber,
          type: 'order_update'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.ORDER_UPDATE,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.HIGH,
        content,
        metadata: {
          orderId,
          orderNumber,
          status,
          trackingNumber,
          triggeredBy: 'order_system'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Order update notification failed:', error.message);
    }
  }

  /**
   * Send shipping update notification
   */
  async sendShippingUpdateNotification(
    userId: string,
    orderId: string,
    orderNumber: string,
    trackingNumber: string,
    carrier: string,
    estimatedDelivery: Date
  ): Promise<void> {
    try {
      this.logger.log(`Sending shipping update notification for order: ${orderNumber}`);

      const content: NotificationContent = {
        title: 'Shipping Update 🚚',
        message: `Your order #${orderNumber} is on its way! Track with ${trackingNumber} via ${carrier}`,
        actionUrl: `/orders/${orderId}/tracking`,
        data: {
          orderId,
          orderNumber,
          trackingNumber,
          carrier,
          estimatedDelivery,
          type: 'shipping_update'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.SHIPPING_UPDATE,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.HIGH,
        content,
        metadata: {
          orderId,
          orderNumber,
          trackingNumber,
          carrier,
          estimatedDelivery,
          triggeredBy: 'shipping_system'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Shipping update notification failed:', error.message);
    }
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentConfirmationNotification(
    userId: string,
    orderId: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string
  ): Promise<void> {
    try {
      this.logger.log(`Sending payment confirmation notification for order: ${orderNumber}`);

      const content: NotificationContent = {
        title: 'Payment Confirmed! ✅',
        message: `Your payment of $${amount} for order #${orderNumber} has been confirmed.`,
        actionUrl: `/orders/${orderId}`,
        data: {
          orderId,
          orderNumber,
          amount,
          paymentMethod,
          type: 'payment_confirmation'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.PAYMENT_CONFIRMATION,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.HIGH,
        content,
        metadata: {
          orderId,
          orderNumber,
          amount,
          paymentMethod,
          triggeredBy: 'payment_system'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Payment confirmation notification failed:', error.message);
    }
  }

  /**
   * Send product discontinued notification
   */
  async sendProductDiscontinuedNotification(
    userId: string,
    productId: string,
    productName: string,
    alternativeProducts?: any[]
  ): Promise<void> {
    try {
      this.logger.log(`Sending product discontinued notification for product: ${productId}`);

      const content: NotificationContent = {
        title: 'Product Discontinued ⚠️',
        message: `${productName} is no longer available. ${alternativeProducts?.length ? 'Check out these alternatives!' : ''}`,
        actionUrl: alternativeProducts?.length ? `/products/similar/${productId}` : '/products',
        data: {
          productId,
          alternativeProducts,
          type: 'product_discontinued'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.PRODUCT_DISCONTINUED,
        channel: NotificationChannel.PUSH,
        priority: NotificationPriority.MEDIUM,
        content,
        metadata: {
          productId,
          alternativeProducts,
          triggeredBy: 'product_system'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Product discontinued notification failed:', error.message);
    }
  }

  /**
   * Send system alert notification
   */
  async sendSystemAlertNotification(
    userId: string,
    alertTitle: string,
    alertMessage: string,
    alertType: 'maintenance' | 'outage' | 'feature' | 'security',
    actionUrl?: string
  ): Promise<void> {
    try {
      this.logger.log(`Sending system alert notification for user: ${userId}`);

      const content: NotificationContent = {
        title: `System Alert: ${alertTitle}`,
        message: alertMessage,
        actionUrl: actionUrl || '/notifications',
        data: {
          alertType,
          type: 'system_alert'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.SYSTEM_ALERT,
        channel: NotificationChannel.PUSH,
        priority: alertType === 'security' ? NotificationPriority.URGENT : NotificationPriority.MEDIUM,
        content,
        metadata: {
          alertType,
          triggeredBy: 'system_monitor'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('System alert notification failed:', error.message);
    }
  }

  /**
   * Send cart reminder notification
   */
  async sendCartReminderNotification(
    userId: string,
    cartId: string,
    itemCount: number,
    totalValue: number,
    lastActivity: Date
  ): Promise<void> {
    try {
      this.logger.log(`Sending cart reminder notification for user: ${userId}`);

      const hoursSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60));
      
      const content: NotificationContent = {
        title: 'Cart Reminder 🛒',
        message: `You have ${itemCount} item${itemCount > 1 ? 's' : ''} worth $${totalValue} in your cart. ${hoursSinceActivity > 24 ? 'It\'s been a while!' : 'Don\'t forget to checkout!'}`,
        actionUrl: `/cart`,
        data: {
          cartId,
          itemCount,
          totalValue,
          hoursSinceActivity,
          type: 'cart_reminder'
        }
      };

      const request: CreateNotificationRequest = {
        userId,
        type: NotificationType.CART_REMINDER,
        channel: NotificationChannel.PUSH,
        priority: hoursSinceActivity > 24 ? NotificationPriority.HIGH : NotificationPriority.LOW,
        content,
        metadata: {
          cartId,
          itemCount,
          totalValue,
          hoursSinceActivity,
          triggeredBy: 'cart_monitor'
        }
      };

      await this.notificationService.createNotification(request);

    } catch (error) {
      this.logger.error('Cart reminder notification failed:', error.message);
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(
    userIds: string[],
    type: NotificationType,
    content: NotificationContent,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ): Promise<void> {
    try {
      this.logger.log(`Sending bulk notifications to ${userIds.length} users`);

      const promises = userIds.map(userId => 
        this.notificationService.createNotification({
          userId,
          type,
          channel: NotificationChannel.PUSH,
          priority,
          content,
          metadata: {
            bulkNotification: true,
            totalRecipients: userIds.length
          }
        })
      );

      await Promise.all(promises);

      this.logger.log(`Bulk notifications sent to ${userIds.length} users`);

    } catch (error) {
      this.logger.error('Bulk notifications failed:', error.message);
    }
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(): Promise<any[]> {
    try {
      // This would typically query a templates table
      // For now, return mock data
      return [
        {
          id: 'price_drop_template',
          type: NotificationType.PRICE_DROP,
          name: 'Price Drop Alert',
          content: '{{productName}} is now {{discountPercentage}}% off! Was ${{oldPrice}}, now ${{newPrice}}'
        },
        {
          id: 'stock_alert_template',
          type: NotificationType.STOCK_ALERT,
          name: 'Stock Alert',
          content: '{{productName}} is running low on stock ({{stockLevel}} left). Order now!'
        },
        {
          id: 'cart_abandonment_template',
          type: NotificationType.CART_ABANDONMENT,
          name: 'Cart Abandonment',
          content: 'You have {{itemCount}} item{{itemCount > 1 ? "s" : ""}} worth ${{totalValue}} in your cart. Complete your purchase now!'
        }
      ];

    } catch (error) {
      this.logger.error('Notification templates retrieval failed:', error.message);
      return [];
    }
  }
}
