import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { 
  CacheConfig, 
  CacheStrategy, 
  CacheLevel, 
  CacheKeyType,
  CacheKey,
  CacheEntry,
  CacheOperationResult,
  CacheWarmingConfig,
  CacheMetrics
} from '../types/cache.types';

@Injectable()
export class CacheStrategyService {
  private readonly logger = new Logger(CacheStrategyService.name);
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly configs = new Map<CacheKeyType, CacheConfig>();
  private warmingConfigs: CacheWarmingConfig[] = [];

  constructor(private readonly redisService: RedisService) {
    this.initializeDefaultConfigs();
  }

  /**
   * Get value using cache strategy
   */
  async get<T>(cacheKey: CacheKey): Promise<CacheOperationResult<T>> {
    try {
      const key = this.redisService.generateCacheKey(cacheKey);
      const config = this.getConfigForType(cacheKey.type);

      // L1 Cache (Memory) - Check first
      if (config.level === CacheLevel.L1_MEMORY || config.level === CacheLevel.L2_REDIS) {
        const memoryResult = this.getFromMemory<T>(key);
        if (memoryResult.success) {
          this.logger.debug(`Cache hit in L1 memory for key: ${key}`);
          return memoryResult;
        }
      }

      // L2 Cache (Redis) - Check second
      if (config.level === CacheLevel.L2_REDIS || config.level === CacheLevel.L3_DATABASE) {
        const redisResult = await this.redisService.get<T>(key);
        if (redisResult.success) {
          // Store in L1 cache if L1 is available
          const l1Config = this.configs.get(CacheKeyType.CART);
          if (l1Config && l1Config.level === CacheLevel.L1_MEMORY) {
            this.setInMemory(key, redisResult.value, config.ttl);
          }
          this.logger.debug(`Cache hit in L2 Redis for key: ${key}`);
          return redisResult;
        }
      }

      // Cache miss - return failure
      this.logger.debug(`Cache miss for key: ${key}`);
      return {
        success: false,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L3_DATABASE
      };

    } catch (error) {
      this.logger.error(`Cache strategy get failed for key ${cacheKey.id}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L3_DATABASE
      };
    }
  }

  /**
   * Set value using cache strategy
   */
  async set<T>(cacheKey: CacheKey, value: T, ttl?: number): Promise<CacheOperationResult<T>> {
    try {
      const key = this.redisService.generateCacheKey(cacheKey);
      const config = this.getConfigForType(cacheKey.type);
      const effectiveTtl = ttl || config.ttl;

      let result: CacheOperationResult<T>;

      switch (config.strategy) {
        case CacheStrategy.WRITE_THROUGH:
          result = await this.writeThroughStrategy(key, value, effectiveTtl);
          break;
        case CacheStrategy.WRITE_BACK:
          result = await this.writeBackStrategy(key, value, effectiveTtl);
          break;
        case CacheStrategy.WRITE_AROUND:
          result = await this.writeAroundStrategy(key, value, effectiveTtl);
          break;
        default:
          result = await this.cacheAsideStrategy(key, value, effectiveTtl);
      }

      this.logger.debug(`Cache set using ${config.strategy} strategy for key: ${key}`);
      return result;

    } catch (error) {
      this.logger.error(`Cache strategy set failed for key ${cacheKey.id}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L3_DATABASE
      };
    }
  }

