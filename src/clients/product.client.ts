import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import {
    Product,
    ProductVariant,
    ProductPricing,
    InventoryStatus,
    ProductSearchParams,
    ProductSearchResult,
    ProductRecommendation,
    ProductServiceConfig,
    ProductServiceError
} from '../types/product-integration.types';

@Injectable()
export class ProductClient {
    private readonly logger = new Logger(ProductClient.name);
    private readonly config: ProductServiceConfig;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) {
        this.config = {
            baseUrl: this.configService.get('PRODUCT_SERVICE_URL', 'http://localhost:3002'),
            apiKey: this.configService.get('PRODUCT_SERVICE_API_KEY', ''),
            timeout: parseInt(this.configService.get('PRODUCT_SERVICE_TIMEOUT', '5000'), 10),
            retryAttempts: parseInt(this.configService.get('PRODUCT_SERVICE_RETRY_ATTEMPTS', '3'), 10),
            cacheTtl: parseInt(this.configService.get('PRODUCT_CACHE_TTL', '300'), 10)
        };
    }

    /**
     * Get product by ID
     */
    async getProduct(productId: string): Promise<Product> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.config.baseUrl}/api/v1/products/${productId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get product ${productId}:`, error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Get product variant by ID
     */
    async getProductVariant(productId: string, variantId: string): Promise<ProductVariant> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.config.baseUrl}/api/v1/products/${productId}/variants/${variantId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get product variant ${productId}/${variantId}:`, error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Get product pricing
     */
    async getProductPricing(productId: string, variantId?: string): Promise<ProductPricing> {
        try {
            const url = variantId
                ? `${this.config.baseUrl}/api/v1/products/${productId}/variants/${variantId}/pricing`
                : `${this.config.baseUrl}/api/v1/products/${productId}/pricing`;

            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get pricing for ${productId}/${variantId}:`, error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Get inventory status
     */
    async getInventoryStatus(productId: string, variantId?: string): Promise<InventoryStatus> {
        try {
            const url = variantId
                ? `${this.config.baseUrl}/api/v1/products/${productId}/variants/${variantId}/inventory`
                : `${this.config.baseUrl}/api/v1/products/${productId}/inventory`;

            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get inventory for ${productId}/${variantId}:`, error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Search products
     */
    async searchProducts(params: ProductSearchParams): Promise<ProductSearchResult> {
        try {
            const queryParams = new URLSearchParams();

            if (params.query) queryParams.append('q', params.query);
            if (params.category) queryParams.append('category', params.category);
            if (params.brand) queryParams.append('brand', params.brand);
            if (params.minPrice) queryParams.append('minPrice', params.minPrice.toString());
            if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
            if (params.inStock !== undefined) queryParams.append('inStock', params.inStock.toString());
            if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
            if (params.limit) queryParams.append('limit', params.limit.toString());
            if (params.offset) queryParams.append('offset', params.offset.toString());
            if (params.sortBy) queryParams.append('sortBy', params.sortBy);
            if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

            const response = await firstValueFrom(
                this.httpService.get(`${this.config.baseUrl}/api/v1/products/search?${queryParams}`, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error('Failed to search products:', error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
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
            const url = variantId
                ? `${this.config.baseUrl}/api/v1/products/${productId}/variants/${variantId}/recommendations`
                : `${this.config.baseUrl}/api/v1/products/${productId}/recommendations`;

            const queryParams = new URLSearchParams();
            if (type) queryParams.append('type', type);

            const response = await firstValueFrom(
                this.httpService.get(`${url}?${queryParams}`, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get recommendations for ${productId}:`, error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Validate multiple products in batch
     */
    async validateProducts(products: Array<{ productId: string; variantId?: string }>): Promise<{
        valid: string[];
        invalid: string[];
        errors: Record<string, string>;
    }> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.config.baseUrl}/api/v1/products/validate`, {
                    products
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(this.config.timeout),
                    retry(this.config.retryAttempts),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error('Failed to validate products:', error.message);
            throw new HttpException(
                `Product service error: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Get product availability
     */
    async checkProductAvailability(
        productId: string,
        variantId?: string,
        quantity: number = 1
    ): Promise<{
        available: boolean;
        stock: number;
        canFulfill: boolean;
        estimatedRestock?: Date;
    }> {
        try {
            const inventory = await this.getInventoryStatus(productId, variantId);

            return {
                available: inventory.isInStock,
                stock: inventory.available,
                canFulfill: inventory.available >= quantity,
                estimatedRestock: inventory.estimatedRestock
            };
        } catch (error) {
            this.logger.error(`Failed to check availability for ${productId}:`, error.message);
            return {
                available: false,
                stock: 0,
                canFulfill: false
            };
        }
    }

    /**
     * Health check for product service
     */
    async healthCheck(): Promise<{ status: string; timestamp: Date; version?: string }> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.config.baseUrl}/api/v1/health`, {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }).pipe(
                    timeout(3000),
                    catchError(this.handleError)
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error('Product service health check failed:', error.message);
            throw new HttpException(
                `Product service unavailable: ${error.message}`,
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }
    }

    /**
     * Handle HTTP errors
     */
    private handleError = (error: any) => {
        this.logger.error('Product service request failed:', error.message);

        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.message || error.message;

            throw new HttpException(
                `Product service error (${status}): ${message}`,
                status
            );
        }

        throw new HttpException(
            `Product service connection error: ${error.message}`,
            HttpStatus.SERVICE_UNAVAILABLE
        );
    };
}
