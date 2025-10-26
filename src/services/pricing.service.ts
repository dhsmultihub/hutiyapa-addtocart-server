import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ProductClient } from '../clients/product.client';
import { ProductPricing } from '../types/product-integration.types';

export interface PriceComparison {
    productId: string;
    variantId?: string;
    cartPrice: number;
    currentPrice: number;
    priceDifference: number;
    isDiscounted: boolean;
    discountPercentage?: number;
    needsUpdate: boolean;
}

export interface PricingValidationResult {
    isValid: boolean;
    productId: string;
    variantId?: string;
    cartPrice: number;
    currentPrice: number;
    priceDifference: number;
    isDiscounted: boolean;
    discountPercentage?: number;
    warnings: string[];
    errors: string[];
}

export interface BulkPricingResult {
    results: PricingValidationResult[];
    summary: {
        totalItems: number;
        validPrices: number;
        invalidPrices: number;
        discountedItems: number;
        itemsNeedingUpdate: number;
    };
}

@Injectable()
export class PricingService {
    private readonly logger = new Logger(PricingService.name);

    constructor(private readonly productClient: ProductClient) { }

    /**
     * Get current pricing for a product
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
     * Compare cart price with current price
     */
    async comparePricing(
        productId: string,
        variantId: string | undefined,
        cartPrice: number
    ): Promise<PriceComparison> {
        try {
            const currentPricing = await this.getCurrentPricing(productId, variantId);
            const priceDifference = cartPrice - currentPricing.price;
            const isDiscounted = cartPrice < currentPricing.price;
            const discountPercentage = isDiscounted
                ? Math.round(((currentPricing.price - cartPrice) / currentPricing.price) * 100)
                : undefined;

            return {
                productId,
                variantId,
                cartPrice,
                currentPrice: currentPricing.price,
                priceDifference,
                isDiscounted,
                discountPercentage,
                needsUpdate: Math.abs(priceDifference) > 0.01 // Allow small rounding differences
            };

        } catch (error) {
            this.logger.error(`Failed to compare pricing for ${productId}:`, error.message);
            return {
                productId,
                variantId,
                cartPrice,
                currentPrice: cartPrice,
                priceDifference: 0,
                isDiscounted: false,
                needsUpdate: false
            };
        }
    }

    /**
     * Validate pricing for cart items
     */
    async validatePricing(
        productId: string,
        variantId: string | undefined,
        cartPrice: number
    ): Promise<PricingValidationResult> {
        const warnings: string[] = [];
        const errors: string[] = [];

        try {
            const comparison = await this.comparePricing(productId, variantId, cartPrice);

            // Check for significant price differences
            if (comparison.needsUpdate) {
                if (comparison.priceDifference > 0) {
                    warnings.push(`Cart price is higher than current price (${comparison.priceDifference.toFixed(2)})`);
                } else {
                    warnings.push(`Cart price is lower than current price (${Math.abs(comparison.priceDifference).toFixed(2)})`);
                }
            }

            // Check for invalid pricing
            if (cartPrice <= 0) {
                errors.push('Invalid cart price');
            }

            if (comparison.currentPrice <= 0) {
                errors.push('Invalid current product price');
            }

            // Check for unusually high discounts
            if (comparison.isDiscounted && comparison.discountPercentage && comparison.discountPercentage > 50) {
                warnings.push(`Unusually high discount: ${comparison.discountPercentage}%`);
            }

            return {
                isValid: errors.length === 0,
                productId,
                variantId,
                cartPrice,
                currentPrice: comparison.currentPrice,
                priceDifference: comparison.priceDifference,
                isDiscounted: comparison.isDiscounted,
                discountPercentage: comparison.discountPercentage,
                warnings,
                errors
            };

        } catch (error) {
            this.logger.error(`Pricing validation failed for ${productId}:`, error.message);
            return {
                isValid: false,
                productId,
                variantId,
                cartPrice,
                currentPrice: 0,
                priceDifference: 0,
                isDiscounted: false,
                warnings: [],
                errors: [`Pricing validation failed: ${error.message}`]
            };
        }
    }

    /**
     * Validate pricing for multiple items
     */
    async validateBulkPricing(
        items: Array<{ productId: string; variantId?: string; cartPrice: number }>
    ): Promise<BulkPricingResult> {
        const results: PricingValidationResult[] = [];

        for (const item of items) {
            const validation = await this.validatePricing(
                item.productId,
                item.variantId,
                item.cartPrice
            );
            results.push(validation);
        }

        return {
            results,
            summary: {
                totalItems: items.length,
                validPrices: results.filter(r => r.isValid).length,
                invalidPrices: results.filter(r => !r.isValid).length,
                discountedItems: results.filter(r => r.isDiscounted).length,
                itemsNeedingUpdate: results.filter(r => r.warnings.length > 0).length
            }
        };
    }

