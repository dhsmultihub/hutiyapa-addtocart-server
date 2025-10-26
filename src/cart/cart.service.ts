import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PricingEngineService } from '../services/pricing-engine.service';
import { 
  Cart, 
  CartItem, 
  AddItemDto, 
  UpdateItemDto, 
  CartResponseDto, 
  CartItemResponseDto, 
  CartTotalsDto,
  SessionContext,
  CartServiceError 
} from '../types/cart.types';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pricingEngineService: PricingEngineService
  ) {}

  /**
   * Get or create cart for session
   */
  async getOrCreateCart(sessionContext: SessionContext): Promise<Cart> {
    try {
      this.logger.log(`Getting cart for session: ${sessionContext.sessionId}`);
      
      const cart = await this.databaseService.getOrCreateCart(sessionContext);
      
      this.logger.log(`Cart retrieved/created: ${cart.id}`);
      return cart;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get/create cart: ${errorMessage}`, errorStack);
      throw new CartServiceError('CART_OPERATION_FAILED', 'Failed to get or create cart', error);
    }
  }

  /**
   * Get cart by ID
   */
  async getCartById(cartId: string): Promise<Cart> {
    try {
      this.logger.log(`Getting cart by ID: ${cartId}`);
      
      const cart = await this.databaseService.cart.findById(cartId);
      
      if (!cart) {
        throw new NotFoundException('Cart not found');
      }
      
      this.logger.log(`Cart retrieved: ${cart.id}`);
      return cart;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get cart: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Add item to cart
   */
  async addItemToCart(cartId: string, addItemDto: AddItemDto): Promise<CartItem> {
    try {
      this.logger.log(`Adding item to cart: ${cartId}`, addItemDto);
      
      // Validate cart exists
      await this.getCartById(cartId);
      
      // Add item to cart
      const cartItem = await this.databaseService.addItemToCart(cartId, addItemDto);
      
      this.logger.log(`Item added to cart: ${cartItem.id}`);
      return cartItem;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to add item to cart: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Update cart item
   */
  async updateCartItem(itemId: string, updateItemDto: UpdateItemDto): Promise<CartItem> {
    try {
      this.logger.log(`Updating cart item: ${itemId}`, updateItemDto);
      
      const cartItem = await this.databaseService.updateCartItem(itemId, updateItemDto);
      
      this.logger.log(`Cart item updated: ${cartItem.id}`);
      return cartItem;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update cart item: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeItemFromCart(itemId: string): Promise<void> {
    try {
      this.logger.log(`Removing item from cart: ${itemId}`);
      
      await this.databaseService.removeItemFromCart(itemId);
      
      this.logger.log(`Item removed from cart: ${itemId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to remove item from cart: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Clear cart
   */
  async clearCart(cartId: string): Promise<void> {
    try {
      this.logger.log(`Clearing cart: ${cartId}`);
      
      // Validate cart exists
      await this.getCartById(cartId);
      
      await this.databaseService.clearCart(cartId);
      
      this.logger.log(`Cart cleared: ${cartId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to clear cart: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get cart response with totals
   */
  async getCartResponse(cart: Cart): Promise<CartResponseDto> {
    try {
      // Calculate totals
      const totals = await this.calculateCartTotals(cart);
      
      // Map items to response format
      const items: CartItemResponseDto[] = cart.items.map(item => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice || undefined,
        total: item.price * item.quantity,
        addedAt: item.addedAt,
      }));

      // Map metadata
      const metadata: Record<string, string> = {};
      cart.metadata.forEach(meta => {
        metadata[meta.key] = meta.value;
      });

      return {
        id: cart.id,
        userId: cart.userId || undefined,
        status: cart.status,
        items,
        totals,
        metadata,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get cart response: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Calculate cart totals using pricing engine
   */
  private async calculateCartTotals(cart: Cart): Promise<CartTotalsDto> {
    try {
      const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      
      // Convert cart items to pricing items
      const pricingItems = cart.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.price,
        category: item.metadata?.category,
        metadata: item.metadata
      }));

      // Create pricing request
      const pricingRequest = {
        items: pricingItems,
        userId: cart.userId,
        sessionId: cart.sessionId,
        currency: 'USD' as const,
        metadata: {
          cartId: cart.id,
          calculatedAt: new Date()
        }
      };

      // Calculate pricing using pricing engine
      const pricingResponse = await this.pricingEngineService.calculatePricing(pricingRequest);
      const breakdown = pricingResponse.breakdown;

      return {
        subtotal: breakdown.subtotal,
        tax: breakdown.taxTotal,
        discount: breakdown.discountTotal,
        total: breakdown.total,
        itemCount,
      };

    } catch (error) {
      this.logger.error('Pricing calculation failed, using fallback:', error.message);
      
      // Fallback to simple calculation if pricing engine fails
      const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      
      return {
        subtotal,
        tax: 0,
        discount: 0,
        total: subtotal,
        itemCount,
      };
    }
  }

  /**
   * Get session context from request
   */
  async getSessionContext(sessionToken: string): Promise<SessionContext | null> {
    try {
      return await this.databaseService.getSessionContext(sessionToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get session context: ${errorMessage}`, errorStack);
      return null;
    }
  }

  /**
   * Create session
   */
  async createSession(userId?: string): Promise<{ sessionToken: string; expiresAt: Date }> {
    try {
      const sessionToken = this.databaseService.cartSession.generateSessionToken();
      const expiresAt = this.databaseService.cartSession.calculateExpiryDate(24);
      
      await this.databaseService.createSession({
        userId: userId || undefined,
        sessionToken,
        expiresAt,
      });
      
      this.logger.log(`Session created: ${sessionToken}`);
      
      return { sessionToken, expiresAt };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create session: ${errorMessage}`, errorStack);
      throw new CartServiceError('SESSION_CREATION_FAILED', 'Failed to create session', error);
    }
  }
}
