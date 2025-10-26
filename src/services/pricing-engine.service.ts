import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
    PricingRequest,
    PricingResponse,
    PriceBreakdown,
    DiscountApplication,
    TaxApplication,
    Currency,
    DiscountType,
    TaxType,
    PricingItem,
    PricingValidationResult,
    PricingError
} from '../types/pricing.types';
import { DiscountService } from './discount.service';
import { TaxService } from './tax.service';
import { PromotionService } from './promotion.service';

@Injectable()
export class PricingEngineService {
    private readonly logger = new Logger(PricingEngineService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly discountService: DiscountService,
        private readonly taxService: TaxService,
        private readonly promotionService: PromotionService
    ) { }

    /**
     * Calculate comprehensive pricing for items
     */
    async calculatePricing(request: PricingRequest): Promise<PricingResponse> {
        try {
            this.logger.log(`Calculating pricing for ${request.items.length} items`);

            // Validate request
            const validation = await this.validatePricingRequest(request);
            if (!validation.isValid) {
                throw new BadRequestException(`Invalid pricing request: ${validation.errors.map(e => e.message).join(', ')}`);
            }

            // Calculate subtotal
            const subtotal = this.calculateSubtotal(request.items);

            // Apply discounts
            const discountApplications = await this.applyDiscounts(request, subtotal);

            // Calculate discount total
            const discountTotal = discountApplications.reduce((sum, discount) => sum + discount.appliedAmount, 0);

            // Calculate after-discount amount
            const afterDiscountAmount = Math.max(0, subtotal - discountTotal);

            // Calculate taxes
            const taxApplications = await this.calculateTaxes(request, afterDiscountAmount);

            // Calculate tax total
            const taxTotal = taxApplications.reduce((sum, tax) => sum + tax.appliedAmount, 0);

            // Calculate shipping (simplified for now)
            const shipping = await this.calculateShipping(request);

            // Calculate final total
            const total = afterDiscountAmount + taxTotal + shipping;

            // Create price breakdown
            const breakdown: PriceBreakdown = {
                subtotal,
                discounts: discountApplications,
                discountTotal,
                taxes: taxApplications,
                taxTotal,
                shipping,
                total,
                currency: request.currency || Currency.USD
            };

            // Get applied promotions
            const appliedPromotions = await this.getAppliedPromotions(request);

            this.logger.log(`Pricing calculated: Subtotal: ${subtotal}, Discounts: ${discountTotal}, Tax: ${taxTotal}, Total: ${total}`);

            return {
                breakdown,
                appliedDiscounts: discountApplications,
                appliedTaxes: taxApplications,
                appliedPromotions,
                currency: request.currency || Currency.USD,
                metadata: {
                    calculatedAt: new Date(),
                    itemCount: request.items.length,
                    hasDiscounts: discountApplications.length > 0,
                    hasTaxes: taxApplications.length > 0
                }
            };

        } catch (error) {
            this.logger.error('Pricing calculation failed:', error.message);
            throw new BadRequestException(`Pricing calculation failed: ${error.message}`);
        }
    }

    /**
     * Calculate subtotal for items
     */
    private calculateSubtotal(items: PricingItem[]): number {
        return items.reduce((sum, item) => {
            return sum + (item.unitPrice * item.quantity);
        }, 0);
    }

