import { Injectable, Logger } from '@nestjs/common';
import {
    Metric,
    CounterMetric,
    GaugeMetric,
    HistogramMetric,
    SummaryMetric,
    MetricType,
    PerformanceMetrics,
    BusinessMetrics
} from '../types/monitoring.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MetricsService {
    private readonly logger = new Logger(MetricsService.name);
    private metrics: Map<string, Metric> = new Map();
    private performanceMetrics: PerformanceMetrics[] = [];
    private businessMetrics: BusinessMetrics[] = [];

    /**
     * Record a counter metric
     */
    recordCounter(
        name: string,
        increment: number = 1,
        labels: Record<string, string> = {}
    ): void {
        try {
            const key = this.generateMetricKey(name, labels);
            const existing = this.metrics.get(key) as CounterMetric;

            if (existing) {
                existing.increment += increment;
                existing.timestamp = new Date();
            } else {
                const counter: CounterMetric = {
                    name,
                    type: MetricType.COUNTER,
                    value: increment,
                    labels,
                    timestamp: new Date(),
                    increment
                };
                this.metrics.set(key, counter);
            }

            this.logger.debug(`Counter metric recorded: ${name} = ${increment}`);
        } catch (error) {
            this.logger.error(`Counter metric recording failed for ${name}:`, error.message);
        }
    }

    /**
     * Record a gauge metric
     */
    recordGauge(
        name: string,
        value: number,
        labels: Record<string, string> = {}
    ): void {
        try {
            const key = this.generateMetricKey(name, labels);
            const gauge: GaugeMetric = {
                name,
                type: MetricType.GAUGE,
                value,
                labels,
                timestamp: new Date(),
                setValue: value
            };
            this.metrics.set(key, gauge);

            this.logger.debug(`Gauge metric recorded: ${name} = ${value}`);
        } catch (error) {
            this.logger.error(`Gauge metric recording failed for ${name}:`, error.message);
        }
    }

    /**
     * Record a histogram metric
     */
    recordHistogram(
        name: string,
        value: number,
        labels: Record<string, string> = {},
        buckets: number[] = [0.1, 0.5, 1, 2.5, 5, 10]
    ): void {
        try {
            const key = this.generateMetricKey(name, labels);
            const existing = this.metrics.get(key) as HistogramMetric;

            if (existing) {
                existing.count += 1;
                existing.sum += value;
                existing.timestamp = new Date();
            } else {
                const histogram: HistogramMetric = {
                    name,
                    type: MetricType.HISTOGRAM,
                    value,
                    labels,
                    timestamp: new Date(),
                    buckets,
                    count: 1,
                    sum: value
                };
                this.metrics.set(key, histogram);
            }

            this.logger.debug(`Histogram metric recorded: ${name} = ${value}`);
        } catch (error) {
            this.logger.error(`Histogram metric recording failed for ${name}:`, error.message);
        }
    }

    /**
     * Record a summary metric
     */
    recordSummary(
        name: string,
        value: number,
        labels: Record<string, string> = {},
        quantiles: Record<number, number> = { 0.5: 0, 0.9: 0, 0.99: 0 }
    ): void {
        try {
            const key = this.generateMetricKey(name, labels);
            const existing = this.metrics.get(key) as SummaryMetric;

            if (existing) {
                existing.count += 1;
                existing.sum += value;
                existing.timestamp = new Date();
            } else {
                const summary: SummaryMetric = {
                    name,
                    type: MetricType.SUMMARY,
                    value,
                    labels,
                    timestamp: new Date(),
                    quantiles,
                    count: 1,
                    sum: value
                };
                this.metrics.set(key, summary);
            }

            this.logger.debug(`Summary metric recorded: ${name} = ${value}`);
        } catch (error) {
            this.logger.error(`Summary metric recording failed for ${name}:`, error.message);
        }
    }

    /**
     * Record performance metrics
     */
    recordPerformanceMetrics(metrics: PerformanceMetrics): void {
        try {
            this.performanceMetrics.push(metrics);

            // Keep only last 1000 entries
            if (this.performanceMetrics.length > 1000) {
                this.performanceMetrics = this.performanceMetrics.slice(-1000);
            }

            // Record individual metrics
            this.recordGauge('response_time', metrics.responseTime, {
                service: metrics.service,
                endpoint: metrics.endpoint,
                method: metrics.method,
                status_code: metrics.statusCode.toString()
            });

            this.recordGauge('throughput', metrics.throughput, {
                service: metrics.service
            });

            this.recordGauge('error_rate', metrics.errorRate, {
                service: metrics.service
            });

            this.recordGauge('memory_usage', metrics.memoryUsage, {
                service: metrics.service
            });

            this.recordGauge('cpu_usage', metrics.cpuUsage, {
                service: metrics.service
            });

            this.logger.debug(`Performance metrics recorded for ${metrics.service}`);
        } catch (error) {
            this.logger.error('Performance metrics recording failed:', error.message);
        }
    }

    /**
     * Record business metrics
     */
    recordBusinessMetrics(metrics: BusinessMetrics): void {
        try {
            this.businessMetrics.push(metrics);

            // Keep only last 1000 entries
            if (this.businessMetrics.length > 1000) {
                this.businessMetrics = this.businessMetrics.slice(-1000);
            }

            // Record individual business metrics
            this.recordGauge('total_carts', metrics.totalCarts);
            this.recordGauge('active_carts', metrics.activeCarts);
            this.recordGauge('cart_abandonment_rate', metrics.cartAbandonmentRate);
            this.recordGauge('average_cart_value', metrics.averageCartValue);
            this.recordGauge('total_orders', metrics.totalOrders);
            this.recordGauge('successful_orders', metrics.successfulOrders);
            this.recordGauge('failed_orders', metrics.failedOrders);
            this.recordGauge('average_order_value', metrics.averageOrderValue);
            this.recordGauge('total_users', metrics.totalUsers);
            this.recordGauge('active_users', metrics.activeUsers);
            this.recordGauge('new_users', metrics.newUsers);
            this.recordGauge('total_products', metrics.totalProducts);
            this.recordGauge('active_products', metrics.activeProducts);
            this.recordGauge('out_of_stock_products', metrics.outOfStockProducts);

            this.logger.debug('Business metrics recorded');
        } catch (error) {
            this.logger.error('Business metrics recording failed:', error.message);
        }
    }

    /**
     * Get all metrics
     */
    getAllMetrics(): Metric[] {
        return Array.from(this.metrics.values());
    }

    /**
     * Get metrics by name
     */
    getMetricsByName(name: string): Metric[] {
        return Array.from(this.metrics.values()).filter(metric => metric.name === name);
    }

    /**
     * Get metrics by type
     */
    getMetricsByType(type: MetricType): Metric[] {
        return Array.from(this.metrics.values()).filter(metric => metric.type === type);
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(limit: number = 100): PerformanceMetrics[] {
        return this.performanceMetrics
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get business metrics
     */
    getBusinessMetrics(limit: number = 100): BusinessMetrics[] {
        return this.businessMetrics
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get metrics summary
     */
    getMetricsSummary(): {
        totalMetrics: number;
        byType: Record<MetricType, number>;
        byName: Record<string, number>;
        performanceMetrics: number;
        businessMetrics: number;
        lastUpdated: Date;
    } {
        const totalMetrics = this.metrics.size;
        const byType = Array.from(this.metrics.values()).reduce((acc, metric) => {
            acc[metric.type] = (acc[metric.type] || 0) + 1;
            return acc;
        }, {} as Record<MetricType, number>);

        const byName = Array.from(this.metrics.values()).reduce((acc, metric) => {
            acc[metric.name] = (acc[metric.name] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalMetrics,
            byType,
            byName,
            performanceMetrics: this.performanceMetrics.length,
            businessMetrics: this.businessMetrics.length,
            lastUpdated: new Date()
        };
    }

    /**
     * Get metrics trends
     */
    getMetricsTrends(
        name: string,
        hours: number = 24
    ): Array<{
        timestamp: Date;
        value: number;
        labels: Record<string, string>;
    }> {
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

        return Array.from(this.metrics.values())
            .filter(metric =>
                metric.name === name &&
                metric.timestamp > cutoffTime
            )
            .map(metric => ({
                timestamp: metric.timestamp,
                value: metric.value,
                labels: metric.labels
            }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    /**
     * Get Prometheus format metrics
     */
    getPrometheusMetrics(): string {
        try {
            const lines: string[] = [];

            // Add help and type comments
            const metricTypes = new Map<string, MetricType>();
            Array.from(this.metrics.values()).forEach(metric => {
                if (!metricTypes.has(metric.name)) {
                    metricTypes.set(metric.name, metric.type);
                }
            });

            metricTypes.forEach((type, name) => {
                lines.push(`# HELP ${name} ${name} metric`);
                lines.push(`# TYPE ${name} ${type}`);
            });

            // Add metric values
            Array.from(this.metrics.values()).forEach(metric => {
                const labels = Object.entries(metric.labels)
                    .map(([key, value]) => `${key}="${value}"`)
                    .join(',');

                const labelString = labels ? `{${labels}}` : '';
                lines.push(`${metric.name}${labelString} ${metric.value} ${metric.timestamp.getTime()}`);
            });

            return lines.join('\n');
        } catch (error) {
            this.logger.error('Prometheus metrics generation failed:', error.message);
            return '';
        }
    }

    /**
     * Clear metrics
     */
    clearMetrics(): void {
        this.metrics.clear();
        this.performanceMetrics = [];
        this.businessMetrics = [];
        this.logger.log('All metrics cleared');
    }

    /**
     * Clear metrics by name
     */
    clearMetricsByName(name: string): void {
        const keysToDelete = Array.from(this.metrics.keys()).filter(key =>
            key.startsWith(`${name}:`)
        );

        keysToDelete.forEach(key => this.metrics.delete(key));
        this.logger.log(`Metrics cleared for name: ${name}`);
    }

    /**
     * Clear old metrics
     */
    clearOldMetrics(maxAge: number = 24 * 60 * 60 * 1000): void {
        const cutoffTime = new Date(Date.now() - maxAge);

        const keysToDelete = Array.from(this.metrics.entries())
            .filter(([_, metric]) => metric.timestamp < cutoffTime)
            .map(([key, _]) => key);

        keysToDelete.forEach(key => this.metrics.delete(key));

        this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoffTime);
        this.businessMetrics = this.businessMetrics.filter(m => m.timestamp > cutoffTime);

        this.logger.log(`Cleared ${keysToDelete.length} old metrics`);
    }

    /**
     * Generate metric key
     */
    private generateMetricKey(name: string, labels: Record<string, string>): string {
        const labelString = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join(',');

        return labelString ? `${name}:${labelString}` : name;
    }

    /**
     * Record cart operation metrics
     */
    recordCartOperation(operation: string, duration: number, success: boolean): void {
        this.recordCounter('cart_operations_total', 1, {
            operation,
            status: success ? 'success' : 'error'
        });

        this.recordHistogram('cart_operation_duration', duration, {
            operation
        });
    }

    /**
     * Record user activity metrics
     */
    recordUserActivity(userId: string, activity: string): void {
        this.recordCounter('user_activity_total', 1, {
            user_id: userId,
            activity
        });
    }

    /**
     * Record API request metrics
     */
    recordApiRequest(
        method: string,
        endpoint: string,
        statusCode: number,
        duration: number
    ): void {
        this.recordCounter('api_requests_total', 1, {
            method,
            endpoint,
            status_code: statusCode.toString()
        });

        this.recordHistogram('api_request_duration', duration, {
            method,
            endpoint
        });
    }

    /**
     * Record database operation metrics
     */
    recordDatabaseOperation(
        operation: string,
        table: string,
        duration: number,
        success: boolean
    ): void {
        this.recordCounter('database_operations_total', 1, {
            operation,
            table,
            status: success ? 'success' : 'error'
        });

        this.recordHistogram('database_operation_duration', duration, {
            operation,
            table
        });
    }

    /**
     * Record cache operation metrics
     */
    recordCacheOperation(
        operation: string,
        cacheType: string,
        hit: boolean,
        duration: number
    ): void {
        this.recordCounter('cache_operations_total', 1, {
            operation,
            cache_type: cacheType,
            hit: hit.toString()
        });

        this.recordHistogram('cache_operation_duration', duration, {
            operation,
            cache_type: cacheType
        });
    }
}
