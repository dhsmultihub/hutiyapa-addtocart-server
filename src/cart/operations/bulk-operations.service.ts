import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AddItemDto } from '../dto/add-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { BulkOperationsDto, BulkOperationsResponseDto } from '../dto/bulk-operations.dto';
import { SessionContext } from '../../types/cart.types';

export interface BulkOperationResult {
  success: boolean;
  itemId?: string;
  error?: string;
  data?: any;
}

@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Add multiple items to cart in a single operation
   */
  async addMultipleItems(
    cartId: string,
    items: AddItemDto[],
    sessionContext: SessionContext
  ): Promise<BulkOperationsResponseDto> {
    const results: BulkOperationResult[] = [];
    const errors: string[] = [];

    try {
      // Validate cart exists and user has access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      // Validate session access
      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Process items in batch
      for (const item of items) {
        try {
          const result = await this.databaseService.addItemToCart(cartId, item);
          results.push({
            success: true,
            itemId: result.id,
            data: result
          });
        } catch (error) {
          this.logger.error(`Failed to add item ${item.productId}:`, error.message);
          results.push({
            success: false,
            error: error.message
          });
          errors.push(`Item ${item.productId}: ${error.message}`);
        }
      }

      return {
        success: results.some(r => r.success),
        totalItems: items.length,
        successfulItems: results.filter(r => r.success).length,
        failedItems: results.filter(r => !r.success).length,
        results,
        errors
      };

    } catch (error) {
      this.logger.error('Bulk add operation failed:', error.message);
      throw new BadRequestException(`Bulk add operation failed: ${error.message}`);
    }
  }

  /**
   * Remove multiple items from cart
   */
  async removeMultipleItems(
    cartId: string,
    itemIds: string[],
    sessionContext: SessionContext
  ): Promise<BulkOperationsResponseDto> {
    const results: BulkOperationResult[] = [];
    const errors: string[] = [];

    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Process removals
      for (const itemId of itemIds) {
        try {
          await this.databaseService.removeItemFromCart(itemId);
          results.push({
            success: true,
            itemId,
            data: { removed: true }
          });
        } catch (error) {
          this.logger.error(`Failed to remove item ${itemId}:`, error.message);
          results.push({
            success: false,
            itemId,
            error: error.message
          });
          errors.push(`Item ${itemId}: ${error.message}`);
        }
      }

      return {
        success: results.some(r => r.success),
        totalItems: itemIds.length,
        successfulItems: results.filter(r => r.success).length,
        failedItems: results.filter(r => !r.success).length,
        results,
        errors
      };

    } catch (error) {
      this.logger.error('Bulk remove operation failed:', error.message);
      throw new BadRequestException(`Bulk remove operation failed: ${error.message}`);
    }
  }

  /**
   * Update quantities for multiple items
   */
  async updateMultipleItems(
    cartId: string,
    updates: Array<{ itemId: string; updateData: UpdateItemDto }>,
    sessionContext: SessionContext
  ): Promise<BulkOperationsResponseDto> {
    const results: BulkOperationResult[] = [];
    const errors: string[] = [];

    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Process updates
      for (const update of updates) {
        try {
          const result = await this.databaseService.updateCartItem(update.itemId, update.updateData);
          results.push({
            success: true,
            itemId: update.itemId,
            data: result
          });
        } catch (error) {
          this.logger.error(`Failed to update item ${update.itemId}:`, error.message);
          results.push({
            success: false,
            itemId: update.itemId,
            error: error.message
          });
          errors.push(`Item ${update.itemId}: ${error.message}`);
        }
      }

      return {
        success: results.some(r => r.success),
        totalItems: updates.length,
        successfulItems: results.filter(r => r.success).length,
        failedItems: results.filter(r => !r.success).length,
        results,
        errors
      };

    } catch (error) {
      this.logger.error('Bulk update operation failed:', error.message);
      throw new BadRequestException(`Bulk update operation failed: ${error.message}`);
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(cartId: string, sessionContext: SessionContext): Promise<BulkOperationsResponseDto> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get item count before clearing
      const itemCount = await this.databaseService.prisma.cartItem.count({
        where: { cartId }
      });

      // Clear cart
      await this.databaseService.clearCart(cartId);

      return {
        success: true,
        totalItems: itemCount,
        successfulItems: itemCount,
        failedItems: 0,
        results: [{
          success: true,
          data: { cleared: true, itemCount }
        }],
        errors: []
      };

    } catch (error) {
      this.logger.error('Clear cart operation failed:', error.message);
      throw new BadRequestException(`Clear cart operation failed: ${error.message}`);
    }
  }

  /**
   * Get bulk operation statistics
   */
  async getBulkOperationStats(cartId: string, sessionContext: SessionContext) {
    try {
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: true,
          session: true
        }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      return {
        cartId,
        totalItems: cart.items.length,
        totalValue: cart.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0),
        lastUpdated: cart.updatedAt,
        status: cart.status
      };

    } catch (error) {
      this.logger.error('Failed to get bulk operation stats:', error.message);
      throw new BadRequestException(`Failed to get stats: ${error.message}`);
    }
  }
}
