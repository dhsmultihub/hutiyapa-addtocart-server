import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingEngineService } from '../services/pricing-engine.service';
import { DiscountService } from '../services/discount.service';
import { TaxService } from '../services/tax.service';
import { PromotionService } from '../services/promotion.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule
  ],
  controllers: [PricingController],
  providers: [
    PricingEngineService,
    DiscountService,
    TaxService,
    PromotionService
  ],
  exports: [
    PricingEngineService,
    DiscountService,
    TaxService,
    PromotionService
  ]
})
export class PricingModule {}
