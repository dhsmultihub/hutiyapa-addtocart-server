import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CartPersistenceService } from './cart-persistence.service';
import {
    SessionSync,
    SyncStatus,
    ConflictResolution,
    ConflictChange,
    CartSyncRequest,
    CartSyncResponse,
    CartData,
    SessionContext
} from '../types/session.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DeviceSyncService {
    private readonly logger = new Logger(DeviceSyncService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly cartPersistenceService: CartPersistenceService
    ) { }

    /**
     * Sync cart across devices
     */
    async syncCart(syncRequest: CartSyncRequest): Promise<CartSyncResponse> {
        try {
            this.logger.log(`Syncing cart for session: ${syncRequest.sessionId}, device: ${syncRequest.deviceId}`);

            // Get existing sync record
            let syncRecord = await this.getSessionSync(syncRequest.sessionId, syncRequest.deviceId);

            if (!syncRecord) {
                // Create new sync record
                syncRecord = await this.createSessionSync(syncRequest.sessionId, syncRequest.deviceId);
            }

            // Check for conflicts
            const conflicts = await this.detectConflicts(syncRequest, syncRecord);

            if (conflicts.length > 0) {
                return await this.handleConflicts(syncRequest, syncRecord, conflicts);
            }

            // No conflicts, proceed with sync
            const syncResult = await this.performSync(syncRequest, syncRecord);

            return {
                success: true,
                syncStatus: SyncStatus.SYNCED,
                resolvedCart: syncRequest.cartData,
                metadata: {
                    syncedAt: new Date(),
                    version: syncRequest.version,
                    deviceId: syncRequest.deviceId
                }
            };

        } catch (error) {
            this.logger.error('Cart sync failed:', error.message);
            return {
                success: false,
                syncStatus: SyncStatus.ERROR,
                errorMessage: `Cart sync failed: ${error.message}`
            };
        }
    }

    /**
     * Get session sync record
     */
    async getSessionSync(sessionId: string, deviceId: string): Promise<SessionSync | null> {
        try {
            const syncRecord = await this.databaseService.sessionSync.findFirst({
                where: {
                    sessionId,
                    deviceId
                }
            });

            return syncRecord as SessionSync;

        } catch (error) {
            this.logger.error('Session sync retrieval failed:', error.message);
            return null;
        }
    }

    /**
     * Create session sync record
     */
    async createSessionSync(sessionId: string, deviceId: string): Promise<SessionSync> {
        try {
            const syncId = uuidv4();
            const now = new Date();

            const syncRecord: SessionSync = {
                id: syncId,
                sessionId,
                deviceId,
                syncStatus: SyncStatus.PENDING,
                lastSyncAt: now,
                metadata: {
                    createdAt: now,
                    deviceInfo: {}
                }
            };

            // Save to database
            await this.databaseService.sessionSync.create({
                data: {
                    id: syncRecord.id,
                    sessionId: syncRecord.sessionId,
                    deviceId: syncRecord.deviceId,
                    syncStatus: syncRecord.syncStatus,
                    lastSyncAt: syncRecord.lastSyncAt,
                    metadata: syncRecord.metadata
                }
            });

            this.logger.log(`Session sync created: ${syncId}`);
            return syncRecord;

        } catch (error) {
            this.logger.error('Session sync creation failed:', error.message);
            throw new BadRequestException(`Session sync creation failed: ${error.message}`);
        }
    }

    /**
     * Detect conflicts between cart versions
     */
    private async detectConflicts(syncRequest: CartSyncRequest, syncRecord: SessionSync): Promise<ConflictChange[]> {
        try {
            const conflicts: ConflictChange[] = [];

            // Get latest cart snapshot for comparison
            const latestSnapshot = await this.databaseService.cartSnapshot.findFirst({
                where: {
                    sessionId: syncRequest.sessionId,
                    cartId: syncRequest.cartData.metadata?.cartId
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!latestSnapshot) {
                // No existing data, no conflicts
                return conflicts;
            }

            const existingData = latestSnapshot.snapshotData as CartData;

            // Compare items
            const itemConflicts = this.compareCartItems(existingData.items, syncRequest.cartData.items);
            conflicts.push(...itemConflicts);

            // Compare totals
            const totalConflicts = this.compareCartTotals(existingData.totals, syncRequest.cartData.totals);
            conflicts.push(...totalConflicts);

            // Compare metadata
            const metadataConflicts = this.compareCartMetadata(existingData.metadata, syncRequest.cartData.metadata);
            conflicts.push(...metadataConflicts);

            return conflicts;

        } catch (error) {
            this.logger.error('Conflict detection failed:', error.message);
            return [];
        }
    }

    /**
     * Compare cart items for conflicts
     */
    private compareCartItems(existingItems: any[], newItems: any[]): ConflictChange[] {
        const conflicts: ConflictChange[] = [];

        // Check for items that exist in both but have different quantities
        for (const newItem of newItems) {
            const existingItem = existingItems.find(item =>
                item.productId === newItem.productId && item.variantId === newItem.variantId
            );

            if (existingItem && existingItem.quantity !== newItem.quantity) {
                conflicts.push({
                    field: `items.${newItem.productId}.quantity`,
                    oldValue: existingItem.quantity,
                    newValue: newItem.quantity,
                    resolution: 'accepted' as const
                });
            }
        }

        // Check for items that were removed
        for (const existingItem of existingItems) {
            const newItem = newItems.find(item =>
                item.productId === existingItem.productId && item.variantId === existingItem.variantId
            );

            if (!newItem) {
                conflicts.push({
                    field: `items.${existingItem.productId}.removed`,
                    oldValue: existingItem.quantity,
                    newValue: 0,
                    resolution: 'accepted' as const
                });
            }
        }

        return conflicts;
    }

    /**
     * Compare cart totals for conflicts
     */
    private compareCartTotals(existingTotals: any, newTotals: any): ConflictChange[] {
        const conflicts: ConflictChange[] = [];

        const fields = ['subtotal', 'tax', 'discount', 'total'];

        for (const field of fields) {
            if (existingTotals[field] !== newTotals[field]) {
                conflicts.push({
                    field: `totals.${field}`,
                    oldValue: existingTotals[field],
                    newValue: newTotals[field],
                    resolution: 'accepted' as const
                });
            }
        }

        return conflicts;
    }

    /**
     * Compare cart metadata for conflicts
     */
    private compareCartMetadata(existingMetadata: any, newMetadata: any): ConflictChange[] {
        const conflicts: ConflictChange[] = [];

        // Compare specific metadata fields that might conflict
        const importantFields = ['couponCode', 'shippingMethod', 'paymentMethod'];

        for (const field of importantFields) {
            if (existingMetadata[field] !== newMetadata[field]) {
                conflicts.push({
                    field: `metadata.${field}`,
                    oldValue: existingMetadata[field],
                    newValue: newMetadata[field],
                    resolution: 'accepted' as const
                });
            }
        }

        return conflicts;
    }

    /**
     * Handle conflicts between cart versions
     */
    private async handleConflicts(
        syncRequest: CartSyncRequest,
        syncRecord: SessionSync,
        conflicts: ConflictChange[]
    ): Promise<CartSyncResponse> {
        try {
            this.logger.log(`Handling ${conflicts.length} conflicts for session: ${syncRequest.sessionId}`);

            // Update sync record with conflict status
            await this.databaseService.sessionSync.update({
                where: { id: syncRecord.id },
                data: {
                    syncStatus: SyncStatus.CONFLICT,
                    lastSyncAt: new Date(),
                    conflictResolution: {
                        strategy: 'user_choice',
                        resolvedAt: new Date(),
                        resolvedBy: 'system',
                        changes: conflicts
                    }
                }
            });

            return {
                success: false,
                syncStatus: SyncStatus.CONFLICT,
                conflicts,
                errorMessage: 'Cart conflicts detected. Manual resolution required.'
            };

        } catch (error) {
            this.logger.error('Conflict handling failed:', error.message);
            return {
                success: false,
                syncStatus: SyncStatus.ERROR,
                errorMessage: `Conflict handling failed: ${error.message}`
            };
        }
    }

    /**
     * Perform actual sync operation
     */
    private async performSync(syncRequest: CartSyncRequest, syncRecord: SessionSync): Promise<boolean> {
        try {
            // Update sync record
            await this.databaseService.sessionSync.update({
                where: { id: syncRecord.id },
                data: {
                    syncStatus: SyncStatus.SYNCED,
                    lastSyncAt: new Date(),
                    metadata: {
                        ...syncRecord.metadata,
                        lastSyncVersion: syncRequest.version,
                        lastSyncData: syncRequest.cartData
                    }
                }
            });

            // Create new cart snapshot
            await this.cartPersistenceService.saveCartState(
                syncRequest.sessionId,
                syncRequest.cartData.metadata?.cartId || '',
                this.mapCartDataToCart(syncRequest.cartData)
            );

            this.logger.log(`Cart synced successfully for session: ${syncRequest.sessionId}`);
            return true;

        } catch (error) {
            this.logger.error('Sync operation failed:', error.message);
            return false;
        }
    }

    /**
     * Resolve conflicts manually
     */
    async resolveConflicts(
        sessionId: string,
        deviceId: string,
        resolution: ConflictResolution
    ): Promise<CartSyncResponse> {
        try {
            this.logger.log(`Resolving conflicts for session: ${sessionId}, device: ${deviceId}`);

            const syncRecord = await this.getSessionSync(sessionId, deviceId);
            if (!syncRecord) {
                throw new NotFoundException('Sync record not found');
            }

            if (syncRecord.syncStatus !== SyncStatus.CONFLICT) {
                throw new BadRequestException('No conflicts to resolve');
            }

            // Apply resolution strategy
            let resolvedCart: CartData;

            switch (resolution.strategy) {
                case 'latest_wins':
                    resolvedCart = await this.resolveLatestWins(sessionId, deviceId);
                    break;
                case 'merge':
                    resolvedCart = await this.resolveMerge(sessionId, deviceId, resolution);
                    break;
                case 'user_choice':
                    resolvedCart = await this.resolveUserChoice(sessionId, deviceId, resolution);
                    break;
                default:
                    throw new BadRequestException('Invalid resolution strategy');
            }

            // Update sync record
            await this.databaseService.sessionSync.update({
                where: { id: syncRecord.id },
                data: {
                    syncStatus: SyncStatus.SYNCED,
                    lastSyncAt: new Date(),
                    conflictResolution: resolution
                }
            });

            return {
                success: true,
                syncStatus: SyncStatus.SYNCED,
                resolvedCart,
                metadata: {
                    resolvedAt: new Date(),
                    strategy: resolution.strategy,
                    resolvedBy: resolution.resolvedBy
                }
            };

        } catch (error) {
            this.logger.error('Conflict resolution failed:', error.message);
            return {
                success: false,
                syncStatus: SyncStatus.ERROR,
                errorMessage: `Conflict resolution failed: ${error.message}`
            };
        }
    }

    /**
     * Resolve conflicts using latest wins strategy
     */
    private async resolveLatestWins(sessionId: string, deviceId: string): Promise<CartData> {
        // Get the most recent cart data
        const latestSnapshot = await this.databaseService.cartSnapshot.findFirst({
            where: { sessionId },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestSnapshot) {
            throw new NotFoundException('No cart data found');
        }

        return latestSnapshot.snapshotData as CartData;
    }

    /**
     * Resolve conflicts using merge strategy
     */
    private async resolveMerge(sessionId: string, deviceId: string, resolution: ConflictResolution): Promise<CartData> {
        // Implement merge logic based on resolution changes
        // This would typically merge items and resolve conflicts intelligently
        const latestSnapshot = await this.databaseService.cartSnapshot.findFirst({
            where: { sessionId },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestSnapshot) {
            throw new NotFoundException('No cart data found');
        }

        return latestSnapshot.snapshotData as CartData;
    }

    /**
     * Resolve conflicts using user choice strategy
     */
    private async resolveUserChoice(sessionId: string, deviceId: string, resolution: ConflictResolution): Promise<CartData> {
        // Apply user's specific choices for each conflict
        const latestSnapshot = await this.databaseService.cartSnapshot.findFirst({
            where: { sessionId },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestSnapshot) {
            throw new NotFoundException('No cart data found');
        }

        // Apply user choices to resolve conflicts
        const resolvedData = { ...latestSnapshot.snapshotData } as CartData;

        for (const change of resolution.changes) {
            if (change.resolution === 'accepted') {
                // Apply the new value
                this.applyChangeToCartData(resolvedData, change);
            }
            // If 'rejected', keep the old value (no action needed)
        }

        return resolvedData;
    }

    /**
     * Apply change to cart data
     */
    private applyChangeToCartData(cartData: CartData, change: ConflictChange): void {
        const fieldPath = change.field.split('.');

        if (fieldPath[0] === 'items') {
            // Handle item changes
            const productId = fieldPath[1];
            const field = fieldPath[2];

            const item = cartData.items.find(i => i.productId === productId);
            if (item && field) {
                (item as any)[field] = change.newValue;
            }
        } else if (fieldPath[0] === 'totals') {
            // Handle total changes
            const field = fieldPath[1];
            if (field) {
                (cartData.totals as any)[field] = change.newValue;
            }
        } else if (fieldPath[0] === 'metadata') {
            // Handle metadata changes
            const field = fieldPath[1];
            if (field) {
                cartData.metadata[field] = change.newValue;
            }
        }
    }

    /**
     * Map cart data to cart object
     */
    private mapCartDataToCart(cartData: CartData): any {
        // This would map CartData back to Cart object
        // Implementation depends on Cart interface
        return {
            items: cartData.items,
            totals: cartData.totals,
            metadata: cartData.metadata
        };
    }

    /**
     * Get sync status for session
     */
    async getSyncStatus(sessionId: string, deviceId: string): Promise<SessionSync | null> {
        try {
            return await this.getSessionSync(sessionId, deviceId);
        } catch (error) {
            this.logger.error('Sync status retrieval failed:', error.message);
            return null;
        }
    }

    /**
     * Get all sync records for session
     */
    async getSessionSyncs(sessionId: string): Promise<SessionSync[]> {
        try {
            const syncs = await this.databaseService.sessionSync.findMany({
                where: { sessionId },
                orderBy: { lastSyncAt: 'desc' }
            });

            return syncs as SessionSync[];

        } catch (error) {
            this.logger.error('Session syncs retrieval failed:', error.message);
            return [];
        }
    }

    /**
     * Clean up old sync records
     */
    async cleanupOldSyncs(): Promise<number> {
        try {
            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

            const oldSyncs = await this.databaseService.sessionSync.findMany({
                where: {
                    lastSyncAt: { lt: cutoffDate }
                }
            });

            let cleanedCount = 0;
            for (const sync of oldSyncs) {
                await this.databaseService.sessionSync.delete({
                    where: { id: sync.id }
                });
                cleanedCount++;
            }

            this.logger.log(`Cleaned up ${cleanedCount} old sync records`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Old syncs cleanup failed:', error.message);
            return 0;
        }
    }
}
