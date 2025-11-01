import {
    Controller,
    Get,
    HttpStatus,
    HttpCode,
    Query,
    Param
} from '@nestjs/common';
import { HealthService } from './health.service';
import {
    HealthCheck,
    HealthCheckResult,
    HealthStatus,
    DatabaseHealthCheck,
    RedisHealthCheck,
    ExternalServiceHealthCheck,
    SystemHealthCheck,
    BusinessHealthCheck
} from '../types/monitoring.types';

@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    /**
     * Get overall health status
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    async getHealth(): Promise<HealthCheckResult> {
        return await this.healthService.getOverallHealth();
    }

    /**
     * Get detailed health status
     */
    @Get('detailed')
    @HttpCode(HttpStatus.OK)
    async getDetailedHealth(): Promise<{
        overall: HealthCheckResult;
        database: DatabaseHealthCheck;
        redis: RedisHealthCheck;
        externalServices: ExternalServiceHealthCheck[];
        system: SystemHealthCheck;
        business: BusinessHealthCheck[];
    }> {
        return await this.healthService.getDetailedHealth();
    }

    /**
     * Get database health
     */
    @Get('database')
    @HttpCode(HttpStatus.OK)
    async getDatabaseHealth(): Promise<DatabaseHealthCheck> {
        return await this.healthService.getDatabaseHealth();
    }

    /**
     * Get Redis health
     */
    @Get('redis')
    @HttpCode(HttpStatus.OK)
    async getRedisHealth(): Promise<RedisHealthCheck> {
        return await this.healthService.getRedisHealth();
    }

    /**
     * Get external services health
     */
    @Get('external')
    @HttpCode(HttpStatus.OK)
    async getExternalServicesHealth(): Promise<ExternalServiceHealthCheck[]> {
        return await this.healthService.getExternalServicesHealth();
    }

    /**
     * Get system health
     */
    @Get('system')
    @HttpCode(HttpStatus.OK)
    async getSystemHealth(): Promise<SystemHealthCheck> {
        return await this.healthService.getSystemHealth();
    }

    /**
     * Get business health
     */
    @Get('business')
    @HttpCode(HttpStatus.OK)
    async getBusinessHealth(): Promise<BusinessHealthCheck[]> {
        return await this.healthService.getBusinessHealth();
    }

    /**
     * Get health for specific service
     */
    @Get('service/:serviceName')
    @HttpCode(HttpStatus.OK)
    async getServiceHealth(@Param('serviceName') serviceName: string): Promise<HealthCheckResult> {
        return await this.healthService.getServiceHealth(serviceName);
    }

    /**
     * Get health history
     */
    @Get('history')
    @HttpCode(HttpStatus.OK)
    async getHealthHistory(
        @Query('hours') hours: number = 24,
        @Query('service') service?: string
    ): Promise<Array<{
        timestamp: Date;
        status: HealthStatus;
        checks: HealthCheck[];
    }>> {
        return await this.healthService.getHealthHistory(hours, service);
    }

    /**
     * Get health metrics
     */
    @Get('metrics')
    @HttpCode(HttpStatus.OK)
    async getHealthMetrics(): Promise<{
        uptime: number;
        totalChecks: number;
        healthyChecks: number;
        unhealthyChecks: number;
        averageResponseTime: number;
        lastCheckTime: Date;
        healthScore: number;
    }> {
        return await this.healthService.getHealthMetrics();
    }

    /**
     * Get readiness probe
     */
    @Get('ready')
    @HttpCode(HttpStatus.OK)
    async getReadiness(): Promise<{
        ready: boolean;
        checks: Array<{
            name: string;
            ready: boolean;
            message?: string;
        }>;
    }> {
        return await this.healthService.getReadiness();
    }

    /**
     * Get liveness probe
     */
    @Get('live')
    @HttpCode(HttpStatus.OK)
    async getLiveness(): Promise<{
        alive: boolean;
        uptime: number;
        timestamp: Date;
    }> {
        return await this.healthService.getLiveness();
    }

    /**
     * Get startup probe
     */
    @Get('startup')
    @HttpCode(HttpStatus.OK)
    async getStartup(): Promise<{
        started: boolean;
        initializationTime: number;
        services: Array<{
            name: string;
            started: boolean;
            startupTime: number;
        }>;
    }> {
        return await this.healthService.getStartup();
    }

    /**
     * Get health summary
     */
    @Get('summary')
    @HttpCode(HttpStatus.OK)
    async getHealthSummary(): Promise<{
        status: HealthStatus;
        score: number;
        criticalIssues: number;
        warnings: number;
        recommendations: string[];
        lastUpdated: Date;
    }> {
        return await this.healthService.getHealthSummary();
    }
}
