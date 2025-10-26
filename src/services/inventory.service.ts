import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ProductClient } from '../clients/product.client';
import { DatabaseService } from '../database/database.service';
import { InventoryStatus } from '../types/product-integration.types';

export interface InventoryReservation {
    id: string;
    productId: string;
    variantId?: string;
    quantity: number;
    cartId: string;
    sessionId: string;
    reservedAt: Date;
    expiresAt: Date;
    status: 'active' | 'expired' | 'released';
}

export interface InventoryCheckResult {
    productId: string;
    variantId?: string;
    requestedQuantity: number;
    available: boolean;
    stock: number;
    reserved: number;
    canFulfill: boolean;
    estimatedRestock?: Date;
    warnings: string[];
}

@Injectable()
export class InventoryService {
    private readonly logger = new Logger(InventoryService.name);

    constructor(
        private readonly productClient: ProductClient,
        private readonly databaseService: DatabaseService
    ) { }

    /**
     * Check inventory availability for cart items
     */
    async checkInventoryAvailability(
        items: Array<{ productId: string; variantId?: string; quantity: number }>
    ): Promise<InventoryCheckResult[]> {
        const results: InventoryCheckResult[] = [];

        for (const item of items) {
            try {
                const inventory = await this.productClient.getInventoryStatus(item.productId, item.variantId);
                const warnings: string[] = [];

                // Check if item is in stock
                if (!inventory.isInStock) {
                    warnings.push('Product is out of stock');
                }

                // Check if requested quantity is available
                if (inventory.available < item.quantity) {
                    warnings.push(`Insufficient stock: ${inventory.available} available, ${item.quantity} requested`);
                }

                // Check for low stock
                if (inventory.isLowStock) {
                    warnings.push('Product is running low on stock');
                }

                results.push({
                    productId: item.productId,
                    variantId: item.variantId,
                    requestedQuantity: item.quantity,
                    available: inventory.isInStock && inventory.available >= item.quantity,
                    stock: inventory.stock,
                    reserved: inventory.reserved,
                    canFulfill: inventory.available >= item.quantity,
                    estimatedRestock: inventory.estimatedRestock,
                    warnings
                });

            } catch (error) {
                this.logger.error(`Failed to check inventory for ${item.productId}:`, error.message);
                results.push({
                    productId: item.productId,
                    variantId: item.variantId,
                    requestedQuantity: item.quantity,
                    available: false,
                    stock: 0,
                    reserved: 0,
                    canFulfill: false,
                    warnings: [`Inventory check failed: ${error.message}`]
                });
            }
        }

        return results;
    }

    /**
     * Reserve inventory for cart items
     */
    async reserveInventory(
        cartId: string,
        sessionId: string,
        items: Array<{ productId: string; variantId?: string; quantity: number }>,
        reservationDuration: number = 15 * 60 * 1000 // 15 minutes
    ): Promise<InventoryReservation[]> {
        const reservations: InventoryReservation[] = [];

        try {
            // Check availability first
            const availability = await this.checkInventoryAvailability(items);

            // Filter items that can be fulfilled
            const fulfillableItems = items.filter((item, index) =>
                availability[index]?.canFulfill
            );

            if (fulfillableItems.length !== items.length) {
                const unavailableItems = items.filter((item, index) =>
                    !availability[index]?.canFulfill
                );
                throw new BadRequestException(
                    `Cannot reserve inventory for items: ${unavailableItems.map(i => i.productId).join(', ')}`
                );
            }

            // Create reservations
            for (const item of fulfillableItems) {
                const reservation: InventoryReservation = {
                    id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    cartId,
                    sessionId,
                    reservedAt: new Date(),
                    expiresAt: new Date(Date.now() + reservationDuration),
                    status: 'active'
                };

                // Store reservation in database
                await this.databaseService.prisma.cartMetadata.create({
                    data: {
                        cartId,
                        key: `inventory_reservation_${reservation.id}`,
                        value: JSON.stringify(reservation)
                    }
                });

                reservations.push(reservation);
            }

            this.logger.log(`Created ${reservations.length} inventory reservations for cart ${cartId}`);
            return reservations;

        } catch (error) {
            this.logger.error('Failed to reserve inventory:', error.message);
            throw new BadRequestException(`Inventory reservation failed: ${error.message}`);
        }
    }

