export enum DiscountType {
    PERCENTAGE = 'percentage',
    FIXED_AMOUNT = 'fixed_amount',
    FREE_SHIPPING = 'free_shipping',
    BUY_X_GET_Y = 'buy_x_get_y',
    BULK_DISCOUNT = 'bulk_discount'
}

export enum PromotionType {
    COUPON = 'coupon',
    SEASONAL = 'seasonal',
    LOYALTY = 'loyalty',
    BULK = 'bulk',
    FIRST_TIME = 'first_time',
    BIRTHDAY = 'birthday',
    REFERRAL = 'referral'
}

export enum TaxType {
    VAT = 'vat',
    GST = 'gst',
    SALES_TAX = 'sales_tax',
    CONSUMPTION_TAX = 'consumption_tax'
}

export enum Currency {
    USD = 'USD',
    EUR = 'EUR',
    GBP = 'GBP',
    CAD = 'CAD',
    AUD = 'AUD',
    JPY = 'JPY',
    INR = 'INR'
}

export interface PriceBreakdown {
    subtotal: number;
    discounts: DiscountApplication[];
    discountTotal: number;
    taxes: TaxApplication[];
    taxTotal: number;
    shipping: number;
    total: number;
    currency: Currency;
}

export interface DiscountApplication {
    id: string;
    type: DiscountType;
    name: string;
    description?: string;
    value: number;
    appliedAmount: number;
    isStackable: boolean;
    promotionId?: string;
    couponCode?: string;
    metadata?: Record<string, any>;
}

export interface TaxApplication {
    id: string;
    type: TaxType;
    name: string;
    rate: number;
    appliedAmount: number;
    region: string;
    isInclusive: boolean;
    metadata?: Record<string, any>;
}

export interface Discount {
    id: string;
    code: string;
    name: string;
    description?: string;
    type: DiscountType;
    value: number;
    minimumOrderAmount?: number;
    maximumDiscountAmount?: number;
    isActive: boolean;
    isStackable: boolean;
    validFrom: Date;
    validTo: Date;
    usageLimit?: number;
    usageCount: number;
    applicableProducts?: string[];
    applicableCategories?: string[];
    applicableUsers?: string[];
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Promotion {
    id: string;
    name: string;
    description?: string;
    type: PromotionType;
    isActive: boolean;
    validFrom: Date;
    validTo: Date;
    conditions: PromotionCondition[];
    rewards: PromotionReward[];
    usageLimit?: number;
    usageCount: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface PromotionCondition {
    type: 'minimum_order_amount' | 'minimum_quantity' | 'specific_products' | 'specific_categories' | 'user_type' | 'time_based';
    value: any;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
}

export interface PromotionReward {
    type: 'discount' | 'free_shipping' | 'free_product' | 'points';
    value: number;
    description?: string;
}

export interface TaxRate {
    id: string;
    region: string;
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
    type: TaxType;
    rate: number;
    isInclusive: boolean;
    applicableProducts?: string[];
    applicableCategories?: string[];
    isActive: boolean;
    validFrom: Date;
    validTo?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface PriceHistory {
    id: string;
    productId: string;
    variantId?: string;
    price: number;
    currency: Currency;
    previousPrice?: number;
    changeReason: 'manual' | 'automatic' | 'promotion' | 'seasonal' | 'cost_change';
    effectiveFrom: Date;
    effectiveTo?: Date;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface PricingRequest {
    items: PricingItem[];
    shippingAddress?: ShippingAddress;
    billingAddress?: BillingAddress;
    userId?: string;
    sessionId?: string;
    couponCodes?: string[];
    promotionIds?: string[];
    currency?: Currency;
    metadata?: Record<string, any>;
}

export interface PricingItem {
    productId: string;
    variantId?: string;
    quantity: number;
    unitPrice: number;
    category?: string;
    metadata?: Record<string, any>;
}

export interface ShippingAddress {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
}

export interface BillingAddress {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
}

export interface PricingResponse {
    breakdown: PriceBreakdown;
    appliedDiscounts: DiscountApplication[];
    appliedTaxes: TaxApplication[];
    appliedPromotions: Promotion[];
    currency: Currency;
    metadata?: Record<string, any>;
}

export interface DiscountValidationRequest {
    couponCode: string;
    userId?: string;
    items: PricingItem[];
    shippingAddress?: ShippingAddress;
    billingAddress?: BillingAddress;
}

export interface DiscountValidationResponse {
    isValid: boolean;
    discount?: Discount;
    errorMessage?: string;
    warnings?: string[];
}

export interface TaxCalculationRequest {
    items: PricingItem[];
    shippingAddress: ShippingAddress;
    billingAddress?: BillingAddress;
    userId?: string;
}

export interface TaxCalculationResponse {
    taxes: TaxApplication[];
    totalTax: number;
    currency: Currency;
    metadata?: Record<string, any>;
}

export interface PromotionApplicationRequest {
    promotionId: string;
    userId?: string;
    items: PricingItem[];
    shippingAddress?: ShippingAddress;
    billingAddress?: BillingAddress;
}

export interface PromotionApplicationResponse {
    isApplicable: boolean;
    promotion?: Promotion;
    rewards: PromotionReward[];
    errorMessage?: string;
}

export interface PriceComparisonRequest {
    productId: string;
    variantId?: string;
    quantity: number;
    currency?: Currency;
    region?: string;
}

export interface PriceComparisonResponse {
    currentPrice: number;
    previousPrice?: number;
    priceChange: number;
    priceChangePercentage: number;
    currency: Currency;
    priceHistory: PriceHistory[];
    metadata?: Record<string, any>;
}

export interface PricingAnalytics {
    totalRevenue: number;
    averageOrderValue: number;
    discountUsage: {
        totalDiscounts: number;
        totalSavings: number;
        averageDiscount: number;
        topDiscounts: Array<{
            discountId: string;
            name: string;
            usageCount: number;
            totalSavings: number;
        }>;
    };
    taxAnalytics: {
        totalTaxCollected: number;
        averageTaxRate: number;
        taxByRegion: Array<{
            region: string;
            totalTax: number;
            orderCount: number;
        }>;
    };
    promotionAnalytics: {
        totalPromotions: number;
        activePromotions: number;
        totalSavings: number;
        topPromotions: Array<{
            promotionId: string;
            name: string;
            usageCount: number;
            totalSavings: number;
        }>;
    };
    priceHistoryAnalytics: {
        totalPriceChanges: number;
        averagePriceChange: number;
        productsWithPriceChanges: number;
        topPriceChanges: Array<{
            productId: string;
            productName: string;
            priceChange: number;
            priceChangePercentage: number;
        }>;
    };
}

export interface PricingConfiguration {
    defaultCurrency: Currency;
    taxInclusive: boolean;
    discountRounding: 'round_up' | 'round_down' | 'round_nearest';
    taxRounding: 'round_up' | 'round_down' | 'round_nearest';
    maximumDiscountPercentage: number;
    maximumStackableDiscounts: number;
    priceUpdateFrequency: 'realtime' | 'hourly' | 'daily';
    auditTrailEnabled: boolean;
    metadata?: Record<string, any>;
}

export interface PricingError {
    code: string;
    message: string;
    field?: string;
    value?: any;
    metadata?: Record<string, any>;
}

export interface PricingValidationResult {
    isValid: boolean;
    errors: PricingError[];
    warnings: string[];
    metadata?: Record<string, any>;
}

