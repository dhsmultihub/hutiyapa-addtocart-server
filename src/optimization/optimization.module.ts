import { Module } from '@nestjs/common';
import { QueryOptimizerService } from './query-optimizer.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { CDNService } from './cdn.service';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule
  ],
  providers: [
    QueryOptimizerService,
    PerformanceMonitorService,
    CDNService
  ],
  exports: [
    QueryOptimizerService,
    PerformanceMonitorService,
    CDNService
  ]
})
export class OptimizationModule {}
