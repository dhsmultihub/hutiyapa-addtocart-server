import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  PerformanceMetrics,
  PerformanceAlert,
  CachePerformanceMetrics,
  DatabaseOptimizationConfig
} from '../types/cache.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PerformanceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds = {
    responseTime: 1000, // 1 second
    errorRate: 5, // 5%
    memoryUsage: 80, // 80%
    cpuUsage: 80, // 80%
    cacheHitRate: 70 // 70%
  };

  onModuleInit() {
    this.logger.log('Performance monitoring service initialized');
  }

  /**
   * Collect performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        responseTime: await this.getAverageResponseTime(),
        throughput: await this.getThroughput(),
        errorRate: await this.getErrorRate(),
        memoryUsage: await this.getMemoryUsage(),
        cpuUsage: await this.getCpuUsage(),
        databaseConnections: await this.getDatabaseConnections(),
        cacheHitRate: await this.getCacheHitRate(),
        queueSize: await this.getQueueSize(),
        activeConnections: await this.getActiveConnections()
      };

      // Store metrics
      this.metrics.push(metrics);

      // Keep only last 1000 metrics
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Check for alerts
      await this.checkAlerts(metrics);

      this.logger.debug(`Performance metrics collected: ${JSON.stringify(metrics)}`);
      return metrics;

    } catch (error) {
      this.logger.error('Performance metrics collection failed:', error.message);
      throw error;
    }
  }

  /**
   * Get performance metrics history
   */
  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get performance alerts
   */
  getAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    this.logger.log(`Alert resolved: ${alertId}`);
    return true;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStatistics(): {
    totalMetrics: number;
    averageResponseTime: number;
    averageThroughput: number;
    averageErrorRate: number;
    averageMemoryUsage: number;
    averageCpuUsage: number;
    averageCacheHitRate: number;
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    trends: Array<{
      timestamp: Date;
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
    }>;
  } {
    const totalMetrics = this.metrics.length;
    const averageResponseTime = this.calculateAverage('responseTime');
    const averageThroughput = this.calculateAverage('throughput');
    const averageErrorRate = this.calculateAverage('errorRate');
    const averageMemoryUsage = this.calculateAverage('memoryUsage');
    const averageCpuUsage = this.calculateAverage('cpuUsage');
    const averageCacheHitRate = this.calculateAverage('cacheHitRate');

    const totalAlerts = this.alerts.length;
    const activeAlerts = this.alerts.filter(a => !a.resolved).length;
    const resolvedAlerts = this.alerts.filter(a => a.resolved).length;

    // Get trends (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > last24Hours);
    const trends = recentMetrics.map(m => ({
      timestamp: m.timestamp,
      responseTime: m.responseTime,
      errorRate: m.errorRate,
      memoryUsage: m.memoryUsage
    }));

    return {
      totalMetrics,
      averageResponseTime,
      averageThroughput,
      averageErrorRate,
      averageMemoryUsage,
      averageCpuUsage,
      averageCacheHitRate,
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      trends
    };
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(period: 'hour' | 'day' | 'week' = 'day'): Array<{
    timestamp: Date;
    metrics: PerformanceMetrics;
  }> {
    const now = new Date();
    let startTime: Date;

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return this.metrics
      .filter(m => m.timestamp > startTime)
      .map(m => ({
        timestamp: m.timestamp,
        metrics: m
      }));
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.log(`Performance thresholds updated: ${JSON.stringify(thresholds)}`);
  }

  /**
   * Get performance thresholds
   */
  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }

  /**
   * Run performance monitoring (scheduled)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async runPerformanceMonitoring(): Promise<void> {
    try {
      await this.collectMetrics();
    } catch (error) {
      this.logger.error('Scheduled performance monitoring failed:', error.message);
    }
  }

  /**
   * Clean up old metrics
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const oldMetricsCount = this.metrics.length;
      this.metrics = this.metrics.filter(m => m.timestamp > cutoffDate);
      
      const oldAlertsCount = this.alerts.length;
      this.alerts = this.alerts.filter(a => a.timestamp > cutoffDate);
      
      this.logger.log(`Cleaned up ${oldMetricsCount - this.metrics.length} old metrics and ${oldAlertsCount - this.alerts.length} old alerts`);
    } catch (error) {
      this.logger.error('Metrics cleanup failed:', error.message);
    }
  }

  /**
   * Get average response time
   */
  private async getAverageResponseTime(): Promise<number> {
    try {
      // This would typically calculate from actual request logs
      // For now, return mock data
      return Math.random() * 500 + 100; // 100-600ms
    } catch (error) {
      this.logger.error('Response time calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get throughput
   */
  private async getThroughput(): Promise<number> {
    try {
      // This would typically calculate from request logs
      // For now, return mock data
      return Math.random() * 100 + 50; // 50-150 requests/second
    } catch (error) {
      this.logger.error('Throughput calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get error rate
   */
  private async getErrorRate(): Promise<number> {
    try {
      // This would typically calculate from error logs
      // For now, return mock data
      return Math.random() * 5; // 0-5%
    } catch (error) {
      this.logger.error('Error rate calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get memory usage
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      // This would typically get from system metrics
      // For now, return mock data
      return Math.random() * 40 + 30; // 30-70%
    } catch (error) {
      this.logger.error('Memory usage calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get CPU usage
   */
  private async getCpuUsage(): Promise<number> {
    try {
      // This would typically get from system metrics
      // For now, return mock data
      return Math.random() * 30 + 20; // 20-50%
    } catch (error) {
      this.logger.error('CPU usage calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get database connections
   */
  private async getDatabaseConnections(): Promise<number> {
    try {
      // This would typically get from database connection pool
      // For now, return mock data
      return Math.floor(Math.random() * 10 + 5); // 5-15 connections
    } catch (error) {
      this.logger.error('Database connections calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get cache hit rate
   */
  private async getCacheHitRate(): Promise<number> {
    try {
      // This would typically get from cache metrics
      // For now, return mock data
      return Math.random() * 30 + 70; // 70-100%
    } catch (error) {
      this.logger.error('Cache hit rate calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get queue size
   */
  private async getQueueSize(): Promise<number> {
    try {
      // This would typically get from queue metrics
      // For now, return mock data
      return Math.floor(Math.random() * 100); // 0-100 items
    } catch (error) {
      this.logger.error('Queue size calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Get active connections
   */
  private async getActiveConnections(): Promise<number> {
    try {
      // This would typically get from connection metrics
      // For now, return mock data
      return Math.floor(Math.random() * 50 + 10); // 10-60 connections
    } catch (error) {
      this.logger.error('Active connections calculation failed:', error.message);
      return 0;
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    try {
      // Check response time
      if (metrics.responseTime > this.thresholds.responseTime) {
        await this.createAlert('response_time', this.thresholds.responseTime, metrics.responseTime, 'high');
      }

      // Check error rate
      if (metrics.errorRate > this.thresholds.errorRate) {
        await this.createAlert('error_rate', this.thresholds.errorRate, metrics.errorRate, 'high');
      }

      // Check memory usage
      if (metrics.memoryUsage > this.thresholds.memoryUsage) {
        await this.createAlert('memory_usage', this.thresholds.memoryUsage, metrics.memoryUsage, 'high');
      }

      // Check CPU usage
      if (metrics.cpuUsage > this.thresholds.cpuUsage) {
        await this.createAlert('cpu_usage', this.thresholds.cpuUsage, metrics.cpuUsage, 'high');
      }

      // Check cache hit rate
      if (metrics.cacheHitRate < this.thresholds.cacheHitRate) {
        await this.createAlert('cache_hit_rate', this.thresholds.cacheHitRate, metrics.cacheHitRate, 'medium');
      }

    } catch (error) {
      this.logger.error('Alert checking failed:', error.message);
    }
  }

  /**
   * Create performance alert
   */
  private async createAlert(
    type: PerformanceAlert['type'],
    threshold: number,
    currentValue: number,
    severity: PerformanceAlert['severity']
  ): Promise<void> {
    try {
      // Check if alert already exists for this type
      const existingAlert = this.alerts.find(a => 
        a.type === type && !a.resolved && 
        (Date.now() - a.timestamp.getTime()) < 5 * 60 * 1000 // 5 minutes
      );

      if (existingAlert) {
        return; // Don't create duplicate alerts
      }

      const alert: PerformanceAlert = {
        id: uuidv4(),
        type,
        threshold,
        currentValue,
        severity,
        message: this.generateAlertMessage(type, threshold, currentValue),
        timestamp: new Date(),
        resolved: false
      };

      this.alerts.push(alert);
      this.logger.warn(`Performance alert created: ${alert.message}`);

    } catch (error) {
      this.logger.error(`Alert creation failed for type ${type}:`, error.message);
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    type: PerformanceAlert['type'],
    threshold: number,
    currentValue: number
  ): string {
    switch (type) {
      case 'response_time':
        return `High response time: ${currentValue.toFixed(2)}ms (threshold: ${threshold}ms)`;
      case 'error_rate':
        return `High error rate: ${currentValue.toFixed(2)}% (threshold: ${threshold}%)`;
      case 'memory_usage':
        return `High memory usage: ${currentValue.toFixed(2)}% (threshold: ${threshold}%)`;
      case 'cpu_usage':
        return `High CPU usage: ${currentValue.toFixed(2)}% (threshold: ${threshold}%)`;
      case 'cache_hit_rate':
        return `Low cache hit rate: ${currentValue.toFixed(2)}% (threshold: ${threshold}%)`;
      default:
        return `Performance alert: ${type} = ${currentValue} (threshold: ${threshold})`;
    }
  }

  /**
   * Calculate average for metric
   */
  private calculateAverage(metric: keyof PerformanceMetrics): number {
    if (this.metrics.length === 0) return 0;
    
    const values = this.metrics.map(m => m[metric] as number);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Get performance health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check active alerts
    const activeAlerts = this.getActiveAlerts();
    if (activeAlerts.length > 0) {
      issues.push(`${activeAlerts.length} active performance alerts`);
    }

    // Check recent metrics
    const recentMetrics = this.metrics.slice(-10); // Last 10 metrics
    if (recentMetrics.length > 0) {
      const avgResponseTime = this.calculateAverage('responseTime');
      const avgErrorRate = this.calculateAverage('errorRate');
      const avgMemoryUsage = this.calculateAverage('memoryUsage');

      if (avgResponseTime > this.thresholds.responseTime * 0.8) {
        issues.push('Response time approaching threshold');
        recommendations.push('Consider optimizing database queries or adding caching');
      }

      if (avgErrorRate > this.thresholds.errorRate * 0.8) {
        issues.push('Error rate approaching threshold');
        recommendations.push('Review error logs and improve error handling');
      }

      if (avgMemoryUsage > this.thresholds.memoryUsage * 0.8) {
        issues.push('Memory usage approaching threshold');
        recommendations.push('Consider optimizing memory usage or scaling resources');
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (issues.length === 0) {
      status = 'healthy';
    } else if (issues.length <= 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, issues, recommendations };
  }
}
