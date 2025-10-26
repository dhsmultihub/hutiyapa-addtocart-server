import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ProductClient } from '../clients/product.client';
import {
    Product,
    ProductVariant,
    ProductPricing,
    InventoryStatus,
    ProductValidationResult,
    BulkProductValidationResult,
    ProductSearchParams,
    ProductSearchResult,
    ProductRecommendation
} from '../types/product-integration.types';

@Injectable()
export class ProductApiService {
    private readonly logger = new Logger(ProductApiService.name);

    constructor(private readonly productClient: ProductClient) { }

    /**
     * Get product with full details
     */
    async getProductDetails(productId: string, variantId?: string): Promise<{
        product: Product;
        variant?: ProductVariant;
        pricing: ProductPricing;
        inventory: InventoryStatus;
    }> {
        try {
            const [product, pricing, inventory] = await Promise.all([
                this.productClient.getProduct(productId),
                this.productClient.getProductPricing(productId, variantId),
                this.productClient.getInventoryStatus(productId, variantId)
            ]);

            let variant: ProductVariant | undefined;
            if (variantId) {
                variant = await this.productClient.getProductVariant(productId, variantId);
            }

            return {
                product,
                variant,
                pricing,
                inventory
            };
        } catch (error) {
            this.logger.error(`Failed to get product details for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get product details: ${error.message}`);
        }
    }

    /**
     * Validate product for cart operations
     */
    async validateProductForCart(
        productId: string,
        variantId: string | undefined,
        quantity: number
    ): Promise<ProductValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const details = await this.getProductDetails(productId, variantId);

            // Check if product is active
            if (!details.product.isActive) {
                errors.push('Product is not active');
            }

            if (details.product.isDiscontinued) {
                warnings.push('Product is discontinued');
            }

            // Check variant if specified
            if (variantId && details.variant) {
                if (!details.variant.isActive) {
                    errors.push('Product variant is not active');
                }
            }

            // Check stock availability
            if (details.inventory.available < quantity) {
                errors.push(`Insufficient stock: ${details.inventory.available} available, ${quantity} requested`);
            }

            if (details.inventory.isLowStock) {
                warnings.push('Product is running low on stock');
            }

            // Check pricing
            if (details.pricing.price <= 0) {
                errors.push('Invalid product pricing');
            }

            return {
                isValid: errors.length === 0,
                productId,
                variantId,
                errors,
                warnings,
                data: details
            };

        } catch (error) {
            this.logger.error(`Product validation failed for ${productId}:`, error.message);
            return {
                isValid: false,
                productId,
                variantId,
                errors: [`Validation failed: ${error.message}`],
                warnings: [],
                data: undefined
            };
        }
    }

    /**
     * Validate multiple products in batch
     */
    async validateProductsForCart(
        items: Array<{ productId: string; variantId?: string; quantity: number }>
    ): Promise<BulkProductValidationResult> {
        const results: ProductValidationResult[] = [];

        for (const item of items) {
            const validation = await this.validateProductForCart(
                item.productId,
                item.variantId,
                item.quantity
            );
            results.push(validation);
        }

        return {
            results,
            summary: {
                totalItems: items.length,
                validItems: results.filter(r => r.isValid).length,
                invalidItems: results.filter(r => !r.isValid).length,
                warningItems: results.filter(r => r.warnings.length > 0).length
            }
        };
    }

    /**
     * Get current pricing for products
     */
    async getCurrentPricing(productId: string, variantId?: string): Promise<ProductPricing> {
        try {
            return await this.productClient.getProductPricing(productId, variantId);
        } catch (error) {
            this.logger.error(`Failed to get pricing for ${productId}:`, error.message);
            throw new BadRequestException(`Failed to get product pricing: ${error.message}`);
        }
    }

    /**
     * Check if products are in stock
     */
    async checkStockAvailability(
        productId: string,
        variantId: string | undefined,
        quantity: number
    ): Promise<{
        available: boolean;
        stock: number;
        canFulfill: boolean;
        estimatedRestock?: Date;
    }> {
        try {
            return await this.productClient.checkProductAvailability(productId, variantId, quantity);
        } catch (error) {
            this.logger.error(`Failed to check stock for ${productId}:`, error.message);
            return {
                available: false,
                stock: 0,
                canFulfill: false
            };
        }
    }

    /**
     * Search products with filters
     */
    async searchProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
        try {
            return await this.productClient.searchProducts(params);
        } catch (error) {
            this.logger.error('Product search failed:', error.message);
            throw new BadRequestException(`Product search failed: ${error.message}`);
        }
    }

    /**
     * Get product recommendations
     */
    async getProductRecommendations(
        productId: string,
        variantId?: string,
        type?: 'alternative' | 'upsell' | 'cross-sell'
    ): Promise<ProductRecommendation[]> {
        try {
            return await this.productClient.getProductRecommendations(productId, variantId, type);
        } catch (error) {
            this.logger.error(`Failed to get recommendations for ${productId}:`, error.message);
            return [];
        }
    }

    /**
     * Get product alternatives
     */
    async getProductAlternatives(productId: string, variantId?: string): Promise<Product[]> {
        try {
            const recommendations = await this.getProductRecommendations(productId, variantId, 'alternative');

            // Get full product details for alternatives
            const alternatives = await Promise.all(
                recommendations.map(async (rec) => {
                    try {
                        return await this.productClient.getProduct(rec.productId);
                    } catch (error) {
                        this.logger.warn(`Failed to get alternative product ${rec.productId}:`, error.message);
                        return null;
                    }
                })
            );

            return alternatives.filter(Boolean) as Product[];
        } catch (error) {
            this.logger.error(`Failed to get alternatives for ${productId}:`, error.message);
            return [];
        }
    }

    /**
     * Get upsell products
     */
    async getUpsellProducts(productId: string, variantId?: string): Promise<Product[]> {
        try {
            const recommendations = await this.getProductRecommendations(productId, variantId, 'upsell');

            const upsells = await Promise.all(
                recommendations.map(async (rec) => {
                    try {
                        return await this.productClient.getProduct(rec.productId);
                    } catch (error) {
                        this.logger.warn(`Failed to get upsell product ${rec.productId}:`, error.message);
                        return null;
                    }
                })
            );

            return upsells.filter(Boolean) as Product[];
        } catch (error) {
            this.logger.error(`Failed to get upsells for ${productId}:`, error.message);
            return [];
        }
    }

    /**
     * Check if product exists and is valid
     */
    async isProductValid(productId: string, variantId?: string): Promise<boolean> {
        try {
            const validation = await this.validateProductForCart(productId, variantId, 1);
            return validation.isValid;
        } catch (error) {
            this.logger.error(`Product validation check failed for ${productId}:`, error.message);
            return false;
        }
    }

    /**
     * Get product health status
     */
    async getProductServiceHealth(): Promise<{
        status: string;
        timestamp: Date;
        version?: string;
    }> {
        try {
            return await this.productClient.healthCheck();
        } catch (error) {
            this.logger.error('Product service health check failed:', error.message);
            return {
                status: 'unhealthy',
                timestamp: new Date()
            };
        }
    }
}