  /**
   * Delete value using cache strategy
   */
  async delete(cacheKey: CacheKey): Promise<CacheOperationResult> {
    try {
      const key = this.redisService.generateCacheKey(cacheKey);
      const config = this.getConfigForType(cacheKey.type);

      // Delete from all cache levels
      const results: CacheOperationResult[] = [];

      // Delete from L1 (Memory)
      if (config.level === CacheLevel.L1_MEMORY) {
        const memoryResult = this.deleteFromMemory(key);
        results.push(memoryResult);
      }

      // Delete from L2 (Redis)
      if (config.level === CacheLevel.L2_REDIS) {
        const redisResult = await this.redisService.delete(key);
        results.push(redisResult);
      }

      const success = results.some(result => result.success);
      
      this.logger.debug(`Cache delete for key: ${key}, success: ${success}`);
      return {
        success,
        duration: results.reduce((sum, result) => sum + result.duration, 0),
        fromCache: false,
        cacheLevel: config.level
      };

    } catch (error) {
      this.logger.error(`Cache strategy delete failed for key ${cacheKey.id}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L3_DATABASE
      };
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<CacheOperationResult> {
    try {
      this.logger.log(`Invalidating cache pattern: ${pattern}`);

      // Get keys matching pattern
      const keys = await this.redisService.keys(pattern);
      
      if (keys.length === 0) {
        return {
          success: true,
          duration: 0,
          fromCache: false,
          cacheLevel: CacheLevel.L2_REDIS
        };
      }

      // Delete from Redis
      const redisResult = await this.redisService.mdel(keys);

      // Delete from memory cache
      let memoryDeleted = 0;
      for (const key of keys) {
        if (this.memoryCache.has(key)) {
          this.memoryCache.delete(key);
          memoryDeleted++;
        }
      }

      this.logger.log(`Invalidated ${keys.length} keys (${memoryDeleted} from memory)`);
      return {
        success: redisResult.success,
        duration: redisResult.duration,
        fromCache: false,
        cacheLevel: CacheLevel.L2_REDIS,
        metadata: {
          keysDeleted: keys.length,
          memoryDeleted
        }
      };

    } catch (error) {
      this.logger.error(`Cache pattern invalidation failed for pattern ${pattern}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L2_REDIS
      };
    }
  }

  /**
   * Warm cache with data
   */
  async warmCache(config: CacheWarmingConfig): Promise<CacheOperationResult> {
    try {
      this.logger.log(`Warming cache with config: ${config.name}`);

      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;

      for (const key of config.keys) {
        try {
          // This would typically fetch data from database
          // For now, we'll simulate warming
          const value = { warmed: true, timestamp: new Date() };
          const cacheKey: CacheKey = {
            type: CacheKeyType.CART,
            id: key
          };

          const result = await this.set(cacheKey, value, 3600); // 1 hour TTL
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          this.logger.error(`Cache warming failed for key ${key}:`, error.message);
          errorCount++;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Cache warming completed: ${successCount} success, ${errorCount} errors in ${duration}ms`);

      return {
        success: errorCount === 0,
        duration,
        fromCache: false,
        cacheLevel: CacheLevel.L2_REDIS,
        metadata: {
          successCount,
          errorCount,
          totalKeys: config.keys.length
        }
      };

    } catch (error) {
      this.logger.error(`Cache warming failed for config ${config.name}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L2_REDIS
      };
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const redisMetrics = this.redisService.getMetrics();
    
    return {
      ...redisMetrics,
      memoryUsage: this.calculateMemoryUsage(),
      cpuUsage: 0 // Would be calculated from system metrics
    };
  }

  /**
   * Configure cache for specific type
   */
  configureCache(type: CacheKeyType, config: CacheConfig): void {
    this.configs.set(type, config);
    this.logger.log(`Cache configured for type ${type}: ${config.strategy} strategy`);
  }

  /**
   * Add cache warming configuration
   */
  addWarmingConfig(config: CacheWarmingConfig): void {
    this.warmingConfigs.push(config);
    this.logger.log(`Cache warming config added: ${config.name}`);
  }

  /**
   * Execute cache warming
   */
  async executeWarming(): Promise<void> {
    try {
      this.logger.log('Executing cache warming...');

      for (const config of this.warmingConfigs) {
        if (!config.isActive) continue;

        // Check if warming should run
        if (config.strategy === 'scheduled' && config.nextRun) {
          if (new Date() < config.nextRun) continue;
        }

        await this.warmCache(config);
        
        // Update next run time for scheduled warming
        if (config.strategy === 'scheduled' && config.schedule) {
          // This would calculate next run time based on cron expression
          config.nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        }
      }

      this.logger.log('Cache warming completed');

    } catch (error) {
      this.logger.error('Cache warming execution failed:', error.message);
    }
  }

  /**
   * Write-through strategy
   */
  private async writeThroughStrategy<T>(key: string, value: T, ttl: number): Promise<CacheOperationResult<T>> {
    // Write to all cache levels
    const results: CacheOperationResult<T>[] = [];

    // Write to L1 (Memory)
    this.setInMemory(key, value, ttl);
    results.push({
      success: true,
      value,
      duration: 0,
      fromCache: false,
      cacheLevel: CacheLevel.L1_MEMORY
    });

    // Write to L2 (Redis)
    const redisResult = await this.redisService.set(key, value, ttl);
    results.push(redisResult);

    return {
      success: results.every(result => result.success),
      value,
      duration: results.reduce((sum, result) => sum + result.duration, 0),
      fromCache: false,
      cacheLevel: CacheLevel.L2_REDIS
    };
  }

  /**
   * Write-back strategy
   */
  private async writeBackStrategy<T>(key: string, value: T, ttl: number): Promise<CacheOperationResult<T>> {
    // Write to L1 cache only, L2 will be written later
    this.setInMemory(key, value, ttl);
    
    return {
      success: true,
      value,
      duration: 0,
      fromCache: false,
      cacheLevel: CacheLevel.L1_MEMORY
    };
  }

  /**
   * Write-around strategy
   */
  private async writeAroundStrategy<T>(key: string, value: T, ttl: number): Promise<CacheOperationResult<T>> {
    // Write to L2 (Redis) only, skip L1
    const redisResult = await this.redisService.set(key, value, ttl);
    
    return redisResult;
  }

  /**
   * Cache-aside strategy
   */
  private async cacheAsideStrategy<T>(key: string, value: T, ttl: number): Promise<CacheOperationResult<T>> {
    // Write to L1 and L2
    this.setInMemory(key, value, ttl);
    const redisResult = await this.redisService.set(key, value, ttl);
    
    return redisResult;
  }

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string): CacheOperationResult<T> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return {
        success: false,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L1_MEMORY
      };
    }

