import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    Logger,
    BadRequestException,
    UseGuards
} from '@nestjs/common';
import { ProductApiService } from '../services/product-api.service';
import { InventoryService } from '../services/inventory.service';
import { PricingService } from '../services/pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
    ProductSearchParams,
    ProductValidationResult,
    BulkProductValidationResult
} from '../types/product-integration.types';

@Controller('products')
export class ProductIntegrationController {
    private readonly logger = new Logger(ProductIntegrationController.name);

    constructor(
        private readonly productApiService: ProductApiService,
        private readonly inventoryService: InventoryService,
        private readonly pricingService: PricingService,
    ) { }

    /**
     * Get product details
     */
    @Get(':productId')
    async getProduct(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string
    ) {
        try {
            return await this.productApiService.getProductDetails(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get product ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get product: ${error.message}`);
        }
    }

    /**
     * Search products
     */
    @Get('search')
    async searchProducts(@Query() params: ProductSearchParams) {
        try {
            return await this.productApiService.searchProducts(params);
        } catch (error) {
            this.logger.error('Product search failed:', error.message);
            throw new BadRequestException(`Product search failed: ${error.message}`);
        }
    }

    /**
     * Validate product for cart
     */
    @Post('validate')
    async validateProduct(
        @Body() body: { productId: string; variantId?: string; quantity: number }
    ): Promise<ProductValidationResult> {
        try {
            return await this.productApiService.validateProductForCart(
                body.productId,
                body.variantId,
                body.quantity
            );
        } catch (error) {
            this.logger.error('Product validation failed:', error.message);
            throw new BadRequestException(`Product validation failed: ${error.message}`);
        }
    }

    /**
     * Validate multiple products
     */
    @Post('validate/bulk')
    async validateProducts(
        @Body() body: { items: Array<{ productId: string; variantId?: string; quantity: number }> }
    ): Promise<BulkProductValidationResult> {
        try {
            return await this.productApiService.validateProductsForCart(body.items);
        } catch (error) {
            this.logger.error('Bulk product validation failed:', error.message);
            throw new BadRequestException(`Bulk product validation failed: ${error.message}`);
        }
    }

    /**
     * Get product recommendations
     */
    @Get(':productId/recommendations')
    async getProductRecommendations(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string,
        @Query('type') type?: 'alternative' | 'upsell' | 'cross-sell'
    ) {
        try {
            return await this.productApiService.getProductRecommendations(productId, variantId, type);
        } catch (error) {
            this.logger.error(`Failed to get recommendations for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get recommendations: ${error.message}`);
        }
    }

    /**
     * Get product alternatives
     */
    @Get(':productId/alternatives')
    async getProductAlternatives(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string
    ) {
        try {
            return await this.productApiService.getProductAlternatives(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get alternatives for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get alternatives: ${error.message}`);
        }
    }

    /**
     * Get upsell products
     */
    @Get(':productId/upsells')
    async getUpsellProducts(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string
    ) {
        try {
            return await this.productApiService.getUpsellProducts(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get upsells for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get upsells: ${error.message}`);
        }
    }

    /**
     * Check inventory availability
     */
    @Post('inventory/check')
    async checkInventory(
        @Body() body: { items: Array<{ productId: string; variantId?: string; quantity: number }> }
    ) {
        try {
            return await this.inventoryService.checkInventoryAvailability(body.items);
        } catch (error) {
            this.logger.error('Inventory check failed:', error.message);
            throw new BadRequestException(`Inventory check failed: ${error.message}`);
        }
    }

    /**
     * Reserve inventory
     */
    @Post('inventory/reserve')
    @UseGuards(JwtAuthGuard)
    async reserveInventory(
        @Body() body: {
            cartId: string;
            sessionId: string;
            items: Array<{ productId: string; variantId?: string; quantity: number }>;
            duration?: number;
        },
        @CurrentUser() user: any
    ) {
        try {
            return await this.inventoryService.reserveInventory(
                body.cartId,
                body.sessionId,
                body.items,
                body.duration
            );
        } catch (error) {
            this.logger.error('Inventory reservation failed:', error.message);
            throw new BadRequestException(`Inventory reservation failed: ${error.message}`);
        }
    }

    /**
     * Release inventory reservations
     */
    @Post('inventory/release')
    @UseGuards(JwtAuthGuard)
    async releaseInventory(
        @Body() body: { cartId: string },
        @CurrentUser() user: any
    ) {
        try {
            await this.inventoryService.releaseInventoryReservations(body.cartId);
            return { success: true, message: 'Inventory reservations released' };
        } catch (error) {
            this.logger.error('Inventory release failed:', error.message);
            throw new BadRequestException(`Inventory release failed: ${error.message}`);
        }
    }

    /**
     * Get inventory status
     */
    @Get(':productId/inventory')
    async getInventoryStatus(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string
    ) {
        try {
            return await this.inventoryService.getInventoryStatus(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get inventory status for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get inventory status: ${error.message}`);
        }
    }

