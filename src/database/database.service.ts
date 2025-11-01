// Database Service
// Main service layer for database operations with transaction support

import { PrismaClient } from '../generated/prisma';
import { CartModel } from '../models/cart.model';
import { CartItemModel } from '../models/cart-item.model';
import { CartSessionModel } from '../models/cart-session.model';
import { 
  Cart, 
  CartItem, 
  CartSession, 
  CreateCartDto, 
  UpdateCartDto,
  AddItemDto,
  UpdateItemDto,
  CreateSessionDto,
  SessionContext,
  CartServiceError
} from '../types/cart.types';

export class DatabaseService {
  public prisma: PrismaClient;
  public cart: CartModel;
  public cartItem: CartItemModel;
  public cartSession: CartSessionModel;

  // Expose Prisma models directly for backward compatibility
  get session() { return (this.prisma as any).session; }
  get cartBackup() { return (this.prisma as any).cartBackup; }
  get cartSnapshot() { return (this.prisma as any).cartSnapshot; }
  get cartMetadata() { return (this.prisma as any).cartMetadata; }
  get order() { return (this.prisma as any).order; }
  get shipping() { return (this.prisma as any).shipping; }
  get notification() { return (this.prisma as any).notification; }
  get notificationPreferences() { return (this.prisma as any).notificationPreferences; }
  get discount() { return (this.prisma as any).discount; }
  get discountUsage() { return (this.prisma as any).discountUsage; }
  get payment() { return (this.prisma as any).payment; }
  get orderItem() { return (this.prisma as any).orderItem; }
  get orderEvent() { return (this.prisma as any).orderEvent; }
  get promotion() { return (this.prisma as any).promotion; }
  get promotionUsage() { return (this.prisma as any).promotionUsage; }
  get taxRate() { return (this.prisma as any).taxRate; }
  get user() { return (this.prisma as any).user; }
  get sessionSync() { return (this.prisma as any).sessionSync; }

  // Expose Prisma query methods
  get $queryRaw() { return this.prisma.$queryRaw.bind(this.prisma); }

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
    
    this.cart = new CartModel(this.prisma);
    this.cartItem = new CartItemModel(this.prisma);
    this.cartSession = new CartSessionModel(this.prisma);
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw new CartServiceError('DB_CONNECTION_FAILED', 'Failed to connect to database', error);
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      console.log('Database disconnected successfully');
    } catch (error) {
      console.error('Database disconnection failed:', error);
      throw new CartServiceError('DB_DISCONNECTION_FAILED', 'Failed to disconnect from database', error);
    }
  }

  /**
   * Execute database operations in a transaction
   */
  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (error) {
      console.error('Transaction failed:', error);
      throw new CartServiceError('TRANSACTION_FAILED', 'Database transaction failed', error);
    }
  }

  /**
   * Health check for database
   */
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      const latency = Date.now() - start;
      return { status: 'unhealthy', latency };
    }
  }

  /**
   * Get or create cart for session
   */
  async getOrCreateCart(sessionContext: SessionContext): Promise<Cart> {
    return this.transaction(async (tx) => {
      // Try to find existing active cart
      let cart = await tx.cart.findFirst({
        where: {
          sessionId: sessionContext.sessionId,
          status: 'ACTIVE'
        },
        include: {
          items: true,
          metadata: true,
          session: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!cart) {
        // Create new cart
        cart = await tx.cart.create({
          data: {
            sessionId: sessionContext.sessionId,
            userId: sessionContext.userId || null,
            status: 'ACTIVE'
          },
          include: {
            items: true,
            metadata: true,
            session: true
          }
        });
      }

      // Use the cart model to map the result
      const cartModel = new CartModel(tx);
      return cartModel.mapPrismaCartToCart(cart);
    });
  }

  /**
   * Add item to cart with transaction
   */
  async addItemToCart(cartId: string, itemData: AddItemDto): Promise<CartItem> {
    return this.transaction(async (tx) => {
      // Check if cart exists and is active
      const cart = await tx.cart.findUnique({
        where: { id: cartId }
      });

      if (!cart || cart.status !== 'ACTIVE') {
        throw new CartServiceError('CART_NOT_FOUND', 'Cart not found or not active');
      }

      // Add item to cart
      const cartItemModel = new CartItemModel(tx);
      return await cartItemModel.addItem(cartId, itemData);
    });
  }

  /**
   * Update cart item with transaction
   */
  async updateCartItem(itemId: string, itemData: UpdateItemDto): Promise<CartItem> {
    return this.transaction(async (tx) => {
      const cartItemModel = new CartItemModel(tx);
      return await cartItemModel.updateItem(itemId, itemData);
    });
  }

  /**
   * Remove item from cart with transaction
   */
  async removeItemFromCart(itemId: string): Promise<void> {
    return this.transaction(async (tx) => {
      const cartItemModel = new CartItemModel(tx);
      await cartItemModel.removeItem(itemId);
    });
  }

  /**
   * Clear cart with transaction
   */
  async clearCart(cartId: string): Promise<void> {
    return this.transaction(async (tx) => {
      const cartItemModel = new CartItemModel(tx);
      await cartItemModel.clearCart(cartId);
    });
  }

  /**
   * Create session with transaction
   */
  async createSession(sessionData: CreateSessionDto): Promise<CartSession> {
    return this.transaction(async (tx) => {
      const cartSessionModel = new CartSessionModel(tx);
      return await cartSessionModel.create(sessionData);
    });
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionToken: string): Promise<SessionContext | null> {
    return await this.cartSession.getSessionContext(sessionToken);
  }

  /**
   * Extend session
   */
  async extendSession(sessionId: string, hoursToAdd: number = 24): Promise<CartSession> {
    return await this.cartSession.extendSession(sessionId, hoursToAdd);
  }

  /**
   * Cleanup expired data
   */
  async cleanupExpiredData(): Promise<{ sessions: number; carts: number }> {
    const sessions = await this.cartSession.cleanupExpiredSessions();
    const carts = await this.cart.cleanupExpiredCarts();
    
    return { sessions, carts };
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalCarts: number;
    activeCarts: number;
    totalItems: number;
    totalSessions: number;
  }> {
    const [totalCarts, activeCarts, totalItems, totalSessions] = await Promise.all([
      this.prisma.cart.count(),
      this.prisma.cart.count({ where: { status: 'ACTIVE' } }),
      this.prisma.cartItem.count(),
      this.prisma.cartSession.count()
    ]);

    return {
      totalCarts,
      activeCarts,
      totalItems,
      totalSessions
    };
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