    /**
     * Release inventory reservations
     */
    async releaseInventoryReservations(cartId: string): Promise<void> {
        try {
            // Get all reservations for the cart
            const reservations = await this.databaseService.prisma.cartMetadata.findMany({
                where: {
                    cartId,
                    key: { startsWith: 'inventory_reservation_' }
                }
            });

            // Mark reservations as released
            for (const reservation of reservations) {
                const reservationData = JSON.parse(reservation.value);
                reservationData.status = 'released';
                reservationData.releasedAt = new Date();

                await this.databaseService.prisma.cartMetadata.update({
                    where: { id: reservation.id },
                    data: { value: JSON.stringify(reservationData) }
                });
            }

            this.logger.log(`Released ${reservations.length} inventory reservations for cart ${cartId}`);

        } catch (error) {
            this.logger.error('Failed to release inventory reservations:', error.message);
            throw new BadRequestException(`Failed to release inventory: ${error.message}`);
        }
    }

    /**
     * Check for expired reservations and clean them up
     */
    async cleanupExpiredReservations(): Promise<number> {
        try {
            const now = new Date();
            const expiredReservations = await this.databaseService.prisma.cartMetadata.findMany({
                where: {
                    key: { startsWith: 'inventory_reservation_' }
                }
            });

            let cleanedCount = 0;

            for (const reservation of expiredReservations) {
                const reservationData = JSON.parse(reservation.value);
                const expiresAt = new Date(reservationData.expiresAt);

                if (expiresAt < now && reservationData.status === 'active') {
                    reservationData.status = 'expired';
                    reservationData.expiredAt = new Date();

                    await this.databaseService.prisma.cartMetadata.update({
                        where: { id: reservation.id },
                        data: { value: JSON.stringify(reservationData) }
                    });

                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                this.logger.log(`Cleaned up ${cleanedCount} expired inventory reservations`);
            }

            return cleanedCount;

        } catch (error) {
            this.logger.error('Failed to cleanup expired reservations:', error.message);
            return 0;
        }
    }

    /**
     * Get inventory status for a product
     */
    async getInventoryStatus(productId: string, variantId?: string): Promise<InventoryStatus> {
        try {
            return await this.productClient.getInventoryStatus(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get inventory status for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get inventory status: ${error.message}`);
        }
    }

    /**
     * Get low stock products
     */
    async getLowStockProducts(limit: number = 50): Promise<Array<{
        productId: string;
        variantId?: string;
        stock: number;
        lowStockThreshold: number;
        isLowStock: boolean;
    }>> {
        try {
            // This would typically query the product service for low stock items
            // For now, we'll return an empty array as this requires product service integration
            return [];
        } catch (error) {
            this.logger.error('Failed to get low stock products:', error.message);
            return [];
        }
    }

    /**
     * Get inventory analytics
     */
    async getInventoryAnalytics(): Promise<{
        totalProducts: number;
        inStockProducts: number;
        outOfStockProducts: number;
        lowStockProducts: number;
        totalValue: number;
    }> {
        try {
            // This would typically aggregate inventory data from the product service
            // For now, we'll return mock data
            return {
                totalProducts: 0,
                inStockProducts: 0,
                outOfStockProducts: 0,
                lowStockProducts: 0,
                totalValue: 0
            };
        } catch (error) {
            this.logger.error('Failed to get inventory analytics:', error.message);
            return {
                totalProducts: 0,
                inStockProducts: 0,
                outOfStockProducts: 0,
                lowStockProducts: 0,
                totalValue: 0
            };
        }
    }

    /**
     * Validate inventory before checkout
     */
    async validateInventoryForCheckout(
        items: Array<{ productId: string; variantId?: string; quantity: number }>
    ): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        unavailableItems: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const unavailableItems: string[] = [];

        try {
            const availability = await this.checkInventoryAvailability(items);

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const availabilityResult = availability[i];

                if (!availabilityResult.available) {
                    errors.push(`Product ${item.productId} is not available`);
                    unavailableItems.push(item.productId);
                }

                if (!availabilityResult.canFulfill) {
                    errors.push(`Insufficient stock for product ${item.productId}`);
                    unavailableItems.push(item.productId);
                }

                if (availabilityResult.warnings.length > 0) {
                    warnings.push(...availabilityResult.warnings.map(w => `${item.productId}: ${w}`));
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                unavailableItems
            };

        } catch (error) {
            this.logger.error('Inventory validation for checkout failed:', error.message);
            return {
                isValid: false,
                errors: [`Inventory validation failed: ${error.message}`],
                warnings: [],
                unavailableItems: items.map(item => item.productId)
            };
        }
    }
}