    /**
     * Get current pricing
     */
    @Get(':productId/pricing')
    async getCurrentPricing(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string
    ) {
        try {
            return await this.pricingService.getCurrentPricing(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get pricing for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get pricing: ${error.message}`);
        }
    }

    /**
     * Compare pricing
     */
    @Post('pricing/compare')
    async comparePricing(
        @Body() body: { productId: string; variantId?: string; cartPrice: number }
    ) {
        try {
            return await this.pricingService.comparePricing(
                body.productId,
                body.variantId,
                body.cartPrice
            );
        } catch (error) {
            this.logger.error('Pricing comparison failed:', error.message);
            throw new BadRequestException(`Pricing comparison failed: ${error.message}`);
        }
    }

    /**
     * Validate pricing
     */
    @Post('pricing/validate')
    async validatePricing(
        @Body() body: { productId: string; variantId?: string; cartPrice: number }
    ) {
        try {
            return await this.pricingService.validatePricing(
                body.productId,
                body.variantId,
                body.cartPrice
            );
        } catch (error) {
            this.logger.error('Pricing validation failed:', error.message);
            throw new BadRequestException(`Pricing validation failed: ${error.message}`);
        }
    }

    /**
     * Get pricing recommendations
     */
    @Get(':productId/pricing/recommendations')
    async getPricingRecommendations(
        @Param('productId') productId: string,
        @Query('variantId') variantId?: string
    ) {
        try {
            return await this.pricingService.getPricingRecommendations(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get pricing recommendations for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get pricing recommendations: ${error.message}`);
        }
    }

    /**
     * Calculate cart value with current pricing
     */
    @Post('pricing/calculate-cart-value')
    async calculateCartValue(
        @Body() body: {
            items: Array<{ productId: string; variantId?: string; quantity: number; cartPrice: number }>
        }
    ) {
        try {
            return await this.pricingService.calculateCartValueWithCurrentPricing(body.items);
        } catch (error) {
            this.logger.error('Cart value calculation failed:', error.message);
            throw new BadRequestException(`Cart value calculation failed: ${error.message}`);
        }
    }

    /**
     * Get price alerts
     */
    @Post('pricing/alerts')
    async getPriceAlerts(
        @Body() body: {
            items: Array<{ productId: string; variantId?: string; cartPrice: number }>
        }
    ) {
        try {
            return await this.pricingService.getPriceAlerts(body.items);
        } catch (error) {
            this.logger.error('Price alerts failed:', error.message);
            throw new BadRequestException(`Price alerts failed: ${error.message}`);
        }
    }

    /**
     * Health check for product service
     */
    @Public()
    @Get('health')
    async getProductServiceHealth() {
        try {
            return await this.productApiService.getProductServiceHealth();
        } catch (error) {
            this.logger.error('Product service health check failed:', error.message);
            return {
                status: 'unhealthy',
                timestamp: new Date(),
                error: error.message
            };
        }
    }

    /**
     * Get low stock products
     */
    @Get('inventory/low-stock')
    async getLowStockProducts(@Query('limit') limit?: number) {
        try {
            return await this.inventoryService.getLowStockProducts(limit);
        } catch (error) {
            this.logger.error('Failed to get low stock products:', error.message);
            throw new BadRequestException(`Failed to get low stock products: ${error.message}`);
        }
    }

    /**
     * Get inventory analytics
     */
    @Get('inventory/analytics')
    async getInventoryAnalytics() {
        try {
            return await this.inventoryService.getInventoryAnalytics();
        } catch (error) {
            this.logger.error('Failed to get inventory analytics:', error.message);
            throw new BadRequestException(`Failed to get inventory analytics: ${error.message}`);
        }
    }
}
