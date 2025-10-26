import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PushNotificationService } from '../../notifications/push-notification.service';
import { 
  EventType,
  ProductEvent,
  CartEvent,
  OrderEvent
} from '../../types/events.types';

@Injectable()
export class ProductEventHandler {
  private readonly logger = new Logger(ProductEventHandler.name);

  constructor(
    private readonly pushNotificationService: PushNotificationService
  ) {}

  /**
   * Handle product price changed event
   */
  @OnEvent(EventType.PRODUCT_PRICE_CHANGED)
  async handleProductPriceChanged(event: ProductEvent): Promise<void> {
    try {
      this.logger.log(`Handling product price changed event: ${event.id}`);

      const { productId, changes, metadata } = event;
      const priceChange = changes.find(change => change.field === 'price');
      
      if (!priceChange) {
        this.logger.warn('No price change found in event');
        return;
      }

      const oldPrice = priceChange.oldValue;
      const newPrice = priceChange.newValue;
      const discountPercentage = metadata?.discountPercentage || 0;

      // Check if price decreased significantly (more than 10%)
      if (discountPercentage >= 10) {
        // Get users who have this product in their cart or wishlist
        const interestedUsers = await this.getUsersInterestedInProduct(productId);
        
        // Send price drop notifications
        for (const userId of interestedUsers) {
          await this.pushNotificationService.sendPriceDropNotification(
            userId,
            productId,
            `Product ${productId}`, // Would get actual product name
            oldPrice,
            newPrice,
            discountPercentage
          );
        }
      }

      this.logger.log(`Product price changed event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Product price changed event handling failed:', error.message);
    }
  }

  /**
   * Handle product stock updated event
   */
  @OnEvent(EventType.PRODUCT_STOCK_UPDATED)
  async handleProductStockUpdated(event: ProductEvent): Promise<void> {
    try {
      this.logger.log(`Handling product stock updated event: ${event.id}`);

      const { productId, changes, metadata } = event;
      const stockChange = changes.find(change => change.field === 'stock');
      
      if (!stockChange) {
        this.logger.warn('No stock change found in event');
        return;
      }

      const oldStock = stockChange.oldValue;
      const newStock = stockChange.newValue;
      const isBackInStock = metadata?.isBackInStock || false;

      // Check if product is back in stock
      if (isBackInStock && oldStock === 0 && newStock > 0) {
        // Get users who were waiting for this product
        const waitingUsers = await this.getUsersWaitingForProduct(productId);
        
        // Send back in stock notifications
        for (const userId of waitingUsers) {
          await this.pushNotificationService.sendStockAlertNotification(
            userId,
            productId,
            `Product ${productId}`, // Would get actual product name
            newStock,
            true // isBackInStock
          );
        }
      }

      // Check if stock is running low (less than 10 items)
      if (newStock > 0 && newStock <= 10) {
        // Get users who have this product in their cart
        const cartUsers = await this.getUsersWithProductInCart(productId);
        
        // Send low stock notifications
        for (const userId of cartUsers) {
          await this.pushNotificationService.sendStockAlertNotification(
            userId,
            productId,
            `Product ${productId}`, // Would get actual product name
            newStock,
            false // isBackInStock
          );
        }
      }

      this.logger.log(`Product stock updated event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Product stock updated event handling failed:', error.message);
    }
  }

  /**
   * Handle product discontinued event
   */
  @OnEvent(EventType.PRODUCT_DISCONTINUED)
  async handleProductDiscontinued(event: ProductEvent): Promise<void> {
    try {
      this.logger.log(`Handling product discontinued event: ${event.id}`);

      const { productId, metadata } = event;
      const alternativeProducts = metadata?.alternativeProducts || [];

      // Get users who have this product in their cart or wishlist
      const affectedUsers = await this.getUsersInterestedInProduct(productId);
      
      // Send discontinued notifications
      for (const userId of affectedUsers) {
        await this.pushNotificationService.sendProductDiscontinuedNotification(
          userId,
          productId,
          `Product ${productId}`, // Would get actual product name
          alternativeProducts
        );
      }

      this.logger.log(`Product discontinued event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Product discontinued event handling failed:', error.message);
    }
  }

  /**
   * Handle cart item added event
   */
  @OnEvent(EventType.CART_ITEM_ADDED)
  async handleCartItemAdded(event: CartEvent): Promise<void> {
    try {
      this.logger.log(`Handling cart item added event: ${event.id}`);

      const { userId, cartId, metadata } = event;
      
      if (!userId) {
        this.logger.log('No user ID in cart event, skipping notification');
        return;
      }

      // Check if this is a high-value item
      const itemValue = metadata?.price || 0;
      if (itemValue > 100) {
        // Send high-value item notification
        await this.pushNotificationService.sendSystemAlertNotification(
          userId,
          'High-Value Item Added',
          `You've added a high-value item ($${itemValue}) to your cart. Complete your purchase securely.`,
          'feature',
          '/cart'
        );
      }

      this.logger.log(`Cart item added event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Cart item added event handling failed:', error.message);
    }
  }

  /**
   * Handle cart abandoned event
   */
  @OnEvent(EventType.CART_ABANDONED)
  async handleCartAbandoned(event: CartEvent): Promise<void> {
    try {
      this.logger.log(`Handling cart abandoned event: ${event.id}`);

      const { userId, cartId, totals, metadata } = event;
      
      if (!userId) {
        this.logger.log('No user ID in cart event, skipping notification');
        return;
      }

      // Send cart abandonment notification
      await this.pushNotificationService.sendCartAbandonmentNotification(
        userId,
        cartId,
        totals.itemCount,
        totals.total,
        [] // Would get actual cart items
      );

      this.logger.log(`Cart abandoned event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Cart abandoned event handling failed:', error.message);
    }
  }

  /**
   * Handle order created event
   */
  @OnEvent(EventType.ORDER_CREATED)
  async handleOrderCreated(event: OrderEvent): Promise<void> {
    try {
      this.logger.log(`Handling order created event: ${event.id}`);

      const { userId, orderId, orderNumber, metadata } = event;
      
      // Send order confirmation notification
      await this.pushNotificationService.sendOrderUpdateNotification(
        userId,
        orderId,
        orderNumber,
        'created',
        'Your order has been created and is being processed.',
        metadata?.trackingNumber
      );

      this.logger.log(`Order created event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Order created event handling failed:', error.message);
    }
  }

  /**
   * Handle order status changed event
   */
  @OnEvent(EventType.ORDER_STATUS_CHANGED)
  async handleOrderStatusChanged(event: OrderEvent): Promise<void> {
    try {
      this.logger.log(`Handling order status changed event: ${event.id}`);

      const { userId, orderId, orderNumber, status, metadata } = event;
      
      // Map status to user-friendly message
      const statusMessages = {
        'processing': 'Your order is being processed',
        'shipped': 'Your order has been shipped',
        'delivered': 'Your order has been delivered',
        'cancelled': 'Your order has been cancelled',
        'refunded': 'Your order has been refunded'
      };

      const statusMessage = statusMessages[status] || `Your order status is now ${status}`;

      // Send order update notification
      await this.pushNotificationService.sendOrderUpdateNotification(
        userId,
        orderId,
        orderNumber,
        status,
        statusMessage,
        metadata?.trackingNumber
      );

      this.logger.log(`Order status changed event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Order status changed event handling failed:', error.message);
    }
  }

  /**
   * Handle payment processed event
   */
  @OnEvent(EventType.PAYMENT_PROCESSED)
  async handlePaymentProcessed(event: OrderEvent): Promise<void> {
    try {
      this.logger.log(`Handling payment processed event: ${event.id}`);

      const { userId, orderId, orderNumber, metadata } = event;
      
      // Send payment confirmation notification
      await this.pushNotificationService.sendPaymentConfirmationNotification(
        userId,
        orderId,
        orderNumber,
        metadata?.amount || 0,
        metadata?.paymentMethod || 'Unknown'
      );

      this.logger.log(`Payment processed event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Payment processed event handling failed:', error.message);
    }
  }

  /**
   * Handle shipping updated event
   */
  @OnEvent(EventType.SHIPPING_UPDATED)
  async handleShippingUpdated(event: OrderEvent): Promise<void> {
    try {
      this.logger.log(`Handling shipping updated event: ${event.id}`);

      const { userId, orderId, orderNumber, metadata } = event;
      
      // Send shipping update notification
      await this.pushNotificationService.sendShippingUpdateNotification(
        userId,
        orderId,
        orderNumber,
        metadata?.trackingNumber || '',
        metadata?.carrier || 'Unknown',
        metadata?.estimatedDelivery ? new Date(metadata.estimatedDelivery) : new Date()
      );

      this.logger.log(`Shipping updated event handled: ${event.id}`);

    } catch (error) {
      this.logger.error('Shipping updated event handling failed:', error.message);
    }
  }

  /**
   * Get users interested in a product
   */
  private async getUsersInterestedInProduct(productId: string): Promise<string[]> {
    try {
      // This would typically query the database for users who have this product in:
      // - Their cart
      // - Their wishlist
      // - Their purchase history
      // - Their notification preferences
      
      // For now, return empty array
      return [];

    } catch (error) {
      this.logger.error('Failed to get users interested in product:', error.message);
      return [];
    }
  }

  /**
   * Get users waiting for a product to be back in stock
   */
  private async getUsersWaitingForProduct(productId: string): Promise<string[]> {
    try {
      // This would typically query the database for users who:
      // - Have this product in their wishlist
      // - Have subscribed to stock notifications for this product
      // - Have this product in their cart but it was out of stock
      
      // For now, return empty array
      return [];

    } catch (error) {
      this.logger.error('Failed to get users waiting for product:', error.message);
      return [];
    }
  }

  /**
   * Get users who have a product in their cart
   */
  private async getUsersWithProductInCart(productId: string): Promise<string[]> {
    try {
      // This would typically query the database for users who have this product in their cart
      
      // For now, return empty array
      return [];

    } catch (error) {
      this.logger.error('Failed to get users with product in cart:', error.message);
      return [];
    }
  }

  /**
   * Get event handling statistics
   */
  async getEventHandlingStatistics(): Promise<any> {
    try {
      // This would typically query event handling statistics
      // For now, return mock data
      return {
        totalEventsHandled: 0,
        byEventType: {},
        byHandler: {},
        averageProcessingTime: 0,
        errorRate: 0,
        trends: []
      };

    } catch (error) {
      this.logger.error('Event handling statistics retrieval failed:', error.message);
      return {
        totalEventsHandled: 0,
        byEventType: {},
        byHandler: {},
        averageProcessingTime: 0,
        errorRate: 0,
        trends: []
      };
    }
  }
}
