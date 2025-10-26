import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  BaseEvent,
  CartEvent,
  ProductEvent,
  OrderEvent,
  EventType,
  CartChange,
  ProductChange,
  OrderChange
} from '../types/events.types';
import { Cart } from '../types/cart.types';

@Injectable()
export class CartEventPublisher {
  private readonly logger = new Logger(CartEventPublisher.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish cart item added event
   */
  async publishCartItemAdded(
    cartId: string,
    sessionId: string,
    userId: string | undefined,
    item: any,
    cart: Cart
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_ITEM_ADDED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId,
        sessionId,
        userId,
        changes: [{
          field: 'items',
          oldValue: null,
          newValue: item,
          changeType: 'added',
          timestamp: new Date()
        }],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          itemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart item added event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart item added event publishing failed:', error.message);
    }
  }

  /**
   * Publish cart item removed event
   */
  async publishCartItemRemoved(
    cartId: string,
    sessionId: string,
    userId: string | undefined,
    item: any,
    cart: Cart
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_ITEM_REMOVED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId,
        sessionId,
        userId,
        changes: [{
          field: 'items',
          oldValue: item,
          newValue: null,
          changeType: 'removed',
          timestamp: new Date()
        }],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          itemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart item removed event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart item removed event publishing failed:', error.message);
    }
  }

  /**
   * Publish cart item updated event
   */
  async publishCartItemUpdated(
    cartId: string,
    sessionId: string,
    userId: string | undefined,
    oldItem: any,
    newItem: any,
    cart: Cart
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_ITEM_UPDATED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId,
        sessionId,
        userId,
        changes: [{
          field: 'items',
          oldValue: oldItem,
          newValue: newItem,
          changeType: 'updated',
          timestamp: new Date()
        }],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          itemId: newItem.id,
          productId: newItem.productId,
          oldQuantity: oldItem.quantity,
          newQuantity: newItem.quantity,
          oldPrice: oldItem.price,
          newPrice: newItem.price
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart item updated event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart item updated event publishing failed:', error.message);
    }
  }

  /**
   * Publish cart cleared event
   */
  async publishCartCleared(
    cartId: string,
    sessionId: string,
    userId: string | undefined,
    cart: Cart
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_CLEARED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId,
        sessionId,
        userId,
        changes: [{
          field: 'items',
          oldValue: cart.items,
          newValue: [],
          changeType: 'removed',
          timestamp: new Date()
        }],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          itemCount: cart.items.length,
          totalValue: cart.totals.total
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart cleared event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart cleared event publishing failed:', error.message);
    }
  }

  /**
   * Publish cart merged event
   */
  async publishCartMerged(
    sourceCartId: string,
    targetCartId: string,
    sessionId: string,
    userId: string | undefined,
    mergedItems: any[],
    cart: Cart
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_MERGED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId: targetCartId,
        sessionId,
        userId,
        changes: [{
          field: 'items',
          oldValue: [],
          newValue: mergedItems,
          changeType: 'added',
          timestamp: new Date()
        }],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          sourceCartId,
          targetCartId,
          mergedItemCount: mergedItems.length
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart merged event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart merged event publishing failed:', error.message);
    }
  }

  /**
   * Publish cart abandoned event
   */
  async publishCartAbandoned(
    cartId: string,
    sessionId: string,
    userId: string | undefined,
    cart: Cart,
    abandonmentTime: Date
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_ABANDONED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId,
        sessionId,
        userId,
        changes: [],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          abandonmentTime,
          itemCount: cart.items.length,
          totalValue: cart.totals.total,
          hoursSinceLastActivity: Math.floor((Date.now() - abandonmentTime.getTime()) / (1000 * 60 * 60))
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart abandoned event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart abandoned event publishing failed:', error.message);
    }
  }

  /**
   * Publish cart recovered event
   */
  async publishCartRecovered(
    cartId: string,
    sessionId: string,
    userId: string | undefined,
    cart: Cart
  ): Promise<void> {
    try {
      const cartEvent: CartEvent = {
        id: this.generateEventId(),
        type: EventType.CART_RECOVERED,
        timestamp: new Date(),
        source: 'cart-service',
        version: '1.0.0',
        cartId,
        sessionId,
        userId,
        changes: [],
        totals: this.mapCartTotals(cart.totals),
        metadata: {
          itemCount: cart.items.length,
          totalValue: cart.totals.total
        }
      };

      await this.publishEvent(cartEvent);
      this.logger.log(`Cart recovered event published: ${cartEvent.id}`);

    } catch (error) {
      this.logger.error('Cart recovered event publishing failed:', error.message);
    }
  }

  /**
   * Publish product price changed event
   */
  async publishProductPriceChanged(
    productId: string,
    variantId: string | undefined,
    oldPrice: number,
    newPrice: number,
    discountPercentage: number
  ): Promise<void> {
    try {
      const productEvent: ProductEvent = {
        id: this.generateEventId(),
        type: EventType.PRODUCT_PRICE_CHANGED,
        timestamp: new Date(),
        source: 'product-service',
        version: '1.0.0',
        productId,
        variantId,
        changes: [{
          field: 'price',
          oldValue: oldPrice,
          newValue: newPrice,
          changeType: 'price',
          timestamp: new Date()
        }],
        metadata: {
          oldPrice,
          newPrice,
          discountPercentage,
          priceChange: newPrice - oldPrice
        }
      };

      await this.publishEvent(productEvent);
      this.logger.log(`Product price changed event published: ${productEvent.id}`);

    } catch (error) {
      this.logger.error('Product price changed event publishing failed:', error.message);
    }
  }

  /**
   * Publish product stock updated event
   */
  async publishProductStockUpdated(
    productId: string,
    variantId: string | undefined,
    oldStock: number,
    newStock: number,
    isBackInStock: boolean = false
  ): Promise<void> {
    try {
      const productEvent: ProductEvent = {
        id: this.generateEventId(),
        type: EventType.PRODUCT_STOCK_UPDATED,
        timestamp: new Date(),
        source: 'product-service',
        version: '1.0.0',
        productId,
        variantId,
        changes: [{
          field: 'stock',
          oldValue: oldStock,
          newValue: newStock,
          changeType: 'stock',
          timestamp: new Date()
        }],
        metadata: {
          oldStock,
          newStock,
          isBackInStock,
          stockChange: newStock - oldStock
        }
      };

      await this.publishEvent(productEvent);
      this.logger.log(`Product stock updated event published: ${productEvent.id}`);

    } catch (error) {
      this.logger.error('Product stock updated event publishing failed:', error.message);
    }
  }

  /**
   * Publish product discontinued event
   */
  async publishProductDiscontinued(
    productId: string,
    variantId: string | undefined,
    alternativeProducts: any[]
  ): Promise<void> {
    try {
      const productEvent: ProductEvent = {
        id: this.generateEventId(),
        type: EventType.PRODUCT_DISCONTINUED,
        timestamp: new Date(),
        source: 'product-service',
        version: '1.0.0',
        productId,
        variantId,
        changes: [{
          field: 'availability',
          oldValue: true,
          newValue: false,
          changeType: 'discontinued',
          timestamp: new Date()
        }],
        metadata: {
          alternativeProducts,
          alternativeCount: alternativeProducts.length
        }
      };

      await this.publishEvent(productEvent);
      this.logger.log(`Product discontinued event published: ${productEvent.id}`);

    } catch (error) {
      this.logger.error('Product discontinued event publishing failed:', error.message);
    }
  }

  /**
   * Publish order created event
   */
  async publishOrderCreated(
    orderId: string,
    orderNumber: string,
    userId: string,
    orderData: any
  ): Promise<void> {
    try {
      const orderEvent: OrderEvent = {
        id: this.generateEventId(),
        type: EventType.ORDER_CREATED,
        timestamp: new Date(),
        source: 'order-service',
        version: '1.0.0',
        orderId,
        orderNumber,
        userId,
        status: 'created',
        changes: [{
          field: 'status',
          oldValue: null,
          newValue: 'created',
          changeType: 'status',
          timestamp: new Date()
        }],
        metadata: {
          orderData,
          totalAmount: orderData.total,
          itemCount: orderData.items?.length || 0
        }
      };

      await this.publishEvent(orderEvent);
      this.logger.log(`Order created event published: ${orderEvent.id}`);

    } catch (error) {
      this.logger.error('Order created event publishing failed:', error.message);
    }
  }

  /**
   * Publish order status changed event
   */
  async publishOrderStatusChanged(
    orderId: string,
    orderNumber: string,
    userId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      const orderEvent: OrderEvent = {
        id: this.generateEventId(),
        type: EventType.ORDER_STATUS_CHANGED,
        timestamp: new Date(),
        source: 'order-service',
        version: '1.0.0',
        orderId,
        orderNumber,
        userId,
        status: newStatus,
        changes: [{
          field: 'status',
          oldValue: oldStatus,
          newValue: newStatus,
          changeType: 'status',
          timestamp: new Date()
        }],
        metadata: {
          oldStatus,
          newStatus,
          statusChange: `${oldStatus} -> ${newStatus}`
        }
      };

      await this.publishEvent(orderEvent);
      this.logger.log(`Order status changed event published: ${orderEvent.id}`);

    } catch (error) {
      this.logger.error('Order status changed event publishing failed:', error.message);
    }
  }

  /**
   * Publish payment processed event
   */
  async publishPaymentProcessed(
    orderId: string,
    orderNumber: string,
    userId: string,
    paymentData: any
  ): Promise<void> {
    try {
      const orderEvent: OrderEvent = {
        id: this.generateEventId(),
        type: EventType.PAYMENT_PROCESSED,
        timestamp: new Date(),
        source: 'payment-service',
        version: '1.0.0',
        orderId,
        orderNumber,
        userId,
        status: 'paid',
        changes: [{
          field: 'payment',
          oldValue: 'pending',
          newValue: 'processed',
          changeType: 'payment',
          timestamp: new Date()
        }],
        metadata: {
          paymentData,
          amount: paymentData.amount,
          paymentMethod: paymentData.method
        }
      };

      await this.publishEvent(orderEvent);
      this.logger.log(`Payment processed event published: ${orderEvent.id}`);

    } catch (error) {
      this.logger.error('Payment processed event publishing failed:', error.message);
    }
  }

  /**
   * Publish shipping updated event
   */
  async publishShippingUpdated(
    orderId: string,
    orderNumber: string,
    userId: string,
    shippingData: any
  ): Promise<void> {
    try {
      const orderEvent: OrderEvent = {
        id: this.generateEventId(),
        type: EventType.SHIPPING_UPDATED,
        timestamp: new Date(),
        source: 'shipping-service',
        version: '1.0.0',
        orderId,
        orderNumber,
        userId,
        status: 'shipped',
        changes: [{
          field: 'shipping',
          oldValue: 'pending',
          newValue: 'shipped',
          changeType: 'shipping',
          timestamp: new Date()
        }],
        metadata: {
          shippingData,
          trackingNumber: shippingData.trackingNumber,
          carrier: shippingData.carrier
        }
      };

      await this.publishEvent(orderEvent);
      this.logger.log(`Shipping updated event published: ${orderEvent.id}`);

    } catch (error) {
      this.logger.error('Shipping updated event publishing failed:', error.message);
    }
  }

  /**
   * Publish generic event
   */
  private async publishEvent(event: BaseEvent): Promise<void> {
    try {
      // Emit event using EventEmitter2
      this.eventEmitter.emit(event.type, event);
      
      // Also emit a generic event for global listeners
      this.eventEmitter.emit('event.published', event);

      this.logger.log(`Event published: ${event.type} (${event.id})`);

    } catch (error) {
      this.logger.error('Event publishing failed:', error.message);
      throw error;
    }
  }

  /**
   * Map cart totals to event format
   */
  private mapCartTotals(totals: any): any {
    return {
      subtotal: totals.subtotal || 0,
      tax: totals.tax || 0,
      discount: totals.discount || 0,
      total: totals.total || 0,
      itemCount: totals.itemCount || 0,
      currency: totals.currency || 'USD'
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get event statistics
   */
  async getEventStatistics(): Promise<any> {
    try {
      // This would typically query an event store
      // For now, return mock data
      return {
        totalEvents: 0,
        byType: {},
        bySource: {},
        averageEventsPerHour: 0,
        topEventTypes: [],
        trends: []
      };

    } catch (error) {
      this.logger.error('Event statistics retrieval failed:', error.message);
      return {
        totalEvents: 0,
        byType: {},
        bySource: {},
        averageEventsPerHour: 0,
        topEventTypes: [],
        trends: []
      };
    }
  }
}
