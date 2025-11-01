import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import {
    CartSnapshot,
    CartData,
    CartItemData,
    CartTotalsData,
    CartBackup,
    SessionContext
} from '../types/session.types';
import { Cart, CartItem } from '../types/cart.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CartPersistenceService {
    private readonly logger = new Logger(CartPersistenceService.name);
    private readonly autoSaveInterval = 30000; // 30 seconds
    private readonly maxBackups = 10;
    private readonly backupRetentionDays = 30;

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly cartService: CartService
    ) { }

    /**
     * Auto-save cart state
     */
    async autoSaveCart(sessionId: string, cartId: string): Promise<void> {
        try {
            this.logger.log(`Auto-saving cart: ${cartId} for session: ${sessionId}`);

            // Get current cart
            const cart = await this.cartService.getCartById(cartId);
            if (!cart) {
                this.logger.warn(`Cart not found for auto-save: ${cartId}`);
                return;
            }

            // Create cart snapshot
            const snapshot = await this.createCartSnapshot(sessionId, cartId, cart);

            // Create backup if needed
            await this.createCartBackup(sessionId, cartId, snapshot);

            this.logger.log(`Cart auto-saved: ${cartId}`);

        } catch (error) {
            this.logger.error('Cart auto-save failed:', error.message);
        }
    }

    /**
     * Save cart state manually
     */
    async saveCartState(sessionId: string, cartId: string, cart: Cart): Promise<CartSnapshot> {
        try {
            this.logger.log(`Manually saving cart: ${cartId} for session: ${sessionId}`);

            const snapshot = await this.createCartSnapshot(sessionId, cartId, cart);

            this.logger.log(`Cart state saved: ${cartId}`);
            return snapshot;

        } catch (error) {
            this.logger.error('Cart state save failed:', error.message);
            throw new BadRequestException(`Cart state save failed: ${error.message}`);
        }
    }

    /**
     * Recover cart from last saved state
     */
    async recoverCart(sessionId: string, cartId: string): Promise<CartData | null> {
        try {
            this.logger.log(`Recovering cart: ${cartId} for session: ${sessionId}`);

            // Get latest snapshot
            const snapshot = await this.databaseService.cartSnapshot.findFirst({
                where: {
                    sessionId,
                    cartId
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!snapshot) {
                this.logger.warn(`No snapshot found for cart: ${cartId}`);
                return null;
            }

            // Check if snapshot is expired
            if (snapshot.expiresAt < new Date()) {
                this.logger.warn(`Cart snapshot expired: ${snapshot.id}`);
                return null;
            }

            this.logger.log(`Cart recovered from snapshot: ${snapshot.id}`);
            return snapshot.snapshotData as CartData;

        } catch (error) {
            this.logger.error('Cart recovery failed:', error.message);
            return null;
        }
    }

    /**
     * Get cart snapshots for session
     */
    async getCartSnapshots(sessionId: string, cartId?: string): Promise<CartSnapshot[]> {
        try {
            const where: any = { sessionId };
            if (cartId) {
                where.cartId = cartId;
            }

            const snapshots = await this.databaseService.cartSnapshot.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: this.maxBackups
            });

            return snapshots as CartSnapshot[];

        } catch (error) {
            this.logger.error('Cart snapshots retrieval failed:', error.message);
            return [];
        }
    }

    /**
     * Restore cart from snapshot
     */
    async restoreCartFromSnapshot(sessionId: string, snapshotId: string): Promise<boolean> {
        try {
            this.logger.log(`Restoring cart from snapshot: ${snapshotId}`);

            const snapshot = await this.databaseService.cartSnapshot.findUnique({
                where: { id: snapshotId }
            });

            if (!snapshot) {
                throw new NotFoundException(`Snapshot with ID ${snapshotId} not found`);
            }

            if (snapshot.sessionId !== sessionId) {
                throw new BadRequestException('Snapshot does not belong to this session');
            }

            if (snapshot.expiresAt < new Date()) {
                throw new BadRequestException('Snapshot has expired');
            }

            // Get current cart
            const cart = await this.cartService.getCartById(snapshot.cartId);
            if (!cart) {
                throw new NotFoundException(`Cart with ID ${snapshot.cartId} not found`);
            }

            // Restore cart items from snapshot
            await this.restoreCartItems(cart.id, snapshot.snapshotData);

            this.logger.log(`Cart restored from snapshot: ${snapshotId}`);
            return true;

        } catch (error) {
            this.logger.error('Cart restoration failed:', error.message);
            return false;
        }
    }

    /**
     * Create cart snapshot
     */
    private async createCartSnapshot(sessionId: string, cartId: string, cart: Cart): Promise<CartSnapshot> {
        try {
            const snapshotId = uuidv4();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const cartData: CartData = {
                items: cart.items.map(item => this.mapCartItemToData(item)),
                totals: {
                    subtotal: cart.totals.subtotal,
                    tax: cart.totals.tax,
                    discount: cart.totals.discount,
                    total: cart.totals.total,
                    itemCount: cart.totals.itemCount,
                    currency: 'USD'
                },
                metadata: this.extractCartMetadata(cart),
                lastModified: now
            };

            const snapshot: CartSnapshot = {
                id: snapshotId,
                sessionId,
                cartId,
                userId: cart.userId,
                snapshotData: cartData,
                version: 1,
                createdAt: now,
                expiresAt,
                metadata: {
                    autoGenerated: true,
                    cartItemCount: cart.items.length
                }
            };

            // Save snapshot to database
            await this.databaseService.cartSnapshot.create({
                data: {
                    id: snapshot.id,
                    sessionId: snapshot.sessionId,
                    cartId: snapshot.cartId,
                    userId: snapshot.userId,
                    snapshotData: snapshot.snapshotData,
                    version: snapshot.version,
                    createdAt: snapshot.createdAt,
                    expiresAt: snapshot.expiresAt,
                    metadata: snapshot.metadata
                }
            });

            return snapshot;

        } catch (error) {
            this.logger.error('Cart snapshot creation failed:', error.message);
            throw new BadRequestException(`Cart snapshot creation failed: ${error.message}`);
        }
    }

    /**
     * Create cart backup
     */
    private async createCartBackup(sessionId: string, cartId: string, snapshot: CartSnapshot): Promise<void> {
        try {
            // Check if backup is needed (e.g., daily backup)
            const lastBackup = await this.databaseService.cartBackup.findFirst({
                where: {
                    sessionId,
                    cartId,
                    backupType: 'automatic'
                },
                orderBy: { createdAt: 'desc' }
            });

            const shouldBackup = !lastBackup ||
                (Date.now() - lastBackup.createdAt.getTime()) > 24 * 60 * 60 * 1000; // 24 hours

            if (!shouldBackup) {
                return;
            }

            const backupId = uuidv4();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.backupRetentionDays * 24 * 60 * 60 * 1000);

            const backup: CartBackup = {
                id: backupId,
                sessionId,
                cartId,
                userId: snapshot.userId,
                backupData: snapshot.snapshotData,
                backupType: 'automatic',
                createdAt: now,
                expiresAt,
                metadata: {
                    snapshotId: snapshot.id,
                    version: snapshot.version
                }
            };

            // Save backup to database
            await this.databaseService.cartBackup.create({
                data: {
                    id: backup.id,
                    sessionId: backup.sessionId,
                    cartId: backup.cartId,
                    userId: backup.userId,
                    backupData: backup.backupData,
                    backupType: backup.backupType,
                    createdAt: backup.createdAt,
                    expiresAt: backup.expiresAt,
                    metadata: backup.metadata
                }
            });

            this.logger.log(`Cart backup created: ${backupId}`);

        } catch (error) {
            this.logger.error('Cart backup creation failed:', error.message);
        }
    }

    /**
     * Restore cart items from snapshot data
     */
    private async restoreCartItems(cartId: string, cartData: CartData): Promise<void> {
        try {
            // Clear existing cart items
            await this.databaseService.cartItem.deleteMany({
                where: { cartId }
            });

            // Add items from snapshot
            for (const itemData of cartData.items) {
                await this.databaseService.cartItem.create({
                    data: {
                        id: uuidv4(),
                        cartId,
                        productId: itemData.productId,
                        variantId: itemData.variantId,
                        quantity: itemData.quantity,
                        price: itemData.price,
                        originalPrice: itemData.originalPrice,
                        addedAt: itemData.addedAt
                    }
                });
            }

        } catch (error) {
            this.logger.error('Cart items restoration failed:', error.message);
            throw new BadRequestException(`Cart items restoration failed: ${error.message}`);
        }
    }

    /**
     * Map cart item to data format
     */
    private mapCartItemToData(item: CartItem): CartItemData {
        return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            originalPrice: item.originalPrice,
            addedAt: item.addedAt,
            metadata: item.metadata
        };
    }

    /**
     * Extract cart metadata
     */
    private extractCartMetadata(cart: Cart): Record<string, any> {
        const metadata: Record<string, any> = {};

        // Extract metadata from cart metadata array
        cart.metadata.forEach(meta => {
            metadata[meta.key] = meta.value;
        });

        // Add computed metadata
        metadata.totalItems = cart.items.length;
        metadata.totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        metadata.lastModified = new Date().toISOString();

        return metadata;
    }

    /**
     * Clean up expired snapshots
     */
    async cleanupExpiredSnapshots(): Promise<number> {
        try {
            const expiredSnapshots = await this.databaseService.cartSnapshot.findMany({
                where: {
                    expiresAt: { lt: new Date() }
                }
            });

            let cleanedCount = 0;
            for (const snapshot of expiredSnapshots) {
                await this.databaseService.cartSnapshot.delete({
                    where: { id: snapshot.id }
                });
                cleanedCount++;
            }

            this.logger.log(`Cleaned up ${cleanedCount} expired snapshots`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Expired snapshots cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Clean up old backups
     */
    async cleanupOldBackups(): Promise<number> {
        try {
            const cutoffDate = new Date(Date.now() - this.backupRetentionDays * 24 * 60 * 60 * 1000);

            const oldBackups = await this.databaseService.cartBackup.findMany({
                where: {
                    createdAt: { lt: cutoffDate }
                }
            });

            let cleanedCount = 0;
            for (const backup of oldBackups) {
                await this.databaseService.cartBackup.delete({
                    where: { id: backup.id }
                });
                cleanedCount++;
            }

            this.logger.log(`Cleaned up ${cleanedCount} old backups`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Old backups cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Get cart backup history
     */
    async getCartBackupHistory(sessionId: string, cartId: string): Promise<CartBackup[]> {
        try {
            const backups = await this.databaseService.cartBackup.findMany({
                where: {
                    sessionId,
                    cartId
                },
                orderBy: { createdAt: 'desc' }
            });

            return backups as CartBackup[];

        } catch (error) {
            this.logger.error('Cart backup history retrieval failed:', error.message);
            return [];
        }
    }

    /**
     * Restore cart from backup
     */
    async restoreCartFromBackup(sessionId: string, backupId: string): Promise<boolean> {
        try {
            this.logger.log(`Restoring cart from backup: ${backupId}`);

            const backup = await this.databaseService.cartBackup.findUnique({
                where: { id: backupId }
            });

            if (!backup) {
                throw new NotFoundException(`Backup with ID ${backupId} not found`);
            }

            if (backup.sessionId !== sessionId) {
                throw new BadRequestException('Backup does not belong to this session');
            }

            if (backup.expiresAt < new Date()) {
                throw new BadRequestException('Backup has expired');
            }

            // Get current cart
            const cart = await this.cartService.getCartById(backup.cartId);
            if (!cart) {
                throw new NotFoundException(`Cart with ID ${backup.cartId} not found`);
            }

            // Restore cart items from backup
            await this.restoreCartItems(cart.id, backup.backupData);

            this.logger.log(`Cart restored from backup: ${backupId}`);
            return true;

        } catch (error) {
            this.logger.error('Cart restoration from backup failed:', error.message);
            return false;
        }
    }
}