    // Check if expired
    if (entry.ttl > 0 && Date.now() - entry.createdAt.getTime() > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return {
        success: false,
        duration: 0,
        fromCache: false,
        cacheLevel: CacheLevel.L1_MEMORY
      };
    }

    // Update access info
    entry.accessedAt = new Date();
    entry.accessCount++;

    return {
      success: true,
      value: entry.value,
      duration: 0,
      fromCache: true,
      cacheLevel: CacheLevel.L1_MEMORY
    };
  }

  /**
   * Set in memory cache
   */
  private setInMemory<T>(key: string, value: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      size: JSON.stringify(value).length,
      compressed: false,
      encrypted: false
    };

    this.memoryCache.set(key, entry);
  }

  /**
   * Delete from memory cache
   */
  private deleteFromMemory(key: string): CacheOperationResult {
    const existed = this.memoryCache.has(key);
    this.memoryCache.delete(key);
    
    return {
      success: existed,
      duration: 0,
      fromCache: false,
      cacheLevel: CacheLevel.L1_MEMORY
    };
  }

  /**
   * Get configuration for cache type
   */
  private getConfigForType(type: CacheKeyType): CacheConfig {
    return this.configs.get(type) || this.getDefaultConfig();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): CacheConfig {
    return {
      level: CacheLevel.L2_REDIS,
      strategy: CacheStrategy.CACHE_ASIDE,
      evictionPolicy: 'lru' as any,
      ttl: 3600, // 1 hour
      maxSize: 1000,
      compression: false,
      encryption: false
    };
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaultConfigs(): void {
    // Cart cache configuration
    this.configureCache(CacheKeyType.CART, {
      level: CacheLevel.L2_REDIS,
      strategy: CacheStrategy.WRITE_THROUGH,
      evictionPolicy: 'lru' as any,
      ttl: 1800, // 30 minutes
      maxSize: 10000,
      compression: true,
      encryption: false
    });

    // Product cache configuration
    this.configureCache(CacheKeyType.PRODUCT, {
      level: CacheLevel.L2_REDIS,
      strategy: CacheStrategy.READ_THROUGH,
      evictionPolicy: 'lru' as any,
      ttl: 3600, // 1 hour
      maxSize: 50000,
      compression: true,
      encryption: false
    });

    // Pricing cache configuration
    this.configureCache(CacheKeyType.PRICING, {
      level: CacheLevel.L2_REDIS,
      strategy: CacheStrategy.WRITE_THROUGH,
      evictionPolicy: 'ttl' as any,
      ttl: 300, // 5 minutes
      maxSize: 10000,
      compression: false,
      encryption: false
    });

    // Session cache configuration
    this.configureCache(CacheKeyType.SESSION, {
      level: CacheLevel.L1_MEMORY,
      strategy: CacheStrategy.WRITE_BACK,
      evictionPolicy: 'lru' as any,
      ttl: 7200, // 2 hours
      maxSize: 1000,
      compression: false,
      encryption: true
    });
  }
}
