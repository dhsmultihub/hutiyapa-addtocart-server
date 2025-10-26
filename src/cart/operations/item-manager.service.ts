import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SessionContext } from '../../types/cart.types';

export interface SavedItem {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  savedAt: Date;
  notes?: string;
}

export interface ItemCustomization {
  itemId: string;
  customizations: Record<string, any>;
  notes?: string;
}

@Injectable()
export class ItemManagerService {
  private readonly logger = new Logger(ItemManagerService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Move item to "Saved for Later"
   */
  async moveToSavedForLater(
    itemId: string,
    cartId: string,
    sessionContext: SessionContext,
    notes?: string
  ): Promise<SavedItem> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get the item
      const item = await this.databaseService.prisma.cartItem.findUnique({
        where: { id: itemId }
      });

      if (!item || item.cartId !== cartId) {
        throw new NotFoundException('Item not found in cart');
      }

      // Create saved item
      const savedItem = await this.databaseService.prisma.cartMetadata.create({
        data: {
          cartId,
          key: 'saved_item',
          value: JSON.stringify({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: Number(item.price),
            originalPrice: item.originalPrice,
            savedAt: new Date().toISOString(),
            notes
          })
        }
      });

      // Remove from cart
      await this.databaseService.removeItemFromCart(itemId);

      this.logger.log(`Item ${itemId} moved to saved for later`);

      return {
        id: savedItem.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: Number(item.price),
        savedAt: new Date(),
        notes
      };

    } catch (error) {
      this.logger.error('Failed to move item to saved for later:', error.message);
      throw new BadRequestException(`Failed to move item: ${error.message}`);
    }
  }

  /**
   * Restore item from "Saved for Later"
   */
  async restoreFromSavedForLater(
    savedItemId: string,
    cartId: string,
    sessionContext: SessionContext
  ): Promise<any> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get saved item metadata
      const savedItemMetadata = await this.databaseService.prisma.cartMetadata.findUnique({
        where: { id: savedItemId }
      });

      if (!savedItemMetadata || savedItemMetadata.cartId !== cartId) {
        throw new NotFoundException('Saved item not found');
      }

      const savedItemData = JSON.parse(savedItemMetadata.value);

      // Add item back to cart
      const restoredItem = await this.databaseService.prisma.cartItem.create({
        data: {
          cartId,
          productId: savedItemData.productId,
          variantId: savedItemData.variantId,
          quantity: savedItemData.quantity,
          price: savedItemData.price,
          originalPrice: savedItemData.originalPrice
        }
      });

      // Remove from saved items
      await this.databaseService.prisma.cartMetadata.delete({
        where: { id: savedItemId }
      });

      this.logger.log(`Item restored from saved for later: ${restoredItem.id}`);

      return restoredItem;

    } catch (error) {
      this.logger.error('Failed to restore item from saved for later:', error.message);
      throw new BadRequestException(`Failed to restore item: ${error.message}`);
    }
  }

  /**
   * Duplicate item in cart
   */
  async duplicateItem(
    itemId: string,
    cartId: string,
    sessionContext: SessionContext,
    quantity?: number
  ): Promise<any> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get the original item
      const originalItem = await this.databaseService.prisma.cartItem.findUnique({
        where: { id: itemId }
      });

      if (!originalItem || originalItem.cartId !== cartId) {
        throw new NotFoundException('Item not found in cart');
      }

      // Create duplicate
      const duplicatedItem = await this.databaseService.prisma.cartItem.create({
        data: {
          cartId,
          productId: originalItem.productId,
          variantId: originalItem.variantId,
          quantity: quantity || originalItem.quantity,
          price: originalItem.price,
          originalPrice: originalItem.originalPrice
        }
      });

      this.logger.log(`Item ${itemId} duplicated as ${duplicatedItem.id}`);

      return duplicatedItem;

    } catch (error) {
      this.logger.error('Failed to duplicate item:', error.message);
      throw new BadRequestException(`Failed to duplicate item: ${error.message}`);
    }
  }

  /**
   * Add item customization
   */
  async addItemCustomization(
    itemId: string,
    cartId: string,
    customization: ItemCustomization,
    sessionContext: SessionContext
  ): Promise<any> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get the item
      const item = await this.databaseService.prisma.cartItem.findUnique({
        where: { id: itemId }
      });

      if (!item || item.cartId !== cartId) {
        throw new NotFoundException('Item not found in cart');
      }

      // Store customization as metadata
      const customizationMetadata = await this.databaseService.prisma.cartMetadata.upsert({
        where: {
          cartId_key: {
            cartId,
            key: `customization_${itemId}`
          }
        },
        update: {
          value: JSON.stringify({
            customizations: customization.customizations,
            notes: customization.notes,
            updatedAt: new Date().toISOString()
          })
        },
        create: {
          cartId,
          key: `customization_${itemId}`,
          value: JSON.stringify({
            customizations: customization.customizations,
            notes: customization.notes,
            createdAt: new Date().toISOString()
          })
        }
      });

      this.logger.log(`Customization added for item ${itemId}`);

      return {
        itemId,
        customization: JSON.parse(customizationMetadata.value)
      };

    } catch (error) {
      this.logger.error('Failed to add item customization:', error.message);
      throw new BadRequestException(`Failed to add customization: ${error.message}`);
    }
  }

  /**
   * Get saved items for a cart
   */
  async getSavedItems(cartId: string, sessionContext: SessionContext): Promise<SavedItem[]> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get saved items metadata
      const savedItemsMetadata = await this.databaseService.prisma.cartMetadata.findMany({
        where: {
          cartId,
          key: 'saved_item'
        }
      });

      return savedItemsMetadata.map(metadata => {
        const data = JSON.parse(metadata.value);
        return {
          id: metadata.id,
          productId: data.productId,
          variantId: data.variantId,
          quantity: data.quantity,
          price: data.price,
          savedAt: new Date(data.savedAt),
          notes: data.notes
        };
      });

    } catch (error) {
      this.logger.error('Failed to get saved items:', error.message);
      throw new BadRequestException(`Failed to get saved items: ${error.message}`);
    }
  }

  /**
   * Get item customizations
   */
  async getItemCustomizations(cartId: string, sessionContext: SessionContext): Promise<ItemCustomization[]> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Get customization metadata
      const customizationsMetadata = await this.databaseService.prisma.cartMetadata.findMany({
        where: {
          cartId,
          key: { startsWith: 'customization_' }
        }
      });

      return customizationsMetadata.map(metadata => {
        const data = JSON.parse(metadata.value);
        const itemId = metadata.key.replace('customization_', '');
        return {
          itemId,
          customizations: data.customizations,
          notes: data.notes
        };
      });

    } catch (error) {
      this.logger.error('Failed to get item customizations:', error.message);
      throw new BadRequestException(`Failed to get customizations: ${error.message}`);
    }
  }

  /**
   * Handle item expiration
   */
  async handleItemExpiration(cartId: string, sessionContext: SessionContext): Promise<{
    expiredItems: string[];
    removedCount: number;
  }> {
    try {
      // Validate cart access
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { session: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Find expired items (older than 30 days)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - 30);

      const expiredItems = await this.databaseService.prisma.cartItem.findMany({
        where: {
          cartId,
          addedAt: { lt: expirationDate }
        }
      });

      const expiredItemIds = expiredItems.map(item => item.id);

      // Remove expired items
      if (expiredItemIds.length > 0) {
        await this.databaseService.prisma.cartItem.deleteMany({
          where: {
            id: { in: expiredItemIds }
          }
        });
      }

      this.logger.log(`Removed ${expiredItemIds.length} expired items from cart ${cartId}`);

      return {
        expiredItems: expiredItemIds,
        removedCount: expiredItemIds.length
      };

    } catch (error) {
      this.logger.error('Failed to handle item expiration:', error.message);
      throw new BadRequestException(`Failed to handle expiration: ${error.message}`);
    }
  }
}
