import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProductClient } from '../clients/product.client';
import { ProductApiService } from '../services/product-api.service';
import { InventoryService } from '../services/inventory.service';
import { PricingService } from '../services/pricing.service';
import { ProductIntegrationController } from './product-integration.controller';

@Module({
    imports: [HttpModule],
    controllers: [ProductIntegrationController],
    providers: [
        ProductClient,
        ProductApiService,
        InventoryService,
        PricingService,
    ],
    exports: [
        ProductClient,
        ProductApiService,
        InventoryService,
        PricingService,
    ],
})
export class ProductIntegrationModule { }
