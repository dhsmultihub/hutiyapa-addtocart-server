import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { BulkOperationsService } from './operations/bulk-operations.service';
import { CartMergerService } from './operations/cart-merger.service';
import { ItemManagerService } from './operations/item-manager.service';
import { CartValidatorService } from './validation/cart-validator.service';
import { ItemValidatorService } from './validation/item-validator.service';
import { PricingEngineService } from '../services/pricing-engine.service';
import { DiscountService } from '../services/discount.service';
import { TaxService } from '../services/tax.service';
import { PromotionService } from '../services/promotion.service';

@Module({
  controllers: [CartController],
  providers: [
    CartService,
    BulkOperationsService,
    CartMergerService,
    ItemManagerService,
    CartValidatorService,
    ItemValidatorService,
    PricingEngineService,
    DiscountService,
    TaxService,
    PromotionService,
  ],
  exports: [
    CartService,
    BulkOperationsService,
    CartMergerService,
    ItemManagerService,
    CartValidatorService,
    ItemValidatorService,
  ],
})
export class CartModule { }
