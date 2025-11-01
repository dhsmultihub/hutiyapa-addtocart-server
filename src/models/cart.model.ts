// Cart Model
// Database model definitions and business logic for Cart entity

import { PrismaClient, Cart as PrismaCart, CartStatus } from '../generated/prisma';
import { Cart, CartItem, CartMetadata, CartSession, CreateCartDto, UpdateCartDto } from '../types/cart.types';

export class CartModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new cart
   */
  async create(data: CreateCartDto): Promise<Cart> {
    const cart = await this.prisma.cart.create({
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        status: 'ACTIVE',
        metadata: data.metadata ? {
          create: Object.entries(data.metadata).map(([key, value]) => ({
            key,
            value
          }))
        } : undefined
      },
      include: {
        items: true,
        metadata: true,
        session: true
      }
    });

    return this.mapPrismaCartToCart(cart);
  }

  /**
   * Find cart by ID
   */
  async findById(id: string): Promise<Cart | null> {
    const cart = await this.prisma.cart.findUnique({
      where: { id },
      include: {
        items: true,
        metadata: true,
        session: true
      }
    });

    return cart ? this.mapPrismaCartToCart(cart) : null;
  }

  /**
   * Find active cart by session ID
   */
  async findActiveBySessionId(sessionId: string): Promise<Cart | null> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        sessionId,
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

    return cart ? this.mapPrismaCartToCart(cart) : null;
  }

  /**
   * Find active cart by user ID
   */
  async findActiveByUserId(userId: string): Promise<Cart | null> {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
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

    return cart ? this.mapPrismaCartToCart(cart) : null;
  }

  /**
   * Update cart
   */
  async update(id: string, data: UpdateCartDto): Promise<Cart> {
    const cart = await this.prisma.cart.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.metadata && {
          metadata: {
            deleteMany: {},
            create: Object.entries(data.metadata).map(([key, value]) => ({
              key,
              value
            }))
          }
        })
      },
      include: {
        items: true,
        metadata: true,
        session: true
      }
    });

    return this.mapPrismaCartToCart(cart);
  }

  /**
   * Delete cart
   */
  async delete(id: string): Promise<void> {
    await this.prisma.cart.delete({
      where: { id }
    });
  }

  /**
   * Get cart totals
   */
  async getCartTotals(cartId: string): Promise<{
    subtotal: number;
    itemCount: number;
  }> {
    const result = await this.prisma.cartItem.aggregate({
      where: { cartId },
      _sum: {
        price: true,
        quantity: true
      }
    });

    const subtotal = Number(result._sum.price || 0);
    const itemCount = Number(result._sum.quantity || 0);

    return { subtotal, itemCount };
  }

  /**
   * Clean up expired carts
   */
  async cleanupExpiredCarts(): Promise<number> {
    const result = await this.prisma.cart.updateMany({
      where: {
        status: 'ACTIVE',
        session: {
          expiresAt: {
            lt: new Date()
          }
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    return result.count;
  }

  /**
   * Find unique cart (Prisma method wrapper)
   */
  async findUnique(args: { where: { id: string }; include?: any }) {
    return this.prisma.cart.findUnique(args);
  }

  /**
   * Find many carts (Prisma method wrapper)
   */
  async findMany(args?: any) {
    return this.prisma.cart.findMany(args);
  }

  /**
   * Count carts (Prisma method wrapper)
   */
  async count(args?: any) {
    return this.prisma.cart.count(args);
  }

  /**
   * Map Prisma Cart to our Cart type
   */
  public mapPrismaCartToCart(prismaCart: PrismaCart & {
    items: any[];
    metadata: any[];
    session: any;
  }): Cart {
    return {
      id: prismaCart.id,
      sessionId: prismaCart.sessionId,
      userId: prismaCart.userId || undefined,
      status: prismaCart.status as any,
      createdAt: prismaCart.createdAt,
      updatedAt: prismaCart.updatedAt,
      items: prismaCart.items.map(item => ({
        id: item.id,
        cartId: item.cartId,
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity,
        price: Number(item.price),
        originalPrice: item.originalPrice ? Number(item.originalPrice) : undefined,
        addedAt: item.addedAt,
        updatedAt: item.updatedAt
      })),
      metadata: prismaCart.metadata.map(meta => ({
        id: meta.id,
        cartId: meta.cartId,
        key: meta.key,
        value: meta.value,
        createdAt: meta.createdAt
      })),
      session: {
        id: prismaCart.session.id,
        userId: prismaCart.session.userId || undefined,
        sessionToken: prismaCart.session.sessionToken,
        expiresAt: prismaCart.session.expiresAt,
        createdAt: prismaCart.session.createdAt,
        updatedAt: prismaCart.session.updatedAt
      }
    };
  }
}
