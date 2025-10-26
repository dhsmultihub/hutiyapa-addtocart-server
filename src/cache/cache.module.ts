import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheStrategyService } from './cache-strategy.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule
  ],
  providers: [
    RedisService,
    CacheStrategyService,
    CacheInvalidationService
  ],
  exports: [
    RedisService,
    CacheStrategyService,
    CacheInvalidationService
  ]
})
export class CacheModule {}
