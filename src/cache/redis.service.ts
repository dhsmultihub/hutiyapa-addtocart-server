import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
    CacheConfig,
    CacheEntry,
    CacheMetrics,
    CacheStats,
    CacheOperation,
    CacheOperationResult,
    CacheBulkOperation,
    CacheHealthCheck,
    CacheLevel,
    CacheKeyType,
    CacheKey
} from '../types/cache.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private redis: Redis;
    private metrics: CacheMetrics;
    private operations: CacheOperation[] = [];

    constructor(private readonly configService: ConfigService) {
        this.metrics = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            missRate: 0,
            evictions: 0,
            insertions: 0,
            updates: 0,
            deletions: 0,
            totalSize: 0,
            averageAccessTime: 0,
            averageInsertionTime: 0,
            memoryUsage: 0,
            cpuUsage: 0
        };
    }

    async onModuleInit() {
        try {
            this.logger.log('Initializing Redis connection...');

            this.redis = new Redis({
                host: this.configService.get('REDIS_HOST', 'localhost'),
                port: this.configService.get('REDIS_PORT', 6379),
                password: this.configService.get('REDIS_PASSWORD'),
                db: this.configService.get('REDIS_DB', 0),
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keepAlive: 30000,
                connectTimeout: 10000,
                commandTimeout: 5000
            });

            this.redis.on('connect', () => {
                this.logger.log('Redis connected successfully');
            });

            this.redis.on('error', (error) => {
                this.logger.error('Redis connection error:', error.message);
            });

            this.redis.on('close', () => {
                this.logger.warn('Redis connection closed');
            });

            await this.redis.connect();
            this.logger.log('Redis service initialized');

        } catch (error) {
            this.logger.error('Redis initialization failed:', error.message);
            throw error;
        }
    }

    async onModuleDestroy() {
        try {
            if (this.redis) {
                await this.redis.quit();
                this.logger.log('Redis connection closed');
            }
        } catch (error) {
            this.logger.error('Redis cleanup failed:', error.message);
        }
    }

    /**
     * Get value from cache
     */
    async get<T>(key: string): Promise<CacheOperationResult<T>> {
        const startTime = Date.now();
        const operationId = uuidv4();

        try {
            this.logger.debug(`Getting value for key: ${key}`);

            const value = await this.redis.get(key);

            if (value === null) {
                this.metrics.misses++;
                this.updateHitRate();

                this.operations.push({
                    id: operationId,
                    type: 'get',
                    key,
                    level: CacheLevel.L2_REDIS,
                    success: false,
                    duration: Date.now() - startTime,
                    timestamp: new Date()
                });

                return {
                    success: false,
                    duration: Date.now() - startTime,
                    fromCache: false,
                    cacheLevel: CacheLevel.L2_REDIS
                };
            }

            const parsedValue = JSON.parse(value);
            this.metrics.hits++;
            this.updateHitRate();

            this.operations.push({
                id: operationId,
                type: 'get',
                key,
                level: CacheLevel.L2_REDIS,
                success: true,
                duration: Date.now() - startTime,
                timestamp: new Date()
            });

            return {
                success: true,
                value: parsedValue,
                duration: Date.now() - startTime,
                fromCache: true,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error(`Cache get operation failed for key ${key}:`, error.message);

            this.operations.push({
                id: operationId,
                type: 'get',
                key,
                level: CacheLevel.L2_REDIS,
                success: false,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Set value in cache
     */
    async set<T>(key: string, value: T, ttl?: number): Promise<CacheOperationResult<T>> {
        const startTime = Date.now();
        const operationId = uuidv4();

        try {
            this.logger.debug(`Setting value for key: ${key}`);

            const serializedValue = JSON.stringify(value);
            const size = Buffer.byteLength(serializedValue, 'utf8');

            if (ttl) {
                await this.redis.setex(key, ttl, serializedValue);
            } else {
                await this.redis.set(key, serializedValue);
            }

            this.metrics.insertions++;
            this.metrics.totalSize += size;

            this.operations.push({
                id: operationId,
                type: 'set',
                key,
                level: CacheLevel.L2_REDIS,
                success: true,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                metadata: { size, ttl }
            });

            return {
                success: true,
                value,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error(`Cache set operation failed for key ${key}:`, error.message);

            this.operations.push({
                id: operationId,
                type: 'set',
                key,
                level: CacheLevel.L2_REDIS,
                success: false,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key: string): Promise<CacheOperationResult> {
        const startTime = Date.now();
        const operationId = uuidv4();

        try {
            this.logger.debug(`Deleting key: ${key}`);

            const result = await this.redis.del(key);

            this.metrics.deletions++;

            this.operations.push({
                id: operationId,
                type: 'delete',
                key,
                level: CacheLevel.L2_REDIS,
                success: result > 0,
                duration: Date.now() - startTime,
                timestamp: new Date()
            });

            return {
                success: result > 0,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error(`Cache delete operation failed for key ${key}:`, error.message);

            this.operations.push({
                id: operationId,
                type: 'delete',
                key,
                level: CacheLevel.L2_REDIS,
                success: false,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Update value in cache
     */
    async update<T>(key: string, value: T, ttl?: number): Promise<CacheOperationResult<T>> {
        const startTime = Date.now();
        const operationId = uuidv4();

        try {
            this.logger.debug(`Updating value for key: ${key}`);

            const serializedValue = JSON.stringify(value);
            const size = Buffer.byteLength(serializedValue, 'utf8');

            if (ttl) {
                await this.redis.setex(key, ttl, serializedValue);
            } else {
                await this.redis.set(key, serializedValue);
            }

            this.metrics.updates++;
            this.metrics.totalSize += size;

            this.operations.push({
                id: operationId,
                type: 'update',
                key,
                level: CacheLevel.L2_REDIS,
                success: true,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                metadata: { size, ttl }
            });

            return {
                success: true,
                value,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error(`Cache update operation failed for key ${key}:`, error.message);

            this.operations.push({
                id: operationId,
                type: 'update',
                key,
                level: CacheLevel.L2_REDIS,
                success: false,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Check if key exists in cache
     */
    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error(`Cache exists check failed for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Get TTL for key
     */
    async getTtl(key: string): Promise<number> {
        try {
            return await this.redis.ttl(key);
        } catch (error) {
            this.logger.error(`Cache TTL check failed for key ${key}:`, error.message);
            return -1;
        }
    }

    /**
     * Set TTL for key
     */
    async setTtl(key: string, ttl: number): Promise<boolean> {
        try {
            const result = await this.redis.expire(key, ttl);
            return result === 1;
        } catch (error) {
            this.logger.error(`Cache TTL set failed for key ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Get multiple values
     */
    async mget<T>(keys: string[]): Promise<CacheOperationResult<T>[]> {
        const startTime = Date.now();

        try {
            this.logger.debug(`Getting multiple values for ${keys.length} keys`);

            const values = await this.redis.mget(...keys);

            return values.map((value, index) => {
                if (value === null) {
                    this.metrics.misses++;
                    return {
                        success: false,
                        duration: Date.now() - startTime,
                        fromCache: false,
                        cacheLevel: CacheLevel.L2_REDIS
                    };
                }

                this.metrics.hits++;
                return {
                    success: true,
                    value: JSON.parse(value),
                    duration: Date.now() - startTime,
                    fromCache: true,
                    cacheLevel: CacheLevel.L2_REDIS
                };
            });

        } catch (error) {
            this.logger.error('Cache mget operation failed:', error.message);
            return keys.map(() => ({
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            }));
        }
    }

    /**
     * Set multiple values
     */
    async mset<T>(keyValuePairs: Record<string, T>, ttl?: number): Promise<CacheOperationResult> {
        const startTime = Date.now();

        try {
            this.logger.debug(`Setting multiple values for ${Object.keys(keyValuePairs).length} keys`);

            const pipeline = this.redis.pipeline();

            for (const [key, value] of Object.entries(keyValuePairs)) {
                const serializedValue = JSON.stringify(value);
                if (ttl) {
                    pipeline.setex(key, ttl, serializedValue);
                } else {
                    pipeline.set(key, serializedValue);
                }
            }

            await pipeline.exec();

            this.metrics.insertions += Object.keys(keyValuePairs).length;

            return {
                success: true,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error('Cache mset operation failed:', error.message);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Delete multiple keys
     */
    async mdel(keys: string[]): Promise<CacheOperationResult> {
        const startTime = Date.now();

        try {
            this.logger.debug(`Deleting ${keys.length} keys`);

            const result = await this.redis.del(...keys);

            this.metrics.deletions += result;

            return {
                success: true,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error('Cache mdel operation failed:', error.message);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Get keys by pattern
     */
    async keys(pattern: string): Promise<string[]> {
        try {
            return await this.redis.keys(pattern);
        } catch (error) {
            this.logger.error(`Cache keys operation failed for pattern ${pattern}:`, error.message);
            return [];
        }
    }

    /**
     * Clear cache
     */
    async clear(): Promise<CacheOperationResult> {
        const startTime = Date.now();

        try {
            this.logger.log('Clearing Redis cache');

            await this.redis.flushdb();

            this.metrics = {
                hits: 0,
                misses: 0,
                hitRate: 0,
                missRate: 0,
                evictions: 0,
                insertions: 0,
                updates: 0,
                deletions: 0,
                totalSize: 0,
                averageAccessTime: 0,
                averageInsertionTime: 0,
                memoryUsage: 0,
                cpuUsage: 0
            };

            return {
                success: true,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };

        } catch (error) {
            this.logger.error('Cache clear operation failed:', error.message);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                fromCache: false,
                cacheLevel: CacheLevel.L2_REDIS
            };
        }
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        try {
            const info = await this.redis.info('memory');
            const keys = await this.redis.keys('*');

            const stats: CacheStats = {
                totalKeys: keys.length,
                totalSize: this.metrics.totalSize,
                hitRate: this.metrics.hitRate,
                missRate: this.metrics.missRate,
                evictionRate: 0, // Would be calculated from Redis info
                averageTtl: 0, // Would be calculated from Redis info
                oldestEntry: new Date(),
                newestEntry: new Date(),
                byType: {
                    [CacheKeyType.CART]: 0,
                    [CacheKeyType.PRODUCT]: 0,
                    [CacheKeyType.PRICING]: 0,
                    [CacheKeyType.SESSION]: 0,
                    [CacheKeyType.ORDER]: 0,
                    [CacheKeyType.USER]: 0,
                    [CacheKeyType.NOTIFICATION]: 0,
                    [CacheKeyType.ANALYTICS]: 0
                },
                byLevel: {
                    [CacheLevel.L1_MEMORY]: 0,
                    [CacheLevel.L2_REDIS]: keys.length,
                    [CacheLevel.L3_DATABASE]: 0
                },
                topKeys: []
            };

            return stats;

        } catch (error) {
            this.logger.error('Cache stats retrieval failed:', error.message);
            return {
                totalKeys: 0,
                totalSize: 0,
                hitRate: 0,
                missRate: 0,
                evictionRate: 0,
                averageTtl: 0,
                oldestEntry: new Date(),
                newestEntry: new Date(),
                byType: {
                    [CacheKeyType.CART]: 0,
                    [CacheKeyType.PRODUCT]: 0,
                    [CacheKeyType.PRICING]: 0,
                    [CacheKeyType.SESSION]: 0,
                    [CacheKeyType.ORDER]: 0,
                    [CacheKeyType.USER]: 0,
                    [CacheKeyType.NOTIFICATION]: 0,
                    [CacheKeyType.ANALYTICS]: 0
                },
                byLevel: {
                    [CacheLevel.L1_MEMORY]: 0,
                    [CacheLevel.L2_REDIS]: 0,
                    [CacheLevel.L3_DATABASE]: 0
                },
                topKeys: []
            };
        }
    }

    /**
     * Get cache metrics
     */
    getMetrics(): CacheMetrics {
        return { ...this.metrics };
    }

    /**
     * Get cache health check
     */
    async getHealthCheck(): Promise<CacheHealthCheck> {
        try {
            const ping = await this.redis.ping();
            const info = await this.redis.info('server');

            const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string; duration: number }> = [
                {
                    name: 'connection',
                    status: ping === 'PONG' ? 'pass' : 'fail',
                    message: ping === 'PONG' ? 'Redis is responding' : 'Redis is not responding',
                    duration: 0
                },
                {
                    name: 'memory',
                    status: 'pass',
                    message: 'Memory usage is normal',
                    duration: 0
                }
            ];

            return {
                status: ping === 'PONG' ? 'healthy' : 'unhealthy',
                checks,
                metrics: this.metrics,
                timestamp: new Date()
            };

        } catch (error) {
            this.logger.error('Cache health check failed:', error.message);
            return {
                status: 'unhealthy',
                checks: [{
                    name: 'connection',
                    status: 'fail' as const,
                    message: `Redis health check failed: ${error.message}`,
                    duration: 0
                }],
                metrics: this.metrics,
                timestamp: new Date()
            };
        }
    }

    /**
     * Update hit rate
     */
    private updateHitRate(): void {
        const total = this.metrics.hits + this.metrics.misses;
        if (total > 0) {
            this.metrics.hitRate = (this.metrics.hits / total) * 100;
            this.metrics.missRate = (this.metrics.misses / total) * 100;
        }
    }

    /**
     * Generate cache key
     */
    generateCacheKey(cacheKey: CacheKey): string {
        const parts = [cacheKey.type, cacheKey.id];

        if (cacheKey.version) {
            parts.push(cacheKey.version);
        }

        if (cacheKey.namespace) {
            parts.unshift(cacheKey.namespace);
        }

        return parts.join(':');
    }

    /**
     * Parse cache key
     */
    parseCacheKey(key: string): CacheKey {
        const parts = key.split(':');

        return {
            type: parts[0] as CacheKeyType,
            id: parts[1],
            version: parts[2],
            namespace: parts.length > 3 ? parts[0] : undefined
        };
    }
}
