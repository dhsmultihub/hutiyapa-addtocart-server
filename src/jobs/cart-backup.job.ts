import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { CartPersistenceService } from '../session/cart-persistence.service';
import {
    CartBackupJob,
    CartBackup
} from '../types/session.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CartBackupJob {
    private readonly logger = new Logger(CartBackupJob.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly cartPersistenceService: CartPersistenceService
    ) { }

    /**
     * Run cart backup job every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async runCartBackupJob(): Promise<void> {
        try {
            this.logger.log('Starting cart backup job');

            const jobId = uuidv4();
            const job: CartBackupJob = {
                id: jobId,
                sessionId: 'system',
                cartId: 'system',
                backupType: 'scheduled',
                status: 'running',
                startedAt: new Date(),
                backupSize: 0,
                metadata: {
                    jobType: 'scheduled_backup',
                    triggeredBy: 'cron'
                }
            };

            // Log job start
            await this.logBackupJob(job);

            let processedCount = 0;
            let errorCount = 0;

            try {
                // Get all active sessions
                const activeSessions = await this.databaseService.session.findMany({
                    where: {
                        status: 'active',
                        expiresAt: { gt: new Date() }
                    },
                    include: {
                        cart: true
                    }
                });

                // Process each session
                for (const session of activeSessions) {
                    try {
                        if (session.cart) {
                            // Create backup for this session's cart
                            await this.createSessionBackup(session.id, session.cart.id);
                            processedCount++;
                        }
                    } catch (error) {
                        this.logger.error(`Backup failed for session ${session.id}:`, error.message);
                        errorCount++;
                    }
                }

                // Update job status
                job.status = 'completed';
                job.completedAt = new Date();
                job.backupSize = processedCount;
                job.metadata = {
                    ...job.metadata,
                    processedCount,
                    errorCount,
                    completedAt: new Date()
                };

                await this.logBackupJob(job);

                this.logger.log(`Cart backup job completed: ${processedCount} sessions processed, ${errorCount} errors`);

            } catch (error) {
                this.logger.error('Cart backup job failed:', error.message);

                job.status = 'failed';
                job.completedAt = new Date();
                job.metadata = {
                    ...job.metadata,
                    error: error.message,
                    failedAt: new Date()
                };

                await this.logBackupJob(job);
            }

        } catch (error) {
            this.logger.error('Cart backup job execution failed:', error.message);
        }
    }

    /**
     * Run cart cleanup job daily
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async runCartCleanupJob(): Promise<void> {
        try {
            this.logger.log('Starting cart cleanup job');

            const jobId = uuidv4();
            const job: CartBackupJob = {
                id: jobId,
                sessionId: 'system',
                cartId: 'system',
                backupType: 'scheduled',
                status: 'running',
                startedAt: new Date(),
                backupSize: 0,
                metadata: {
                    jobType: 'cleanup',
                    triggeredBy: 'cron'
                }
            };

            // Log job start
            await this.logBackupJob(job);

            let processedCount = 0;
            let errorCount = 0;

            try {
                // Clean up expired snapshots
                const expiredSnapshots = await this.cartPersistenceService.cleanupExpiredSnapshots();
                processedCount += expiredSnapshots;

                // Clean up old backups
                const oldBackups = await this.cartPersistenceService.cleanupOldBackups();
                processedCount += oldBackups;

                // Update job status
                job.status = 'completed';
                job.completedAt = new Date();
                job.backupSize = processedCount;
                job.metadata = {
                    ...job.metadata,
                    processedCount,
                    errorCount,
                    expiredSnapshots,
                    oldBackups,
                    completedAt: new Date()
                };

                await this.logBackupJob(job);

                this.logger.log(`Cart cleanup job completed: ${processedCount} items cleaned up`);

            } catch (error) {
                this.logger.error('Cart cleanup job failed:', error.message);

                job.status = 'failed';
                job.completedAt = new Date();
                job.metadata = {
                    ...job.metadata,
                    error: error.message,
                    failedAt: new Date()
                };

                await this.logBackupJob(job);
            }

        } catch (error) {
            this.logger.error('Cart cleanup job execution failed:', error.message);
        }
    }

    /**
     * Create backup for a specific session
     */
    async createSessionBackup(sessionId: string, cartId: string): Promise<CartBackup> {
        try {
            // Get current cart data
            const cart = await this.databaseService.cart.findUnique({
                where: { id: cartId },
                include: {
                    items: true,
                    metadata: true
                }
            });

            if (!cart) {
                throw new Error(`Cart not found: ${cartId}`);
            }

            // Create backup data
            const backupData = {
                items: cart.items.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    price: item.price,
                    originalPrice: item.originalPrice,
                    addedAt: item.addedAt,
                    metadata: item.metadata
                })),
                totals: {
                    subtotal: 0, // Would be calculated
                    tax: 0,
                    discount: 0,
                    total: 0,
                    itemCount: cart.items.length,
                    currency: 'USD'
                },
                metadata: this.extractCartMetadata(cart),
                lastModified: new Date()
            };

            // Create backup record
            const backupId = uuidv4();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

            const backup: CartBackup = {
                id: backupId,
                sessionId,
                cartId,
                userId: cart.userId,
                backupData,
                backupType: 'automatic',
                createdAt: now,
                expiresAt,
                metadata: {
                    backupSize: JSON.stringify(backupData).length,
                    itemCount: cart.items.length,
                    createdBy: 'backup_job'
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

            this.logger.log(`Backup created for session ${sessionId}, cart ${cartId}`);
            return backup;

        } catch (error) {
            this.logger.error(`Backup creation failed for session ${sessionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract cart metadata
     */
    private extractCartMetadata(cart: any): Record<string, any> {
        const metadata: Record<string, any> = {};

        // Extract metadata from cart metadata array
        if (cart.metadata) {
            cart.metadata.forEach((meta: any) => {
                metadata[meta.key] = meta.value;
            });
        }

        // Add computed metadata
        metadata.totalItems = cart.items?.length || 0;
        metadata.totalQuantity = cart.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
        metadata.lastModified = new Date().toISOString();
        metadata.backupCreated = new Date().toISOString();

        return metadata;
    }

    /**
     * Log backup job execution
     */
    private async logBackupJob(job: CartBackupJob): Promise<void> {
        try {
            // This would typically log to a jobs table
            // For now, just log to console
            this.logger.log(`Backup job ${job.id}: ${job.status} - ${job.metadata?.processedCount || 0} processed`);
        } catch (error) {
            this.logger.error('Failed to log backup job:', error.message);
        }
    }

    /**
     * Get backup job history
     */
    async getBackupJobHistory(limit: number = 50): Promise<CartBackupJob[]> {
        try {
            // This would typically query a jobs table
            // For now, return empty array
            return [];

        } catch (error) {
            this.logger.error('Backup job history retrieval failed:', error.message);
            return [];
        }
    }

    /**
     * Get backup statistics
     */
    async getBackupStatistics(): Promise<any> {
        try {
            const [
                totalBackups,
                recentBackups,
                backupSize
            ] = await Promise.all([
                this.databaseService.cartBackup.count(),
                this.databaseService.cartBackup.count({
                    where: {
                        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }
                }),
                this.databaseService.cartBackup.aggregate({
                    _sum: {
                        // Would sum backup sizes if we had that field
                    }
                })
            ]);

            return {
                totalBackups,
                recentBackups,
                averageBackupSize: 0, // Would calculate from backup sizes
                lastBackupAt: new Date() // Would get from latest backup
            };

        } catch (error) {
            this.logger.error('Backup statistics retrieval failed:', error.message);
            return {
                totalBackups: 0,
                recentBackups: 0,
                averageBackupSize: 0,
                lastBackupAt: null
            };
        }
    }

    /**
     * Manual backup trigger
     */
    async triggerManualBackup(sessionId: string, cartId: string): Promise<CartBackup> {
        try {
            this.logger.log(`Manual backup triggered for session ${sessionId}, cart ${cartId}`);

            const jobId = uuidv4();
            const job: CartBackupJob = {
                id: jobId,
                sessionId,
                cartId,
                backupType: 'manual',
                status: 'running',
                startedAt: new Date(),
                backupSize: 0,
                metadata: {
                    jobType: 'manual_backup',
                    triggeredBy: 'user'
                }
            };

            await this.logBackupJob(job);

            const backup = await this.createSessionBackup(sessionId, cartId);

            job.status = 'completed';
            job.completedAt = new Date();
            job.backupSize = JSON.stringify(backup.backupData).length;
            job.metadata = {
                ...job.metadata,
                backupId: backup.id,
                completedAt: new Date()
            };

            await this.logBackupJob(job);

            this.logger.log(`Manual backup completed: ${backup.id}`);
            return backup;

        } catch (error) {
            this.logger.error('Manual backup failed:', error.message);
            throw error;
        }
    }
}
