// Cart Item Model
// Database model definitions and business logic for CartItem entity

import { PrismaClient } from '../generated/prisma';
import { CartItem, AddItemDto, UpdateItemDto } from '../types/cart.types';

export class CartItemModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Add item to cart
   */
  async addItem(cartId: string, data: AddItemDto): Promise<CartItem> {
    // Check if item already exists in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId_variantId: {
          cartId,
          productId: data.productId,
          variantId: data.variantId || null
        }
      }
    });

    if (existingItem) {
      // Update quantity if item exists
      const updatedItem = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + data.quantity,
          updatedAt: new Date()
        }
      });

      return this.mapPrismaItemToCartItem(updatedItem);
    } else {
      // Create new item
      const newItem = await this.prisma.cartItem.create({
        data: {
          cartId,
          productId: data.productId,
          variantId: data.variantId,
          quantity: data.quantity,
          price: 0, // Will be updated by pricing service
          originalPrice: 0 // Will be updated by pricing service
        }
      });

      return this.mapPrismaItemToCartItem(newItem);
    }
  }

  /**
   * Update item quantity
   */
  async updateItem(itemId: string, data: UpdateItemDto): Promise<CartItem> {
    const updatedItem = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: Math.max(1, data.quantity),
        updatedAt: new Date()
      }
    });

    return this.mapPrismaItemToCartItem(updatedItem);
  }

  /**
   * Remove item from cart
   */
  async removeItem(itemId: string): Promise<void> {
    await this.prisma.cartItem.delete({
      where: { id: itemId }
    });
  }

  /**
   * Remove item by product and variant
   */
  async removeItemByProduct(cartId: string, productId: string, variantId?: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: {
        cartId,
        productId,
        variantId: variantId || null
      }
    });
  }

  /**
   * Get item by ID
   */
  async findById(itemId: string): Promise<CartItem | null> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId }
    });

    return item ? this.mapPrismaItemToCartItem(item) : null;
  }

  /**
   * Get items by cart ID
   */
  async findByCartId(cartId: string): Promise<CartItem[]> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      orderBy: { addedAt: 'asc' }
    });

    return items.map(item => this.mapPrismaItemToCartItem(item));
  }

  /**
   * Update item price
   */
  async updatePrice(itemId: string, price: number, originalPrice?: number): Promise<CartItem> {
    const updatedItem = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        price,
        originalPrice,
        updatedAt: new Date()
      }
    });

    return this.mapPrismaItemToCartItem(updatedItem);
  }

  /**
   * Clear all items from cart
   */
  async clearCart(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({
      where: { cartId }
    });
  }

  /**
   * Get cart item count
   */
  async getItemCount(cartId: string): Promise<number> {
    const result = await this.prisma.cartItem.aggregate({
      where: { cartId },
      _sum: {
        quantity: true
      }
    });

    return Number(result._sum.quantity || 0);
  }

  /**
   * Get cart total value
   */
  async getCartTotal(cartId: string): Promise<number> {
    const result = await this.prisma.cartItem.aggregate({
      where: { cartId },
      _sum: {
        price: true
      }
    });

    return Number(result._sum.price || 0);
  }

  /**
   * Check if product exists in cart
   */
  async hasProduct(cartId: string, productId: string, variantId?: string): Promise<boolean> {
    const count = await this.prisma.cartItem.count({
      where: {
        cartId,
        productId,
        variantId: variantId || null
      }
    });

    return count > 0;
  }

  /**
   * Map Prisma CartItem to our CartItem type
   */
  private mapPrismaItemToCartItem(prismaItem: any): CartItem {
    return {
      id: prismaItem.id,
      cartId: prismaItem.cartId,
      productId: prismaItem.productId,
      variantId: prismaItem.variantId || undefined,
      quantity: prismaItem.quantity,
      price: Number(prismaItem.price),
      originalPrice: prismaItem.originalPrice ? Number(prismaItem.originalPrice) : undefined,
      addedAt: prismaItem.addedAt,
      updatedAt: prismaItem.updatedAt
    };
  }
}