    /**
     * Get pricing recommendations
     */
    async getPricingRecommendations(
        productId: string,
        variantId?: string
    ): Promise<{
        currentPrice: number;
        originalPrice?: number;
        discountPercentage?: number;
        isOnSale: boolean;
        saleEndsAt?: Date;
        priceHistory?: Array<{ date: Date; price: number }>;
    }> {
        try {
            const pricing = await this.getCurrentPricing(productId, variantId);

            return {
                currentPrice: pricing.price,
                originalPrice: pricing.originalPrice,
                discountPercentage: pricing.discountPercentage,
                isOnSale: pricing.originalPrice && pricing.price < pricing.originalPrice,
                saleEndsAt: pricing.validTo,
                priceHistory: [] // Would typically come from price history service
            };

        } catch (error) {
            this.logger.error(`Failed to get pricing recommendations for ${productId}:`, error.message);
            return {
                currentPrice: 0,
                isOnSale: false
            };
        }
    }

    /**
     * Calculate total cart value with current pricing
     */
    async calculateCartValueWithCurrentPricing(
        items: Array<{ productId: string; variantId?: string; quantity: number; cartPrice: number }>
    ): Promise<{
        cartTotal: number;
        currentTotal: number;
        difference: number;
        savings: number;
        items: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
            cartPrice: number;
            currentPrice: number;
            difference: number;
        }>;
    }> {
        const itemsWithCurrentPricing: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
            cartPrice: number;
            currentPrice: number;
            difference: number;
        }> = [];

        let cartTotal = 0;
        let currentTotal = 0;

        for (const item of items) {
            try {
                const currentPricing = await this.getCurrentPricing(item.productId, item.variantId);
                const itemCartTotal = item.cartPrice * item.quantity;
                const itemCurrentTotal = currentPricing.price * item.quantity;
                const difference = itemCartTotal - itemCurrentTotal;

                itemsWithCurrentPricing.push({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    cartPrice: item.cartPrice,
                    currentPrice: currentPricing.price,
                    difference
                });

                cartTotal += itemCartTotal;
                currentTotal += itemCurrentTotal;

            } catch (error) {
                this.logger.error(`Failed to get current pricing for ${item.productId}:`, error.message);
                // Use cart price as fallback
                const itemCartTotal = item.cartPrice * item.quantity;
                itemsWithCurrentPricing.push({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    cartPrice: item.cartPrice,
                    currentPrice: item.cartPrice,
                    difference: 0
                });
                cartTotal += itemCartTotal;
                currentTotal += itemCartTotal;
            }
        }

        return {
            cartTotal,
            currentTotal,
            difference: cartTotal - currentTotal,
            savings: Math.max(0, cartTotal - currentTotal),
            items: itemsWithCurrentPricing
        };
    }

    /**
     * Get price alerts for cart items
     */
    async getPriceAlerts(
        items: Array<{ productId: string; variantId?: string; cartPrice: number }>
    ): Promise<Array<{
        productId: string;
        variantId?: string;
        cartPrice: number;
        currentPrice: number;
        alertType: 'price_increased' | 'price_decreased' | 'discount_available' | 'no_change';
        message: string;
    }>> {
        const alerts: Array<{
            productId: string;
            variantId?: string;
            cartPrice: number;
            currentPrice: number;
            alertType: 'price_increased' | 'price_decreased' | 'discount_available' | 'no_change';
            message: string;
        }> = [];

        for (const item of items) {
            try {
                const comparison = await this.comparePricing(item.productId, item.variantId, item.cartPrice);

                let alertType: 'price_increased' | 'price_decreased' | 'discount_available' | 'no_change' = 'no_change';
                let message = '';

                if (comparison.priceDifference > 0.01) {
                    alertType = 'price_increased';
                    message = `Price increased by ${comparison.priceDifference.toFixed(2)}`;
                } else if (comparison.priceDifference < -0.01) {
                    alertType = 'price_decreased';
                    message = `Price decreased by ${Math.abs(comparison.priceDifference).toFixed(2)}`;
                } else if (comparison.isDiscounted && comparison.discountPercentage && comparison.discountPercentage > 10) {
                    alertType = 'discount_available';
                    message = `${comparison.discountPercentage}% discount available`;
                }

                if (alertType !== 'no_change') {
                    alerts.push({
                        productId: item.productId,
                        variantId: item.variantId,
                        cartPrice: item.cartPrice,
                        currentPrice: comparison.currentPrice,
                        alertType,
                        message
                    });
                }

            } catch (error) {
                this.logger.error(`Failed to get price alert for ${item.productId}:`, error.message);
            }
        }

        return alerts;
    }

    /**
     * Update cart prices to current pricing
     */
    async updateCartPricesToCurrent(
        items: Array<{ productId: string; variantId?: string; quantity: number }>
    ): Promise<Array<{
        productId: string;
        variantId?: string;
        quantity: number;
        oldPrice: number;
        newPrice: number;
        difference: number;
    }>> {
        const updatedItems: Array<{
            productId: string;
            variantId?: string;
            quantity: number;
            oldPrice: number;
            newPrice: number;
            difference: number;
        }> = [];

        for (const item of items) {
            try {
                const currentPricing = await this.getCurrentPricing(item.productId, item.variantId);

                updatedItems.push({
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    oldPrice: 0, // Would need to be passed from cart
                    newPrice: currentPricing.price,
                    difference: currentPricing.price - 0
                });

            } catch (error) {
                this.logger.error(`Failed to update price for ${item.productId}:`, error.message);
            }
        }

        return updatedItems;
    }
}
