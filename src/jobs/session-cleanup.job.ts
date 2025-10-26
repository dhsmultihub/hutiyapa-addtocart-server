import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { SessionService } from '../session/session.service';
import { DeviceSyncService } from '../session/device-sync.service';
import {
    SessionCleanupJob
} from '../types/session.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionCleanupJob {
    private readonly logger = new Logger(SessionCleanupJob.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly sessionService: SessionService,
        private readonly deviceSyncService: DeviceSyncService
    ) { }

    /**
     * Run session cleanup job every 6 hours
     */
    @Cron(CronExpression.EVERY_6_HOURS)
    async runSessionCleanupJob(): Promise<void> {
        try {
            this.logger.log('Starting session cleanup job');

            const jobId = uuidv4();
            const job: SessionCleanupJob = {
                id: jobId,
                jobType: 'expired_sessions',
                status: 'running',
                startedAt: new Date(),
                processedCount: 0,
                errorCount: 0,
                metadata: {
                    triggeredBy: 'cron',
                    cleanupType: 'expired_sessions'
                }
            };

            // Log job start
            await this.logCleanupJob(job);

            let processedCount = 0;
            let errorCount = 0;

            try {
                // Clean up expired sessions
                const expiredSessions = await this.sessionService.cleanupExpiredSessions();
                processedCount += expiredSessions;

                // Clean up old sync records
                const oldSyncs = await this.deviceSyncService.cleanupOldSyncs();
                processedCount += oldSyncs;

                // Clean up orphaned cart data
                const orphanedCarts = await this.cleanupOrphanedCarts();
                processedCount += orphanedCarts;

                // Update job status
                job.status = 'completed';
                job.completedAt = new Date();
                job.processedCount = processedCount;
                job.errorCount = errorCount;
                job.metadata = {
                    ...job.metadata,
                    expiredSessions,
                    oldSyncs,
                    orphanedCarts,
                    completedAt: new Date()
                };

                await this.logCleanupJob(job);

                this.logger.log(`Session cleanup job completed: ${processedCount} items processed, ${errorCount} errors`);

            } catch (error) {
                this.logger.error('Session cleanup job failed:', error.message);

                job.status = 'failed';
                job.completedAt = new Date();
                job.errorCount = 1;
                job.metadata = {
                    ...job.metadata,
                    error: error.message,
                    failedAt: new Date()
                };

                await this.logCleanupJob(job);
            }

        } catch (error) {
            this.logger.error('Session cleanup job execution failed:', error.message);
        }
    }

    /**
     * Run deep cleanup job weekly
     */
    @Cron(CronExpression.EVERY_WEEK)
    async runDeepCleanupJob(): Promise<void> {
        try {
            this.logger.log('Starting deep cleanup job');

            const jobId = uuidv4();
            const job: SessionCleanupJob = {
                id: jobId,
                jobType: 'orphaned_carts',
                status: 'running',
                startedAt: new Date(),
                processedCount: 0,
                errorCount: 0,
                metadata: {
                    triggeredBy: 'cron',
                    cleanupType: 'deep_cleanup'
                }
            };

            // Log job start
            await this.logCleanupJob(job);

            let processedCount = 0;
            let errorCount = 0;

            try {
                // Clean up orphaned cart data
                const orphanedCarts = await this.cleanupOrphanedCarts();
                processedCount += orphanedCarts;

                // Clean up old session data
                const oldSessions = await this.cleanupOldSessions();
                processedCount += oldSessions;

                // Clean up old cart snapshots
                const oldSnapshots = await this.cleanupOldSnapshots();
                processedCount += oldSnapshots;

                // Clean up old backups
                const oldBackups = await this.cleanupOldBackups();
                processedCount += oldBackups;

                // Update job status
                job.status = 'completed';
                job.completedAt = new Date();
                job.processedCount = processedCount;
                job.errorCount = errorCount;
                job.metadata = {
                    ...job.metadata,
                    orphanedCarts,
                    oldSessions,
                    oldSnapshots,
                    oldBackups,
                    completedAt: new Date()
                };

                await this.logCleanupJob(job);

                this.logger.log(`Deep cleanup job completed: ${processedCount} items processed, ${errorCount} errors`);

            } catch (error) {
                this.logger.error('Deep cleanup job failed:', error.message);

                job.status = 'failed';
                job.completedAt = new Date();
                job.errorCount = 1;
                job.metadata = {
                    ...job.metadata,
                    error: error.message,
                    failedAt: new Date()
                };

                await this.logCleanupJob(job);
            }

        } catch (error) {
            this.logger.error('Deep cleanup job execution failed:', error.message);
        }
    }

    /**
     * Clean up orphaned cart data
     */
    private async cleanupOrphanedCarts(): Promise<number> {
        try {
            this.logger.log('Cleaning up orphaned cart data');

            // Find carts without active sessions
            const orphanedCarts = await this.databaseService.cart.findMany({
                where: {
                    session: {
                        status: { not: 'active' }
                    }
                }
            });

            let cleanedCount = 0;
            for (const cart of orphanedCarts) {
                try {
                    // Delete cart items
                    await this.databaseService.cartItem.deleteMany({
                        where: { cartId: cart.id }
                    });

                    // Delete cart metadata
                    await this.databaseService.cartMetadata.deleteMany({
                        where: { cartId: cart.id }
                    });

                    // Delete cart
                    await this.databaseService.cart.delete({
                        where: { id: cart.id }
                    });

                    cleanedCount++;
                } catch (error) {
                    this.logger.error(`Failed to clean up cart ${cart.id}:`, error.message);
                }
            }

            this.logger.log(`Cleaned up ${cleanedCount} orphaned carts`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Orphaned carts cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Clean up old sessions
     */
    private async cleanupOldSessions(): Promise<number> {
        try {
            this.logger.log('Cleaning up old sessions');

            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

            const oldSessions = await this.databaseService.session.findMany({
                where: {
                    createdAt: { lt: cutoffDate },
                    status: { in: ['expired', 'terminated'] }
                }
            });

            let cleanedCount = 0;
            for (const session of oldSessions) {
                try {
                    // Delete session
                    await this.databaseService.session.delete({
                        where: { id: session.id }
                    });

                    cleanedCount++;
                } catch (error) {
                    this.logger.error(`Failed to clean up session ${session.id}:`, error.message);
                }
            }

            this.logger.log(`Cleaned up ${cleanedCount} old sessions`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Old sessions cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Clean up old cart snapshots
     */
    private async cleanupOldSnapshots(): Promise<number> {
        try {
            this.logger.log('Cleaning up old cart snapshots');

            const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

            const oldSnapshots = await this.databaseService.cartSnapshot.findMany({
                where: {
                    createdAt: { lt: cutoffDate }
                }
            });

            let cleanedCount = 0;
            for (const snapshot of oldSnapshots) {
                try {
                    // Delete snapshot
                    await this.databaseService.cartSnapshot.delete({
                        where: { id: snapshot.id }
                    });

                    cleanedCount++;
                } catch (error) {
                    this.logger.error(`Failed to clean up snapshot ${snapshot.id}:`, error.message);
                }
            }

            this.logger.log(`Cleaned up ${cleanedCount} old snapshots`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Old snapshots cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Clean up old backups
     */
    private async cleanupOldBackups(): Promise<number> {
        try {
            this.logger.log('Cleaning up old backups');

            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

            const oldBackups = await this.databaseService.cartBackup.findMany({
                where: {
                    createdAt: { lt: cutoffDate }
                }
            });

            let cleanedCount = 0;
            for (const backup of oldBackups) {
                try {
                    // Delete backup
                    await this.databaseService.cartBackup.delete({
                        where: { id: backup.id }
                    });

                    cleanedCount++;
                } catch (error) {
                    this.logger.error(`Failed to clean up backup ${backup.id}:`, error.message);
                }
            }

            this.logger.log(`Cleaned up ${cleanedCount} old backups`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Old backups cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Log cleanup job execution
     */
    private async logCleanupJob(job: SessionCleanupJob): Promise<void> {
        try {
            // This would typically log to a jobs table
            // For now, just log to console
            this.logger.log(`Cleanup job ${job.id}: ${job.status} - ${job.processedCount} processed, ${job.errorCount} errors`);
        } catch (error) {
            this.logger.error('Failed to log cleanup job:', error.message);
        }
    }

    /**
     * Get cleanup job history
     */
    async getCleanupJobHistory(limit: number = 50): Promise<SessionCleanupJob[]> {
        try {
            // This would typically query a jobs table
            // For now, return empty array
            return [];

        } catch (error) {
            this.logger.error('Cleanup job history retrieval failed:', error.message);
            return [];
        }
    }

    /**
     * Get cleanup statistics
     */
    async getCleanupStatistics(): Promise<any> {
        try {
            const [
                totalSessions,
                activeSessions,
                expiredSessions,
                totalCarts,
                totalSnapshots,
                totalBackups
            ] = await Promise.all([
                this.databaseService.session.count(),
                this.databaseService.session.count({
                    where: { status: 'active' }
                }),
                this.databaseService.session.count({
                    where: { status: 'expired' }
                }),
                this.databaseService.cart.count(),
                this.databaseService.cartSnapshot.count(),
                this.databaseService.cartBackup.count()
            ]);

            return {
                sessions: {
                    total: totalSessions,
                    active: activeSessions,
                    expired: expiredSessions
                },
                carts: {
                    total: totalCarts
                },
                snapshots: {
                    total: totalSnapshots
                },
                backups: {
                    total: totalBackups
                },
                lastCleanupAt: new Date() // Would get from latest cleanup job
            };

        } catch (error) {
            this.logger.error('Cleanup statistics retrieval failed:', error.message);
            return {
                sessions: { total: 0, active: 0, expired: 0 },
                carts: { total: 0 },
                snapshots: { total: 0 },
                backups: { total: 0 },
                lastCleanupAt: null
            };
        }
    }

    /**
     * Manual cleanup trigger
     */
    async triggerManualCleanup(cleanupType: 'expired_sessions' | 'orphaned_carts' | 'old_backups'): Promise<number> {
        try {
            this.logger.log(`Manual cleanup triggered: ${cleanupType}`);

            const jobId = uuidv4();
            const job: SessionCleanupJob = {
                id: jobId,
                jobType: cleanupType,
                status: 'running',
                startedAt: new Date(),
                processedCount: 0,
                errorCount: 0,
                metadata: {
                    triggeredBy: 'user',
                    cleanupType
                }
            };

            await this.logCleanupJob(job);

            let processedCount = 0;

            switch (cleanupType) {
                case 'expired_sessions':
                    processedCount = await this.sessionService.cleanupExpiredSessions();
                    break;
                case 'orphaned_carts':
                    processedCount = await this.cleanupOrphanedCarts();
                    break;
                case 'old_backups':
                    processedCount = await this.cleanupOldBackups();
                    break;
                default:
                    throw new Error(`Invalid cleanup type: ${cleanupType}`);
            }

            job.status = 'completed';
            job.completedAt = new Date();
            job.processedCount = processedCount;
            job.metadata = {
                ...job.metadata,
                completedAt: new Date()
            };

            await this.logCleanupJob(job);

            this.logger.log(`Manual cleanup completed: ${processedCount} items processed`);
            return processedCount;

        } catch (error) {
            this.logger.error('Manual cleanup failed:', error.message);
            throw error;
        }
    }
}