    /**
     * Apply discounts to pricing
     */
    private async applyDiscounts(request: PricingRequest, subtotal: number): Promise<DiscountApplication[]> {
        const discountApplications: DiscountApplication[] = [];

        try {
            // Apply coupon codes
            if (request.couponCodes && request.couponCodes.length > 0) {
                for (const couponCode of request.couponCodes) {
                    const discount = await this.discountService.validateCoupon(couponCode, request);
                    if (discount) {
                        const appliedAmount = this.calculateDiscountAmount(discount, subtotal);
                        if (appliedAmount > 0) {
                            discountApplications.push({
                                id: discount.id,
                                type: discount.type,
                                name: discount.name,
                                description: discount.description,
                                value: discount.value,
                                appliedAmount,
                                isStackable: discount.isStackable,
                                couponCode: discount.code,
                                metadata: {
                                    discountId: discount.id,
                                    appliedAt: new Date()
                                }
                            });
                        }
                    }
                }
            }

            // Apply promotions
            if (request.promotionIds && request.promotionIds.length > 0) {
                for (const promotionId of request.promotionIds) {
                    const promotion = await this.promotionService.getPromotionById(promotionId);
                    if (promotion && await this.promotionService.isPromotionApplicable(promotion, request)) {
                        const rewards = await this.promotionService.applyPromotion(promotion, request);
                        for (const reward of rewards) {
                            if (reward.type === 'discount') {
                                const appliedAmount = this.calculatePromotionDiscount(reward, subtotal);
                                if (appliedAmount > 0) {
                                    discountApplications.push({
                                        id: `promo_${promotion.id}`,
                                        type: DiscountType.PERCENTAGE,
                                        name: promotion.name,
                                        description: promotion.description,
                                        value: reward.value,
                                        appliedAmount,
                                        isStackable: true,
                                        promotionId: promotion.id,
                                        metadata: {
                                            promotionId: promotion.id,
                                            rewardType: reward.type,
                                            appliedAt: new Date()
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Apply automatic discounts (bulk, seasonal, etc.)
            const automaticDiscounts = await this.getAutomaticDiscounts(request, subtotal);
            discountApplications.push(...automaticDiscounts);

            return discountApplications;

        } catch (error) {
            this.logger.error('Discount application failed:', error.message);
            return discountApplications;
        }
    }

    /**
     * Calculate discount amount based on discount type
     */
    private calculateDiscountAmount(discount: any, amount: number): number {
        switch (discount.type) {
            case DiscountType.PERCENTAGE:
                const percentageAmount = (amount * discount.value) / 100;
                return discount.maximumDiscountAmount
                    ? Math.min(percentageAmount, discount.maximumDiscountAmount)
                    : percentageAmount;

            case DiscountType.FIXED_AMOUNT:
                return Math.min(discount.value, amount);

            case DiscountType.FREE_SHIPPING:
                return 0; // Shipping discount handled separately

            default:
                return 0;
        }
    }

    /**
     * Calculate promotion discount amount
     */
    private calculatePromotionDiscount(reward: any, amount: number): number {
        if (reward.type === 'discount') {
            return (amount * reward.value) / 100;
        }
        return 0;
    }

    /**
     * Get automatic discounts (bulk, seasonal, etc.)
     */
    private async getAutomaticDiscounts(request: PricingRequest, subtotal: number): Promise<DiscountApplication[]> {
        const automaticDiscounts: DiscountApplication[] = [];

        try {
            // Bulk quantity discounts
            const bulkDiscounts = await this.discountService.getBulkDiscounts(request.items);
            for (const discount of bulkDiscounts) {
                const appliedAmount = this.calculateDiscountAmount(discount, subtotal);
                if (appliedAmount > 0) {
                    automaticDiscounts.push({
                        id: `bulk_${discount.id}`,
                        type: discount.type,
                        name: discount.name,
                        description: discount.description,
                        value: discount.value,
                        appliedAmount,
                        isStackable: discount.isStackable,
                        metadata: {
                            discountId: discount.id,
                            type: 'bulk',
                            appliedAt: new Date()
                        }
                    });
                }
            }

            // Seasonal discounts
            const seasonalDiscounts = await this.discountService.getSeasonalDiscounts(request);
            for (const discount of seasonalDiscounts) {
                const appliedAmount = this.calculateDiscountAmount(discount, subtotal);
                if (appliedAmount > 0) {
                    automaticDiscounts.push({
                        id: `seasonal_${discount.id}`,
                        type: discount.type,
                        name: discount.name,
                        description: discount.description,
                        value: discount.value,
                        appliedAmount,
                        isStackable: discount.isStackable,
                        metadata: {
                            discountId: discount.id,
                            type: 'seasonal',
                            appliedAt: new Date()
                        }
                    });
                }
            }

            return automaticDiscounts;

        } catch (error) {
            this.logger.error('Automatic discount calculation failed:', error.message);
            return automaticDiscounts;
        }
    }

    /**
     * Calculate taxes
     */
    private async calculateTaxes(request: PricingRequest, amount: number): Promise<TaxApplication[]> {
        try {
            if (!request.shippingAddress) {
                return [];
            }

            const taxApplications = await this.taxService.calculateTaxes({
                items: request.items,
                shippingAddress: request.shippingAddress,
                billingAddress: request.billingAddress,
                userId: request.userId
            });

            return taxApplications.taxes;

        } catch (error) {
            this.logger.error('Tax calculation failed:', error.message);
            return [];
        }
    }

    /**
     * Calculate shipping cost
     */
    private async calculateShipping(request: PricingRequest): Promise<number> {
        try {
            // Simplified shipping calculation
            // In a real implementation, this would integrate with shipping services
            const baseShipping = 9.99;
            const freeShippingThreshold = 50.00;

            const subtotal = this.calculateSubtotal(request.items);

            // Check for free shipping discounts
            const hasFreeShipping = await this.hasFreeShippingDiscount(request);

            if (hasFreeShipping || subtotal >= freeShippingThreshold) {
                return 0;
            }

            return baseShipping;

        } catch (error) {
            this.logger.error('Shipping calculation failed:', error.message);
            return 9.99; // Default shipping cost
        }
    }

    /**
     * Check for free shipping discounts
     */
    private async hasFreeShippingDiscount(request: PricingRequest): Promise<boolean> {
        try {
            if (request.couponCodes) {
                for (const couponCode of request.couponCodes) {
                    const discount = await this.discountService.validateCoupon(couponCode, request);
                    if (discount && discount.type === DiscountType.FREE_SHIPPING) {
                        return true;
                    }
                }
            }

            if (request.promotionIds) {
                for (const promotionId of request.promotionIds) {
                    const promotion = await this.promotionService.getPromotionById(promotionId);
                    if (promotion) {
                        const rewards = await this.promotionService.applyPromotion(promotion, request);
                        const hasFreeShipping = rewards.some(reward => reward.type === 'free_shipping');
                        if (hasFreeShipping) {
                            return true;
                        }
                    }
                }
            }

            return false;

        } catch (error) {
            this.logger.error('Free shipping check failed:', error.message);
            return false;
        }
    }

    /**
     * Get applied promotions
     */
    private async getAppliedPromotions(request: PricingRequest): Promise<any[]> {
        const appliedPromotions = [];

        try {
            if (request.promotionIds) {
                for (const promotionId of request.promotionIds) {
                    const promotion = await this.promotionService.getPromotionById(promotionId);
                    if (promotion) {
                        appliedPromotions.push(promotion);
                    }
                }
            }

            return appliedPromotions;

        } catch (error) {
            this.logger.error('Applied promotions retrieval failed:', error.message);
            return appliedPromotions;
        }
    }

    /**
     * Validate pricing request
     */
    private async validatePricingRequest(request: PricingRequest): Promise<PricingValidationResult> {
        const errors: PricingError[] = [];
        const warnings: string[] = [];

        // Validate items
        if (!request.items || request.items.length === 0) {
            errors.push({
                code: 'NO_ITEMS',
                message: 'At least one item is required for pricing calculation',
                field: 'items'
            });
        }

        // Validate item properties
        if (request.items) {
            request.items.forEach((item, index) => {
                if (!item.productId) {
                    errors.push({
                        code: 'MISSING_PRODUCT_ID',
                        message: 'Product ID is required for all items',
                        field: `items[${index}].productId`
                    });
                }

                if (!item.quantity || item.quantity <= 0) {
                    errors.push({
                        code: 'INVALID_QUANTITY',
                        message: 'Quantity must be greater than 0',
                        field: `items[${index}].quantity`,
                        value: item.quantity
                    });
                }

                if (!item.unitPrice || item.unitPrice < 0) {
                    errors.push({
                        code: 'INVALID_UNIT_PRICE',
                        message: 'Unit price must be greater than or equal to 0',
                        field: `items[${index}].unitPrice`,
                        value: item.unitPrice
                    });
                }
            });
        }

        // Validate currency
        if (request.currency && !Object.values(Currency).includes(request.currency)) {
            warnings.push(`Unsupported currency: ${request.currency}. Using USD as default.`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                validatedAt: new Date(),
                itemCount: request.items?.length || 0
            }
        };
    }

    /**
     * Get pricing analytics
     */
    async getPricingAnalytics(dateFrom?: Date, dateTo?: Date): Promise<any> {
        try {
            // This would typically query the database for pricing analytics
            // For now, return mock data
            return {
                totalRevenue: 0,
                averageOrderValue: 0,
                discountUsage: {
                    totalDiscounts: 0,
                    totalSavings: 0,
                    averageDiscount: 0,
                    topDiscounts: []
                },
                taxAnalytics: {
                    totalTaxCollected: 0,
                    averageTaxRate: 0,
                    taxByRegion: []
                },
                promotionAnalytics: {
                    totalPromotions: 0,
                    activePromotions: 0,
                    totalSavings: 0,
                    topPromotions: []
                },
                priceHistoryAnalytics: {
                    totalPriceChanges: 0,
                    averagePriceChange: 0,
                    productsWithPriceChanges: 0,
                    topPriceChanges: []
                }
            };

        } catch (error) {
            this.logger.error('Pricing analytics retrieval failed:', error.message);
            throw new BadRequestException(`Pricing analytics retrieval failed: ${error.message}`);
        }
    }
}
