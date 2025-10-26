export interface Product {
    id: string;
    name: string;
    description?: string;
    category: string;
    brand?: string;
    sku: string;
    isActive: boolean;
    isDiscontinued: boolean;
    createdAt: Date;
    updatedAt: Date;
    variants: ProductVariant[];
    images: ProductImage[];
    attributes: Record<string, any>;
}

export interface ProductVariant {
    id: string;
    productId: string;
    name: string;
    sku: string;
    price: number;
    originalPrice?: number;
    stock: number;
    isActive: boolean;
    attributes: Record<string, any>;
    dimensions?: ProductDimensions;
    weight?: number;
}

export interface ProductImage {
    id: string;
    productId: string;
    variantId?: string;
    url: string;
    altText?: string;
    isPrimary: boolean;
    order: number;
}

export interface ProductDimensions {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in' | 'mm';
}

export interface ProductPricing {
    productId: string;
    variantId?: string;
    price: number;
    originalPrice?: number;
    discountPercentage?: number;
    currency: string;
    validFrom: Date;
    validTo?: Date;
    isActive: boolean;
}

export interface InventoryStatus {
    productId: string;
    variantId?: string;
    stock: number;
    reserved: number;
    available: number;
    isInStock: boolean;
    lowStockThreshold: number;
    isLowStock: boolean;
    estimatedRestock?: Date;
}

export interface ProductValidationResult {
    isValid: boolean;
    productId: string;
    variantId?: string;
    errors: string[];
    warnings: string[];
    data?: {
        product?: Product;
        variant?: ProductVariant;
        pricing?: ProductPricing;
        inventory?: InventoryStatus;
    };
}

export interface BulkProductValidationResult {
    results: ProductValidationResult[];
    summary: {
        totalItems: number;
        validItems: number;
        invalidItems: number;
        warningItems: number;
    };
}

export interface ProductServiceConfig {
    baseUrl: string;
    apiKey: string;
    timeout: number;
    retryAttempts: number;
    cacheTtl: number;
}

export interface ProductSearchParams {
    query?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    isActive?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}

export interface ProductSearchResult {
    products: Product[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface ProductRecommendation {
    productId: string;
    variantId?: string;
    reason: string;
    score: number;
    type: 'alternative' | 'upsell' | 'cross-sell' | 'frequently-bought-together';
}

export interface ProductUpdateEvent {
    type: 'product_updated' | 'price_changed' | 'stock_updated' | 'product_discontinued';
    productId: string;
    variantId?: string;
    timestamp: Date;
    data: any;
}

export interface ProductServiceError {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
}
