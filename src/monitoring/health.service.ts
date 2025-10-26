import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../cache/redis.service';
import {
    HealthCheckResult,
    HealthStatus,
    HealthCheck,
    DatabaseHealthCheck,
    RedisHealthCheck,
    ExternalServiceHealthCheck,
    SystemHealthCheck,
    BusinessHealthCheck
} from '../types/monitoring.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);
    private readonly startTime = Date.now();
    private healthHistory: Array<{
        timestamp: Date;
        status: HealthStatus;
        checks: HealthCheck[];
    }> = [];

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly redisService: RedisService
    ) { }

    /**
     * Get overall health status
     */
    async getOverallHealth(): Promise<HealthCheckResult> {
        try {
            const startTime = Date.now();
            const checks: HealthCheck[] = [];

            // Database health
            const dbHealth = await this.getDatabaseHealth();
            checks.push(dbHealth);

            // Redis health
            const redisHealth = await this.getRedisHealth();
            checks.push(redisHealth);

            // System health
            const systemHealth = await this.getSystemHealth();
            checks.push(systemHealth);

            // External services health
            const externalHealth = await this.getExternalServicesHealth();
            checks.push(...externalHealth);

            // Business health
            const businessHealth = await this.getBusinessHealth();
            checks.push(...businessHealth);

            // Determine overall status
            const status = this.determineOverallStatus(checks);
            const duration = Date.now() - startTime;

            const result: HealthCheckResult = {
                status,
                checks,
                timestamp: new Date(),
                duration,
                version: process.env.npm_package_version || '1.0.0',
                uptime: Date.now() - this.startTime,
                metadata: {
                    environment: process.env.NODE_ENV || 'development',
                    service: 'addtocart-service'
                }
            };

            // Store in history
            this.healthHistory.push({
                timestamp: result.timestamp,
                status: result.status,
                checks: result.checks
            });

            // Keep only last 1000 entries
            if (this.healthHistory.length > 1000) {
                this.healthHistory = this.healthHistory.slice(-1000);
            }

            return result;

        } catch (error) {
            this.logger.error('Health check failed:', error.message);
            return {
                status: HealthStatus.UNHEALTHY,
                checks: [{
                    name: 'health-check',
                    status: HealthStatus.UNHEALTHY,
                    message: `Health check failed: ${error.message}`,
                    duration: 0,
                    timestamp: new Date()
                }],
                timestamp: new Date(),
                duration: 0,
                version: '1.0.0',
                uptime: Date.now() - this.startTime
            };
        }
    }

    /**
     * Get detailed health status
     */
    async getDetailedHealth(): Promise<{
        overall: HealthCheckResult;
        database: DatabaseHealthCheck;
        redis: RedisHealthCheck;
        externalServices: ExternalServiceHealthCheck[];
        system: SystemHealthCheck;
        business: BusinessHealthCheck[];
    }> {
        const overall = await this.getOverallHealth();
        const database = await this.getDatabaseHealth();
        const redis = await this.getRedisHealth();
        const externalServices = await this.getExternalServicesHealth();
        const system = await this.getSystemHealth();
        const business = await this.getBusinessHealth();

        return {
            overall,
            database,
            redis,
            externalServices,
            system,
            business
        };
    }

    /**
     * Get database health
     */
    async getDatabaseHealth(): Promise<DatabaseHealthCheck> {
        const startTime = Date.now();

        try {
            // Test database connection
            const connectionTest = await this.databaseService.$queryRaw`SELECT 1`;

            // Get connection pool stats
            const connectionCount = 0; // Would get from connection pool
            const activeConnections = 0; // Would get from connection pool

            // Test query performance
            const queryStart = Date.now();
            await this.databaseService.$queryRaw`SELECT COUNT(*) FROM cart`;
            const queryTime = Date.now() - queryStart;

            const duration = Date.now() - startTime;
            const status = queryTime < 1000 ? HealthStatus.HEALTHY :
                queryTime < 2000 ? HealthStatus.DEGRADED : HealthStatus.UNHEALTHY;

            return {
                name: 'database',
                status,
                message: status === HealthStatus.HEALTHY ? 'Database is healthy' :
                    status === HealthStatus.DEGRADED ? 'Database is slow' : 'Database is unhealthy',
                duration,
                timestamp: new Date(),
                connectionCount,
                activeConnections,
                queryTime,
                lastQueryTime: new Date(),
                metadata: {
                    queryTime,
                    connectionCount,
                    activeConnections
                }
            };

        } catch (error) {
            this.logger.error('Database health check failed:', error.message);
            return {
                name: 'database',
                status: HealthStatus.UNHEALTHY,
                message: `Database health check failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                connectionCount: 0,
                activeConnections: 0,
                queryTime: 0,
                lastQueryTime: new Date(),
                metadata: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Get Redis health
     */
    async getRedisHealth(): Promise<RedisHealthCheck> {
        const startTime = Date.now();

        try {
            // Test Redis connection
            const pingStart = Date.now();
            const pingResult = await this.redisService.get('health:test');
            const latency = Date.now() - pingStart;

            // Get Redis metrics
            const stats = await this.redisService.getStats();
            const metrics = this.redisService.getMetrics();

            const duration = Date.now() - startTime;
            const status = latency < 100 ? HealthStatus.HEALTHY :
                latency < 500 ? HealthStatus.DEGRADED : HealthStatus.UNHEALTHY;

            return {
                name: 'redis',
                status,
                message: status === HealthStatus.HEALTHY ? 'Redis is healthy' :
                    status === HealthStatus.DEGRADED ? 'Redis is slow' : 'Redis is unhealthy',
                duration,
                timestamp: new Date(),
                connectionStatus: true,
                memoryUsage: 0, // Would get from Redis info
                keyCount: stats.totalKeys,
                hitRate: metrics.hitRate,
                latency,
                metadata: {
                    latency,
                    keyCount: stats.totalKeys,
                    hitRate: metrics.hitRate
                }
            };

        } catch (error) {
            this.logger.error('Redis health check failed:', error.message);
            return {
                name: 'redis',
                status: HealthStatus.UNHEALTHY,
                message: `Redis health check failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                connectionStatus: false,
                memoryUsage: 0,
                keyCount: 0,
                hitRate: 0,
                latency: 0,
                metadata: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Get external services health
     */
    async getExternalServicesHealth(): Promise<ExternalServiceHealthCheck[]> {
        const services = [
            { name: 'product-service', endpoint: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001' },
            { name: 'auth-service', endpoint: process.env.AUTH_SERVICE_URL || 'http://localhost:3002' },
            { name: 'payment-service', endpoint: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003' }
        ];

        const healthChecks: ExternalServiceHealthCheck[] = [];

        for (const service of services) {
            try {
                const startTime = Date.now();

                // This would typically make HTTP request to service health endpoint
                // For now, simulate health check
                const responseTime = Math.random() * 500 + 100; // 100-600ms
                const statusCode = Math.random() > 0.1 ? 200 : 500; // 90% success rate

                const duration = Date.now() - startTime;
                const status = statusCode === 200 && responseTime < 1000 ? HealthStatus.HEALTHY :
                    statusCode === 200 && responseTime < 2000 ? HealthStatus.DEGRADED : HealthStatus.UNHEALTHY;

                healthChecks.push({
                    name: service.name,
                    status,
                    message: status === HealthStatus.HEALTHY ? `${service.name} is healthy` :
                        status === HealthStatus.DEGRADED ? `${service.name} is slow` : `${service.name} is unhealthy`,
                    duration,
                    timestamp: new Date(),
                    serviceName: service.name,
                    endpoint: service.endpoint,
                    responseTime,
                    statusCode,
                    lastCheck: new Date(),
                    metadata: {
                        responseTime,
                        statusCode,
                        endpoint: service.endpoint
                    }
                });

            } catch (error) {
                this.logger.error(`External service health check failed for ${service.name}:`, error.message);
                healthChecks.push({
                    name: service.name,
                    status: HealthStatus.UNHEALTHY,
                    message: `${service.name} health check failed: ${error.message}`,
                    duration: 0,
                    timestamp: new Date(),
                    serviceName: service.name,
                    endpoint: service.endpoint,
                    responseTime: 0,
                    statusCode: 0,
                    lastCheck: new Date(),
                    metadata: {
                        error: error.message
                    }
                });
            }
        }

        return healthChecks;
    }

    /**
     * Get system health
     */
    async getSystemHealth(): Promise<SystemHealthCheck> {
        const startTime = Date.now();

        try {
            // Get system metrics
            const memoryUsage = process.memoryUsage();
            const cpuUsage = await this.getCpuUsage();
            const diskUsage = await this.getDiskUsage();
            const loadAverage = await this.getLoadAverage();

            const duration = Date.now() - startTime;
            const status = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.8 && cpuUsage < 80 ?
                HealthStatus.HEALTHY : HealthStatus.DEGRADED;

            return {
                name: 'system',
                status,
                message: status === HealthStatus.HEALTHY ? 'System is healthy' : 'System resources are high',
                duration,
                timestamp: new Date(),
                memoryUsage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
                cpuUsage,
                diskUsage,
                loadAverage,
                uptime: Date.now() - this.startTime,
                metadata: {
                    memoryUsage: memoryUsage.heapUsed,
                    memoryTotal: memoryUsage.heapTotal,
                    cpuUsage,
                    diskUsage,
                    loadAverage
                }
            };

        } catch (error) {
            this.logger.error('System health check failed:', error.message);
            return {
                name: 'system',
                status: HealthStatus.UNHEALTHY,
                message: `System health check failed: ${error.message}`,
                duration: Date.now() - startTime,
                timestamp: new Date(),
                memoryUsage: 0,
                cpuUsage: 0,
                diskUsage: 0,
                loadAverage: [0, 0, 0],
                uptime: Date.now() - this.startTime,
                metadata: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Get business health
     */
    async getBusinessHealth(): Promise<BusinessHealthCheck[]> {
        const healthChecks: BusinessHealthCheck[] = [];

        try {
            // Cart abandonment rate
            const cartAbandonmentRate = await this.getCartAbandonmentRate();
            healthChecks.push({
                name: 'cart-abandonment',
                status: cartAbandonmentRate < 70 ? HealthStatus.HEALTHY :
                    cartAbandonmentRate < 85 ? HealthStatus.DEGRADED : HealthStatus.UNHEALTHY,
                message: `Cart abandonment rate: ${cartAbandonmentRate.toFixed(2)}%`,
                duration: 0,
                timestamp: new Date(),
                metric: 'cart_abandonment_rate',
                value: cartAbandonmentRate,
                threshold: 70,
                trend: 'stable',
                impact: cartAbandonmentRate > 85 ? 'high' : cartAbandonmentRate > 70 ? 'medium' : 'low',
                metadata: {
                    cartAbandonmentRate
                }
            });

            // Average cart value
            const averageCartValue = await this.getAverageCartValue();
            healthChecks.push({
                name: 'average-cart-value',
                status: averageCartValue > 50 ? HealthStatus.HEALTHY :
                    averageCartValue > 25 ? HealthStatus.DEGRADED : HealthStatus.UNHEALTHY,
                message: `Average cart value: $${averageCartValue.toFixed(2)}`,
                duration: 0,
                timestamp: new Date(),
                metric: 'average_cart_value',
                value: averageCartValue,
                threshold: 50,
                trend: 'stable',
                impact: averageCartValue < 25 ? 'high' : averageCartValue < 50 ? 'medium' : 'low',
                metadata: {
                    averageCartValue
                }
            });

            // Order success rate
            const orderSuccessRate = await this.getOrderSuccessRate();
            healthChecks.push({
                name: 'order-success-rate',
                status: orderSuccessRate > 95 ? HealthStatus.HEALTHY :
                    orderSuccessRate > 90 ? HealthStatus.DEGRADED : HealthStatus.UNHEALTHY,
                message: `Order success rate: ${orderSuccessRate.toFixed(2)}%`,
                duration: 0,
                timestamp: new Date(),
                metric: 'order_success_rate',
                value: orderSuccessRate,
                threshold: 95,
                trend: 'stable',
                impact: orderSuccessRate < 90 ? 'high' : orderSuccessRate < 95 ? 'medium' : 'low',
                metadata: {
                    orderSuccessRate
                }
            });

        } catch (error) {
            this.logger.error('Business health check failed:', error.message);
        }

        return healthChecks;
    }

    /**
     * Get service health
     */
    async getServiceHealth(serviceName: string): Promise<HealthCheckResult> {
        try {
            const checks: HealthCheck[] = [];

            switch (serviceName) {
                case 'database':
                    checks.push(await this.getDatabaseHealth());
                    break;
                case 'redis':
                    checks.push(await this.getRedisHealth());
                    break;
                case 'system':
                    checks.push(await this.getSystemHealth());
                    break;
                default:
                    return {
                        status: HealthStatus.UNKNOWN,
                        checks: [{
                            name: serviceName,
                            status: HealthStatus.UNKNOWN,
                            message: `Unknown service: ${serviceName}`,
                            duration: 0,
                            timestamp: new Date()
                        }],
                        timestamp: new Date(),
                        duration: 0,
                        version: '1.0.0',
                        uptime: Date.now() - this.startTime
                    };
            }

            const status = this.determineOverallStatus(checks);
            return {
                status,
                checks,
                timestamp: new Date(),
                duration: 0,
                version: '1.0.0',
                uptime: Date.now() - this.startTime
            };

        } catch (error) {
            this.logger.error(`Service health check failed for ${serviceName}:`, error.message);
            return {
                status: HealthStatus.UNHEALTHY,
                checks: [{
                    name: serviceName,
                    status: HealthStatus.UNHEALTHY,
                    message: `Service health check failed: ${error.message}`,
                    duration: 0,
                    timestamp: new Date()
                }],
                timestamp: new Date(),
                duration: 0,
                version: '1.0.0',
                uptime: Date.now() - this.startTime
            };
        }
    }

    /**
     * Get health history
     */
    async getHealthHistory(hours: number = 24, service?: string): Promise<Array<{
        timestamp: Date;
        status: HealthStatus;
        checks: HealthCheck[];
    }>> {
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

        let history = this.healthHistory.filter(entry => entry.timestamp > cutoffTime);

        if (service) {
            history = history.map(entry => ({
                ...entry,
                checks: entry.checks.filter(check => check.name.includes(service))
            }));
        }

        return history;
    }

    /**
     * Get health metrics
     */
    async getHealthMetrics(): Promise<{
        uptime: number;
        totalChecks: number;
        healthyChecks: number;
        unhealthyChecks: number;
        averageResponseTime: number;
        lastCheckTime: Date;
        healthScore: number;
    }> {
        const totalChecks = this.healthHistory.reduce((sum, entry) => sum + entry.checks.length, 0);
        const healthyChecks = this.healthHistory.reduce((sum, entry) =>
            sum + entry.checks.filter(check => check.status === HealthStatus.HEALTHY).length, 0);
        const unhealthyChecks = this.healthHistory.reduce((sum, entry) =>
            sum + entry.checks.filter(check => check.status === HealthStatus.UNHEALTHY).length, 0);

        const averageResponseTime = this.healthHistory.reduce((sum, entry) =>
            sum + entry.checks.reduce((checkSum, check) => checkSum + check.duration, 0), 0) / totalChecks;

        const healthScore = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;

        return {
            uptime: Date.now() - this.startTime,
            totalChecks,
            healthyChecks,
            unhealthyChecks,
            averageResponseTime: averageResponseTime || 0,
            lastCheckTime: this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1].timestamp : new Date(),
            healthScore
        };
    }

    /**
     * Get readiness probe
     */
    async getReadiness(): Promise<{
        ready: boolean;
        checks: Array<{
            name: string;
            ready: boolean;
            message?: string;
        }>;
    }> {
        const checks = [
            { name: 'database', ready: false, message: '' },
            { name: 'redis', ready: false, message: '' },
            { name: 'external-services', ready: false, message: '' }
        ];

        try {
            // Check database
            const dbHealth = await this.getDatabaseHealth();
            checks[0].ready = dbHealth.status === HealthStatus.HEALTHY;
            checks[0].message = dbHealth.message;

            // Check Redis
            const redisHealth = await this.getRedisHealth();
            checks[1].ready = redisHealth.status === HealthStatus.HEALTHY;
            checks[1].message = redisHealth.message;

            // Check external services
            const externalHealth = await this.getExternalServicesHealth();
            checks[2].ready = externalHealth.every(service => service.status === HealthStatus.HEALTHY);
            checks[2].message = externalHealth.length > 0 ?
                `${externalHealth.filter(s => s.status === HealthStatus.HEALTHY).length}/${externalHealth.length} services healthy` : 'No external services';

        } catch (error) {
            this.logger.error('Readiness check failed:', error.message);
        }

        const ready = checks.every(check => check.ready);
        return { ready, checks };
    }

    /**
     * Get liveness probe
     */
    async getLiveness(): Promise<{
        alive: boolean;
        uptime: number;
        timestamp: Date;
    }> {
        return {
            alive: true,
            uptime: Date.now() - this.startTime,
            timestamp: new Date()
        };
    }

    /**
     * Get startup probe
     */
    async getStartup(): Promise<{
        started: boolean;
        initializationTime: number;
        services: Array<{
            name: string;
            started: boolean;
            startupTime: number;
        }>;
    }> {
        const services = [
            { name: 'database', started: true, startupTime: 1000 },
            { name: 'redis', started: true, startupTime: 500 },
            { name: 'external-services', started: true, startupTime: 2000 }
        ];

        const started = services.every(service => service.started);
        const initializationTime = Math.max(...services.map(s => s.startupTime));

        return {
            started,
            initializationTime,
            services
        };
    }

    /**
     * Get health summary
     */
    async getHealthSummary(): Promise<{
        status: HealthStatus;
        score: number;
        criticalIssues: number;
        warnings: number;
        recommendations: string[];
        lastUpdated: Date;
    }> {
        const overallHealth = await this.getOverallHealth();
        const metrics = await this.getHealthMetrics();

        const criticalIssues = overallHealth.checks.filter(check => check.status === HealthStatus.UNHEALTHY).length;
        const warnings = overallHealth.checks.filter(check => check.status === HealthStatus.DEGRADED).length;

        const recommendations: string[] = [];
        if (criticalIssues > 0) {
            recommendations.push('Address critical health issues immediately');
        }
        if (warnings > 0) {
            recommendations.push('Monitor degraded services closely');
        }
        if (metrics.healthScore < 80) {
            recommendations.push('Improve overall system health');
        }

        return {
            status: overallHealth.status,
            score: metrics.healthScore,
            criticalIssues,
            warnings,
            recommendations,
            lastUpdated: new Date()
        };
    }

    /**
     * Determine overall status from checks
     */
    private determineOverallStatus(checks: HealthCheck[]): HealthStatus {
        if (checks.some(check => check.status === HealthStatus.UNHEALTHY)) {
            return HealthStatus.UNHEALTHY;
        }
        if (checks.some(check => check.status === HealthStatus.DEGRADED)) {
            return HealthStatus.DEGRADED;
        }
        if (checks.every(check => check.status === HealthStatus.HEALTHY)) {
            return HealthStatus.HEALTHY;
        }
        return HealthStatus.UNKNOWN;
    }

    /**
     * Get CPU usage
     */
    private async getCpuUsage(): Promise<number> {
        // This would typically get from system metrics
        // For now, return mock data
        return Math.random() * 50 + 20; // 20-70%
    }

    /**
     * Get disk usage
     */
    private async getDiskUsage(): Promise<number> {
        // This would typically get from system metrics
        // For now, return mock data
        return Math.random() * 30 + 40; // 40-70%
    }

    /**
     * Get load average
     */
    private async getLoadAverage(): Promise<number[]> {
        // This would typically get from system metrics
        // For now, return mock data
        return [Math.random() * 2, Math.random() * 2, Math.random() * 2];
    }

    /**
     * Get cart abandonment rate
     */
    private async getCartAbandonmentRate(): Promise<number> {
        // This would typically calculate from database
        // For now, return mock data
        return Math.random() * 30 + 60; // 60-90%
    }

    /**
     * Get average cart value
     */
    private async getAverageCartValue(): Promise<number> {
        // This would typically calculate from database
        // For now, return mock data
        return Math.random() * 100 + 50; // $50-150
    }

    /**
     * Get order success rate
     */
    private async getOrderSuccessRate(): Promise<number> {
        // This would typically calculate from database
        // For now, return mock data
        return Math.random() * 5 + 95; // 95-100%
    }
}
