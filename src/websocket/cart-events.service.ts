import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CartWebSocketGateway } from './websocket.gateway';
import { 
  WebSocketConnection, 
  WebSocketMessage, 
  WebSocketEventType,
  CartEvent,
  EventType,
  CartChange,
  CartTotals
} from '../types/events.types';
import { Cart } from '../types/cart.types';

@Injectable()
export class CartEventsService {
  private readonly logger = new Logger(CartEventsService.name);

  constructor(
    @Inject(forwardRef(() => CartWebSocketGateway))
    private readonly webSocketGateway: CartWebSocketGateway
  ) {}

  /**
   * Handle cart update from WebSocket
   */
  async handleCartUpdate(connection: WebSocketConnection, data: any): Promise<void> {
    try {
      this.logger.log(`Processing cart update for connection: ${connection.id}`);

      // Validate cart update data
      const validation = this.validateCartUpdateData(data);
      if (!validation.isValid) {
        throw new Error(`Invalid cart update data: ${validation.errors.join(', ')}`);
      }

      // Create cart event
      const cartEvent = await this.createCartEvent(connection, data);

      // Broadcast to relevant rooms
      await this.broadcastCartEvent(cartEvent, connection);

      // Update connection activity
      connection.lastActivity = new Date();

      this.logger.log(`Cart update processed successfully for connection: ${connection.id}`);

    } catch (error) {
      this.logger.error('Cart update handling failed:', error.message);
      throw error;
    }
  }

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
          quantity: item.quantity
        }
      };

      await this.broadcastCartEvent(cartEvent, null);

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
          quantity: item.quantity
        }
      };

      await this.broadcastCartEvent(cartEvent, null);

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
          newQuantity: newItem.quantity
        }
      };

      await this.broadcastCartEvent(cartEvent, null);

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
          itemCount: cart.items.length
        }
      };

      await this.broadcastCartEvent(cartEvent, null);

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

      await this.broadcastCartEvent(cartEvent, null);

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
          totalValue: cart.totals.total
        }
      };

      await this.broadcastCartEvent(cartEvent, null);

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

      await this.broadcastCartEvent(cartEvent, null);

    } catch (error) {
      this.logger.error('Cart recovered event publishing failed:', error.message);
    }
  }

  /**
   * Broadcast cart event to relevant connections
   */
  private async broadcastCartEvent(cartEvent: CartEvent, sourceConnection: WebSocketConnection | null): Promise<void> {
    try {
      const message: WebSocketMessage = {
        type: WebSocketEventType.CART_UPDATE,
        data: cartEvent,
        timestamp: new Date(),
        metadata: {
          eventType: cartEvent.type,
          cartId: cartEvent.cartId,
          sessionId: cartEvent.sessionId
        }
      };

      // Broadcast to cart room
      const cartRoom = `cart:${cartEvent.cartId}`;
      this.webSocketGateway.sendToRoom(cartRoom, message);

      // Broadcast to session room
      const sessionRoom = `session:${cartEvent.sessionId}`;
      this.webSocketGateway.sendToRoom(sessionRoom, message);

      // Broadcast to user room if user is authenticated
      if (cartEvent.userId) {
        const userRoom = `user:${cartEvent.userId}`;
        this.webSocketGateway.sendToUser(cartEvent.userId, message);
      }

      this.logger.log(`Cart event broadcasted: ${cartEvent.type} for cart ${cartEvent.cartId}`);

    } catch (error) {
      this.logger.error('Cart event broadcasting failed:', error.message);
    }
  }

  /**
   * Create cart event from WebSocket data
   */
  private async createCartEvent(connection: WebSocketConnection, data: any): Promise<CartEvent> {
    const changes: CartChange[] = [];

    // Process cart changes
    if (data.changes) {
      for (const change of data.changes) {
        changes.push({
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changeType: change.changeType,
          timestamp: new Date()
        });
      }
    }

    return {
      id: this.generateEventId(),
      type: data.eventType || EventType.CART_ITEM_UPDATED,
      timestamp: new Date(),
      source: 'websocket-client',
      version: '1.0.0',
      cartId: data.cartId,
      sessionId: connection.sessionId || data.sessionId,
      userId: connection.userId,
      deviceId: connection.deviceId,
      changes,
      totals: data.totals || {
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        itemCount: 0,
        currency: 'USD'
      },
      metadata: {
        connectionId: connection.id,
        ...data.metadata
      }
    };
  }

  /**
   * Validate cart update data
   */
  private validateCartUpdateData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.cartId) {
      errors.push('Cart ID is required');
    }

    if (!data.sessionId && !data.userId) {
      errors.push('Either session ID or user ID is required');
    }

    if (data.changes && !Array.isArray(data.changes)) {
      errors.push('Changes must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Map cart totals to event format
   */
  private mapCartTotals(totals: any): CartTotals {
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
   * Get cart event history
   */
  async getCartEventHistory(cartId: string, limit: number = 50): Promise<CartEvent[]> {
    try {
      // This would typically query an event store
      // For now, return empty array
      return [];

    } catch (error) {
      this.logger.error('Cart event history retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Get event analytics
   */
  async getEventAnalytics(dateFrom?: Date, dateTo?: Date): Promise<any> {
    try {
      // This would typically query event analytics
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
      this.logger.error('Event analytics retrieval failed:', error.message);
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
