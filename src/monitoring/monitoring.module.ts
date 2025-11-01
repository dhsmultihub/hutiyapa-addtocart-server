import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { AlertingService } from './alerting.service';
import { CustomLoggerService as LoggerService } from '../logging/logger.service';
import { CorrelationInterceptor } from '../logging/correlation.interceptor';
import { AuditService } from '../logging/audit.service';

@Module({
    imports: [
        DatabaseModule,
        CacheModule
    ],
    controllers: [
        HealthController
    ],
    providers: [
        HealthService,
        MetricsService,
        AlertingService,
        LoggerService,
        CorrelationInterceptor,
        AuditService
    ],
    exports: [
        HealthService,
        MetricsService,
        AlertingService,
        LoggerService,
        CorrelationInterceptor,
        AuditService
    ]
})
export class MonitoringModule { }
