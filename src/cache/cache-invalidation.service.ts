import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheStrategyService } from './cache-strategy.service';
import { 
  CacheInvalidationRule,
  CacheKeyType,
  CacheKey,
  CacheOperationResult
} from '../types/cache.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private invalidationRules: CacheInvalidationRule[] = [];
  private invalidationHistory: Array<{
    id: string;
    ruleId: string;
    pattern: string;
    keysInvalidated: number;
    timestamp: Date;
    duration: number;
    success: boolean;
    error?: string;
  }> = [];

  constructor(private readonly cacheStrategyService: CacheStrategyService) {
    this.initializeDefaultRules();
  }

  /**
   * Add invalidation rule
   */
  addInvalidationRule(rule: Omit<CacheInvalidationRule, 'id' | 'createdAt' | 'updatedAt'>): CacheInvalidationRule {
    const newRule: CacheInvalidationRule = {
      id: uuidv4(),
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.invalidationRules.push(newRule);
    this.logger.log(`Invalidation rule added: ${newRule.id}`);
    return newRule;
  }

  /**
   * Remove invalidation rule
   */
  removeInvalidationRule(ruleId: string): boolean {
    const index = this.invalidationRules.findIndex(rule => rule.id === ruleId);
    if (index === -1) {
      return false;
    }

    this.invalidationRules.splice(index, 1);
    this.logger.log(`Invalidation rule removed: ${ruleId}`);
    return true;
  }

  /**
   * Update invalidation rule
   */
  updateInvalidationRule(ruleId: string, updates: Partial<CacheInvalidationRule>): boolean {
    const rule = this.invalidationRules.find(r => r.id === ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates, { updatedAt: new Date() });
    this.logger.log(`Invalidation rule updated: ${ruleId}`);
    return true;
  }

  /**
   * Get all invalidation rules
   */
  getInvalidationRules(): CacheInvalidationRule[] {
    return [...this.invalidationRules];
  }

  /**
   * Get invalidation rule by ID
   */
  getInvalidationRule(ruleId: string): CacheInvalidationRule | undefined {
    return this.invalidationRules.find(rule => rule.id === ruleId);
  }

  /**
   * Invalidate cache by trigger
   */
  async invalidateByTrigger(trigger: string, context?: Record<string, any>): Promise<CacheOperationResult> {
    try {
      this.logger.log(`Processing cache invalidation for trigger: ${trigger}`);

      const startTime = Date.now();
      const applicableRules = this.invalidationRules.filter(rule => 
        rule.isActive && rule.triggers.includes(trigger)
      );

      if (applicableRules.length === 0) {
        this.logger.debug(`No invalidation rules found for trigger: ${trigger}`);
        return {
          success: true,
          duration: Date.now() - startTime,
          fromCache: false,
          cacheLevel: 'l2_redis' as any
        };
      }

      let totalKeysInvalidated = 0;
      const results: CacheOperationResult[] = [];

      for (const rule of applicableRules) {
        try {
          // Check conditions
          if (!this.evaluateConditions(rule.conditions, context)) {
            this.logger.debug(`Rule ${rule.id} conditions not met`);
            continue;
          }

          const result = await this.executeInvalidation(rule);
          results.push(result);
          
          if (result.metadata?.keysInvalidated) {
            totalKeysInvalidated += result.metadata.keysInvalidated;
          }

        } catch (error) {
          this.logger.error(`Invalidation rule ${rule.id} failed:`, error.message);
          results.push({
            success: false,
            error: error.message,
            duration: 0,
            fromCache: false,
            cacheLevel: 'l2_redis' as any
          });
        }
      }

      const duration = Date.now() - startTime;
      const success = results.every(result => result.success);

      // Record invalidation history
      this.recordInvalidationHistory({
        id: uuidv4(),
        ruleId: applicableRules[0]?.id || 'unknown',
        pattern: applicableRules[0]?.pattern || trigger,
        keysInvalidated: totalKeysInvalidated,
        timestamp: new Date(),
        duration,
        success,
        error: success ? undefined : 'Some rules failed'
      });

      this.logger.log(`Cache invalidation completed: ${totalKeysInvalidated} keys invalidated in ${duration}ms`);
      return {
        success,
        duration,
        fromCache: false,
        cacheLevel: 'l2_redis' as any,
        metadata: {
          rulesProcessed: applicableRules.length,
          keysInvalidated: totalKeysInvalidated
        }
      };

    } catch (error) {
      this.logger.error(`Cache invalidation failed for trigger ${trigger}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: 'l2_redis' as any
      };
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<CacheOperationResult> {
    try {
      this.logger.log(`Invalidating cache by pattern: ${pattern}`);

      const startTime = Date.now();
      const result = await this.cacheStrategyService.invalidatePattern(pattern);
      const duration = Date.now() - startTime;

      // Record invalidation history
      this.recordInvalidationHistory({
        id: uuidv4(),
        ruleId: 'manual',
        pattern,
        keysInvalidated: result.metadata?.keysDeleted || 0,
        timestamp: new Date(),
        duration,
        success: result.success,
        error: result.error
      });

      return result;

    } catch (error) {
      this.logger.error(`Cache pattern invalidation failed for pattern ${pattern}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: 'l2_redis' as any
      };
    }
  }

  /**
   * Invalidate cache by cache key
   */
  async invalidateByCacheKey(cacheKey: CacheKey): Promise<CacheOperationResult> {
    try {
      this.logger.log(`Invalidating cache for key: ${cacheKey.type}:${cacheKey.id}`);

      const startTime = Date.now();
      const result = await this.cacheStrategyService.delete(cacheKey);
      const duration = Date.now() - startTime;

      // Record invalidation history
      this.recordInvalidationHistory({
        id: uuidv4(),
        ruleId: 'manual',
        pattern: `${cacheKey.type}:${cacheKey.id}`,
        keysInvalidated: result.success ? 1 : 0,
        timestamp: new Date(),
        duration,
        success: result.success,
        error: result.error
      });

      return result;

    } catch (error) {
      this.logger.error(`Cache key invalidation failed for ${cacheKey.id}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: 'l2_redis' as any
      };
    }
  }

  /**
   * Invalidate cache by type
   */
  async invalidateByType(type: CacheKeyType): Promise<CacheOperationResult> {
    try {
      this.logger.log(`Invalidating cache for type: ${type}`);

      const pattern = `${type}:*`;
      return await this.invalidateByPattern(pattern);

    } catch (error) {
      this.logger.error(`Cache type invalidation failed for type ${type}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: 'l2_redis' as any
      };
    }
  }

  /**
   * Run scheduled cache invalidation
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledInvalidation(): Promise<void> {
    try {
      this.logger.log('Running scheduled cache invalidation');

      const scheduledRules = this.invalidationRules.filter(rule => 
        rule.isActive && rule.triggers.includes('scheduled')
      );

      for (const rule of scheduledRules) {
        try {
          await this.executeInvalidation(rule);
        } catch (error) {
          this.logger.error(`Scheduled invalidation rule ${rule.id} failed:`, error.message);
        }
      }

      this.logger.log('Scheduled cache invalidation completed');

    } catch (error) {
      this.logger.error('Scheduled cache invalidation failed:', error.message);
    }
  }

  /**
   * Get invalidation history
   */
  getInvalidationHistory(limit: number = 100): Array<{
    id: string;
    ruleId: string;
    pattern: string;
    keysInvalidated: number;
    timestamp: Date;
    duration: number;
    success: boolean;
    error?: string;
  }> {
    return this.invalidationHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get invalidation statistics
   */
  getInvalidationStatistics(): {
    totalInvalidations: number;
    successfulInvalidations: number;
    failedInvalidations: number;
    totalKeysInvalidated: number;
    averageDuration: number;
    byRule: Record<string, number>;
    byPattern: Record<string, number>;
    recentActivity: Array<{
      timestamp: Date;
      count: number;
    }>;
  } {
    const totalInvalidations = this.invalidationHistory.length;
    const successfulInvalidations = this.invalidationHistory.filter(h => h.success).length;
    const failedInvalidations = totalInvalidations - successfulInvalidations;
    const totalKeysInvalidated = this.invalidationHistory.reduce((sum, h) => sum + h.keysInvalidated, 0);
    const averageDuration = this.invalidationHistory.reduce((sum, h) => sum + h.duration, 0) / totalInvalidations;

    const byRule = this.invalidationHistory.reduce((acc, h) => {
      acc[h.ruleId] = (acc[h.ruleId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byPattern = this.invalidationHistory.reduce((acc, h) => {
      acc[h.pattern] = (acc[h.pattern] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = this.invalidationHistory
      .filter(h => h.timestamp > last24Hours)
      .reduce((acc, h) => {
        const hour = h.timestamp.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

    return {
      totalInvalidations,
      successfulInvalidations,
      failedInvalidations,
      totalKeysInvalidated,
      averageDuration,
      byRule,
      byPattern,
      recentActivity: Object.entries(recentActivity).map(([hour, count]) => ({
        timestamp: new Date(0, 0, 0, parseInt(hour)),
        count
      }))
    };
  }

  /**
   * Execute invalidation rule
   */
  private async executeInvalidation(rule: CacheInvalidationRule): Promise<CacheOperationResult> {
    try {
      const startTime = Date.now();
      let result: CacheOperationResult;

      switch (rule.action) {
        case 'invalidate':
          result = await this.cacheStrategyService.invalidatePattern(rule.pattern);
          break;
        case 'update':
          // This would update cache entries instead of invalidating
          result = await this.updateCacheEntries(rule.pattern);
          break;
        case 'refresh':
          // This would refresh cache entries
          result = await this.refreshCacheEntries(rule.pattern);
          break;
        default:
          result = await this.cacheStrategyService.invalidatePattern(rule.pattern);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Invalidation rule ${rule.id} executed in ${duration}ms`);

      return {
        ...result,
        duration,
        metadata: {
          ...result.metadata,
          ruleId: rule.id,
          action: rule.action
        }
      };

    } catch (error) {
      this.logger.error(`Invalidation rule execution failed for rule ${rule.id}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: 0,
        fromCache: false,
        cacheLevel: 'l2_redis' as any
      };
    }
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(conditions: Record<string, any>, context?: Record<string, any>): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    if (!context) {
      return false;
    }

    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = context[key];
      if (actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update cache entries
   */
  private async updateCacheEntries(pattern: string): Promise<CacheOperationResult> {
    // This would implement cache entry updates
    // For now, return success
    return {
      success: true,
      duration: 0,
      fromCache: false,
      cacheLevel: 'l2_redis' as any,
      metadata: {
        action: 'update',
        pattern
      }
    };
  }

  /**
   * Refresh cache entries
   */
  private async refreshCacheEntries(pattern: string): Promise<CacheOperationResult> {
    // This would implement cache entry refresh
    // For now, return success
    return {
      success: true,
      duration: 0,
      fromCache: false,
      cacheLevel: 'l2_redis' as any,
      metadata: {
        action: 'refresh',
        pattern
      }
    };
  }

  /**
   * Record invalidation history
   */
  private recordInvalidationHistory(history: {
    id: string;
    ruleId: string;
    pattern: string;
    keysInvalidated: number;
    timestamp: Date;
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    this.invalidationHistory.push(history);
    
    // Keep only last 1000 entries
    if (this.invalidationHistory.length > 1000) {
      this.invalidationHistory = this.invalidationHistory.slice(-1000);
    }
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeDefaultRules(): void {
    // Cart invalidation rules
    this.addInvalidationRule({
      pattern: 'cart:*',
      triggers: ['cart_updated', 'cart_cleared', 'cart_merged'],
      conditions: {},
      action: 'invalidate',
      priority: 1,
      isActive: true
    });

    // Product invalidation rules
    this.addInvalidationRule({
      pattern: 'product:*',
      triggers: ['product_updated', 'product_deleted', 'product_price_changed'],
      conditions: {},
      action: 'invalidate',
      priority: 2,
      isActive: true
    });

    // Pricing invalidation rules
    this.addInvalidationRule({
      pattern: 'pricing:*',
      triggers: ['price_updated', 'discount_updated', 'promotion_updated'],
      conditions: {},
      action: 'invalidate',
      priority: 1,
      isActive: true
    });

    // Session invalidation rules
    this.addInvalidationRule({
      pattern: 'session:*',
      triggers: ['session_expired', 'session_terminated'],
      conditions: {},
      action: 'invalidate',
      priority: 3,
      isActive: true
    });

    // User invalidation rules
    this.addInvalidationRule({
      pattern: 'user:*',
      triggers: ['user_updated', 'user_deleted'],
      conditions: {},
      action: 'invalidate',
      priority: 2,
      isActive: true
    });

    // Order invalidation rules
    this.addInvalidationRule({
      pattern: 'order:*',
      triggers: ['order_created', 'order_updated', 'order_cancelled'],
      conditions: {},
      action: 'invalidate',
      priority: 1,
      isActive: true
    });

    // Notification invalidation rules
    this.addInvalidationRule({
      pattern: 'notification:*',
      triggers: ['notification_sent', 'notification_updated'],
      conditions: {},
      action: 'invalidate',
      priority: 3,
      isActive: true
    });

    // Analytics invalidation rules
    this.addInvalidationRule({
      pattern: 'analytics:*',
      triggers: ['scheduled'],
      conditions: {},
      action: 'refresh',
      priority: 4,
      isActive: true
    });
  }
}
