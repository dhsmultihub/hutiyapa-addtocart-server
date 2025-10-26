import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CartMergeDto, CartMergeResponseDto } from '../dto/cart-merge.dto';
import { SessionContext } from '../../types/cart.types';

export interface MergeConflict {
  productId: string;
  variantId?: string;
  guestQuantity: number;
  userQuantity: number;
  guestPrice: number;
  userPrice: number;
  resolution: 'guest' | 'user' | 'combined';
}

@Injectable()
export class CartMergerService {
  private readonly logger = new Logger(CartMergerService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Merge guest cart with user cart on login
   */
  async mergeCarts(
    guestCartId: string,
    userCartId: string,
    mergeOptions: CartMergeDto
  ): Promise<CartMergeResponseDto> {
    try {
      // Get both carts with items
      const [guestCart, userCart] = await Promise.all([
        this.databaseService.prisma.cart.findUnique({
          where: { id: guestCartId },
          include: { items: true, metadata: true }
        }),
        this.databaseService.prisma.cart.findUnique({
          where: { id: userCartId },
          include: { items: true, metadata: true }
        })
      ]);

      if (!guestCart || !userCart) {
        throw new BadRequestException('One or both carts not found');
      }

      // Validate cart ownership
      if (guestCart.userId !== null) {
        throw new BadRequestException('Guest cart must not have a user ID');
      }

      if (userCart.userId === null) {
        throw new BadRequestException('User cart must have a user ID');
      }

      const conflicts: MergeConflict[] = [];
      const mergedItems = new Map<string, any>();
      const itemsToAdd: any[] = [];
      const itemsToUpdate: any[] = [];

      // Process guest cart items
      for (const guestItem of guestCart.items) {
        const key = `${guestItem.productId}_${guestItem.variantId || 'no_variant'}`;
        
        // Find matching item in user cart
        const userItem = userCart.items.find(item => 
          item.productId === guestItem.productId && 
          item.variantId === guestItem.variantId
        );

        if (userItem) {
          // Conflict resolution
          const conflict = this.resolveItemConflict(guestItem, userItem, mergeOptions);
          conflicts.push(conflict);

          if (conflict.resolution === 'combined') {
            itemsToUpdate.push({
              itemId: userItem.id,
              quantity: userItem.quantity + guestItem.quantity,
              price: mergeOptions.preferGuestPrice ? guestItem.price : userItem.price
            });
          } else if (conflict.resolution === 'guest') {
            itemsToUpdate.push({
              itemId: userItem.id,
              quantity: guestItem.quantity,
              price: guestItem.price
            });
          }
          // If resolution is 'user', keep user cart as is
        } else {
          // No conflict, add guest item to user cart
          itemsToAdd.push({
            productId: guestItem.productId,
            variantId: guestItem.variantId,
            quantity: guestItem.quantity,
            price: guestItem.price,
            originalPrice: guestItem.originalPrice
          });
        }
      }

      // Execute merge in transaction
      const result = await this.databaseService.transaction(async (tx) => {
        // Add new items
        for (const item of itemsToAdd) {
          await tx.cartItem.create({
            data: {
              cartId: userCartId,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              price: item.price,
              originalPrice: item.originalPrice
            }
          });
        }

        // Update existing items
        for (const update of itemsToUpdate) {
          await tx.cartItem.update({
            where: { id: update.itemId },
            data: {
              quantity: update.quantity,
              price: update.price
            }
          });
        }

        // Merge metadata
        if (mergeOptions.preserveMetadata) {
          for (const metadata of guestCart.metadata) {
            await tx.cartMetadata.upsert({
              where: {
                cartId_key: {
                  cartId: userCartId,
                  key: metadata.key
                }
              },
              update: { value: metadata.value },
              create: {
                cartId: userCartId,
                key: metadata.key,
                value: metadata.value
              }
            });
          }
        }

        // Update user cart timestamp
        await tx.cart.update({
          where: { id: userCartId },
          data: { updatedAt: new Date() }
        });

        // Mark guest cart as merged
        await tx.cart.update({
          where: { id: guestCartId },
          data: { 
            status: 'COMPLETED',
            updatedAt: new Date()
          }
        });

        return {
          userCartId,
          guestCartId,
          itemsAdded: itemsToAdd.length,
          itemsUpdated: itemsToUpdate.length,
          conflicts: conflicts.length
        };
      });

      this.logger.log(`Successfully merged carts: ${guestCartId} -> ${userCartId}`);

      return {
        success: true,
        userCartId,
        guestCartId,
        itemsAdded: result.itemsAdded,
        itemsUpdated: result.itemsUpdated,
        conflicts,
        message: 'Carts merged successfully'
      };

    } catch (error) {
      this.logger.error('Cart merge failed:', error.message);
      throw new BadRequestException(`Cart merge failed: ${error.message}`);
    }
  }

  /**
   * Resolve conflicts between guest and user cart items
   */
  private resolveItemConflict(
    guestItem: any,
    userItem: any,
    mergeOptions: CartMergeDto
  ): MergeConflict {
    const conflict: MergeConflict = {
      productId: guestItem.productId,
      variantId: guestItem.variantId,
      guestQuantity: guestItem.quantity,
      userQuantity: userItem.quantity,
      guestPrice: guestItem.price,
      userPrice: userItem.price,
      resolution: 'user' // default
    };

    // Price conflict resolution
    if (guestItem.price !== userItem.price) {
      if (mergeOptions.preferGuestPrice) {
        conflict.resolution = 'guest';
      } else if (mergeOptions.preferUserPrice) {
        conflict.resolution = 'user';
      } else {
        // Use newer price (assuming guest cart is newer)
        conflict.resolution = 'guest';
      }
    }

    // Quantity handling
    if (mergeOptions.combineQuantities) {
      conflict.resolution = 'combined';
    }

    return conflict;
  }

  /**
   * Preview cart merge without executing
   */
  async previewMerge(
    guestCartId: string,
    userCartId: string,
    mergeOptions: CartMergeDto
  ): Promise<{
    conflicts: MergeConflict[];
    itemsToAdd: number;
    itemsToUpdate: number;
    estimatedTotal: number;
  }> {
    try {
      const [guestCart, userCart] = await Promise.all([
        this.databaseService.prisma.cart.findUnique({
          where: { id: guestCartId },
          include: { items: true }
        }),
        this.databaseService.prisma.cart.findUnique({
          where: { id: userCartId },
          include: { items: true }
        })
      ]);

      if (!guestCart || !userCart) {
        throw new BadRequestException('One or both carts not found');
      }

      const conflicts: MergeConflict[] = [];
      let itemsToAdd = 0;
      let itemsToUpdate = 0;
      let estimatedTotal = 0;

      // Calculate user cart total
      estimatedTotal = userCart.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

      for (const guestItem of guestCart.items) {
        const userItem = userCart.items.find(item => 
          item.productId === guestItem.productId && 
          item.variantId === guestItem.variantId
        );

        if (userItem) {
          const conflict = this.resolveItemConflict(guestItem, userItem, mergeOptions);
          conflicts.push(conflict);
          itemsToUpdate++;

          if (conflict.resolution === 'combined') {
            estimatedTotal += Number(guestItem.price) * guestItem.quantity;
          } else if (conflict.resolution === 'guest') {
            estimatedTotal += (Number(guestItem.price) - Number(userItem.price)) * userItem.quantity;
          }
        } else {
          itemsToAdd++;
          estimatedTotal += Number(guestItem.price) * guestItem.quantity;
        }
      }

      return {
        conflicts,
        itemsToAdd,
        itemsToUpdate,
        estimatedTotal
      };

    } catch (error) {
      this.logger.error('Preview merge failed:', error.message);
      throw new BadRequestException(`Preview merge failed: ${error.message}`);
    }
  }

  /**
   * Get merge history for a user
   */
  async getMergeHistory(userId: string, limit: number = 10) {
    try {
      const history = await this.databaseService.prisma.cart.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          metadata: {
            some: {
              key: 'merged_from_guest'
            }
          }
        },
        include: {
          items: true,
          metadata: true
        },
        orderBy: { updatedAt: 'desc' },
        take: limit
      });

      return history.map(cart => ({
        cartId: cart.id,
        mergedAt: cart.updatedAt,
        itemCount: cart.items.length,
        totalValue: cart.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0),
        source: cart.metadata.find(m => m.key === 'merged_from_guest')?.value
      }));

    } catch (error) {
      this.logger.error('Failed to get merge history:', error.message);
      throw new BadRequestException(`Failed to get merge history: ${error.message}`);
    }
  }
}
