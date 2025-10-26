import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from '../services/checkout.service';
import { PaymentService } from '../services/payment.service';
import { OrderService } from '../services/order.service';
import { CheckoutValidationService } from '../services/checkout-validation.service';
import { CartValidatorService } from '../cart/validation/cart-validator.service';
import { InventoryService } from '../services/inventory.service';
import { PricingService } from '../services/pricing.service';
import { ProductApiService } from '../services/product-api.service';
import { ProductIntegrationModule } from '../product-integration/product-integration.module';

@Module({
  imports: [HttpModule, ProductIntegrationModule],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    PaymentService,
    OrderService,
    CheckoutValidationService,
    CartValidatorService,
    InventoryService,
    PricingService,
    ProductApiService,
  ],
  exports: [
    CheckoutService,
    PaymentService,
    OrderService,
    CheckoutValidationService,
  ],
})
export class CheckoutModule {}
