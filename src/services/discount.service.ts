import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  Discount, 
  DiscountType, 
  PricingRequest, 
  DiscountValidationRequest, 
  DiscountValidationResponse,
  PricingItem
} from '../types/pricing.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new discount
   */
  async createDiscount(discountData: Partial<Discount>): Promise<Discount> {
    try {
      const discount: Discount = {
        id: uuidv4(),
        code: discountData.code || this.generateDiscountCode(),
        name: discountData.name || '',
        description: discountData.description,
        type: discountData.type || DiscountType.PERCENTAGE,
        value: discountData.value || 0,
        minimumOrderAmount: discountData.minimumOrderAmount,
        maximumDiscountAmount: discountData.maximumDiscountAmount,
        isActive: discountData.isActive ?? true,
        isStackable: discountData.isStackable ?? false,
        validFrom: discountData.validFrom || new Date(),
        validTo: discountData.validTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        usageLimit: discountData.usageLimit,
        usageCount: 0,
        applicableProducts: discountData.applicableProducts,
        applicableCategories: discountData.applicableCategories,
        applicableUsers: discountData.applicableUsers,
        metadata: discountData.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.databaseService.discount.create({
        data: {
          id: discount.id,
          code: discount.code,
          name: discount.name,
          description: discount.description,
          type: discount.type,
          value: discount.value,
          minimumOrderAmount: discount.minimumOrderAmount,
          maximumDiscountAmount: discount.maximumDiscountAmount,
          isActive: discount.isActive,
          isStackable: discount.isStackable,
          validFrom: discount.validFrom,
          validTo: discount.validTo,
          usageLimit: discount.usageLimit,
          usageCount: discount.usageCount,
          applicableProducts: discount.applicableProducts,
          applicableCategories: discount.applicableCategories,
          applicableUsers: discount.applicableUsers,
          metadata: discount.metadata,
          createdAt: discount.createdAt,
          updatedAt: discount.updatedAt
        }
      });

      this.logger.log(`Discount created: ${discount.id} (${discount.code})`);
      return discount;

    } catch (error) {
      this.logger.error('Discount creation failed:', error.message);
      throw new BadRequestException(`Discount creation failed: ${error.message}`);
    }
  }

  /**
   * Get discount by ID
   */
  async getDiscountById(discountId: string): Promise<Discount> {
    try {
      const discount = await this.databaseService.discount.findUnique({
        where: { id: discountId }
      });

      if (!discount) {
        throw new NotFoundException(`Discount with ID ${discountId} not found`);
      }

      return discount as Discount;

    } catch (error) {
      this.logger.error('Discount retrieval failed:', error.message);
      throw error;
    }
  }

  /**
   * Get discount by code
   */
  async getDiscountByCode(code: string): Promise<Discount | null> {
    try {
      const discount = await this.databaseService.discount.findUnique({
        where: { code }
      });

      return discount as Discount;

    } catch (error) {
      this.logger.error('Discount retrieval by code failed:', error.message);
      return null;
    }
  }

  /**
   * Validate coupon code
   */
  async validateCoupon(couponCode: string, request: PricingRequest): Promise<Discount | null> {
    try {
      const discount = await this.getDiscountByCode(couponCode);
      
      if (!discount) {
        return null;
      }

      // Check if discount is active
      if (!discount.isActive) {
        return null;
      }

      // Check validity period
      const now = new Date();
      if (now < discount.validFrom || (discount.validTo && now > discount.validTo)) {
        return null;
      }

      // Check usage limit
      if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
        return null;
      }

      // Check minimum order amount
      const subtotal = this.calculateSubtotal(request.items);
      if (discount.minimumOrderAmount && subtotal < discount.minimumOrderAmount) {
        return null;
      }

      // Check applicable products
      if (discount.applicableProducts && discount.applicableProducts.length > 0) {
        const hasApplicableProduct = request.items.some(item => 
          discount.applicableProducts!.includes(item.productId)
        );
        if (!hasApplicableProduct) {
          return null;
        }
      }

      // Check applicable categories
      if (discount.applicableCategories && discount.applicableCategories.length > 0) {
        const hasApplicableCategory = request.items.some(item => 
          item.category && discount.applicableCategories!.includes(item.category)
        );
        if (!hasApplicableCategory) {
          return null;
        }
      }

      // Check applicable users
      if (discount.applicableUsers && discount.applicableUsers.length > 0) {
        if (!request.userId || !discount.applicableUsers.includes(request.userId)) {
          return null;
        }
      }

      return discount;

    } catch (error) {
      this.logger.error('Coupon validation failed:', error.message);
      return null;
    }
  }

  /**
   * Validate discount request
   */
  async validateDiscount(request: DiscountValidationRequest): Promise<DiscountValidationResponse> {
    try {
      const discount = await this.validateCoupon(request.couponCode, {
        items: request.items,
        shippingAddress: request.shippingAddress,
        billingAddress: request.billingAddress,
        userId: request.userId
      });

      if (!discount) {
        return {
          isValid: false,
          errorMessage: 'Invalid or expired coupon code'
        };
      }

      return {
        isValid: true,
        discount,
        warnings: []
      };

    } catch (error) {
      this.logger.error('Discount validation failed:', error.message);
      return {
        isValid: false,
        errorMessage: `Discount validation failed: ${error.message}`
      };
    }
  }

  /**
   * Apply discount and update usage count
   */
  async applyDiscount(discountId: string, orderId: string): Promise<void> {
    try {
      await this.databaseService.discount.update({
        where: { id: discountId },
        data: {
          usageCount: { increment: 1 },
          updatedAt: new Date()
        }
      });

      // Log discount usage
      await this.databaseService.discountUsage.create({
        data: {
          id: uuidv4(),
          discountId,
          orderId,
          usedAt: new Date()
        }
      });

      this.logger.log(`Discount applied: ${discountId} for order: ${orderId}`);

    } catch (error) {
      this.logger.error('Discount application failed:', error.message);
      throw new BadRequestException(`Discount application failed: ${error.message}`);
    }
  }

  /**
   * Get bulk discounts for items
   */
  async getBulkDiscounts(items: PricingItem[]): Promise<Discount[]> {
    try {
      const bulkDiscounts: Discount[] = [];

      // Group items by product
      const productGroups = items.reduce((groups, item) => {
        const key = item.productId;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);
        return groups;
      }, {} as Record<string, PricingItem[]>);

      // Check for bulk discounts
      for (const [productId, productItems] of Object.entries(productGroups)) {
        const totalQuantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
        
        // Get bulk discounts for this product
        const discounts = await this.databaseService.discount.findMany({
          where: {
            type: DiscountType.BULK_DISCOUNT,
            isActive: true,
            applicableProducts: { has: productId },
            validFrom: { lte: new Date() },
            validTo: { gte: new Date() }
          }
        });

        for (const discount of discounts) {
          // Check if quantity meets bulk requirements
          if (discount.metadata?.minimumQuantity && totalQuantity >= discount.metadata.minimumQuantity) {
            bulkDiscounts.push(discount as Discount);
          }
        }
      }

      return bulkDiscounts;

    } catch (error) {
      this.logger.error('Bulk discount retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Get seasonal discounts
   */
  async getSeasonalDiscounts(request: PricingRequest): Promise<Discount[]> {
    try {
      const now = new Date();
      
      const seasonalDiscounts = await this.databaseService.discount.findMany({
        where: {
          type: DiscountType.PERCENTAGE,
          isActive: true,
          validFrom: { lte: now },
          validTo: { gte: now },
          metadata: {
            path: ['type'],
            equals: 'seasonal'
          }
        }
      });

      return seasonalDiscounts as Discount[];

    } catch (error) {
      this.logger.error('Seasonal discount retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Update discount
   */
  async updateDiscount(discountId: string, updateData: Partial<Discount>): Promise<Discount> {
    try {
      const updatedDiscount = await this.databaseService.discount.update({
        where: { id: discountId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      this.logger.log(`Discount updated: ${discountId}`);
      return updatedDiscount as Discount;

    } catch (error) {
      this.logger.error('Discount update failed:', error.message);
      throw new BadRequestException(`Discount update failed: ${error.message}`);
    }
  }

  /**
   * Delete discount
   */
  async deleteDiscount(discountId: string): Promise<void> {
    try {
      await this.databaseService.discount.delete({
        where: { id: discountId }
      });

      this.logger.log(`Discount deleted: ${discountId}`);

    } catch (error) {
      this.logger.error('Discount deletion failed:', error.message);
      throw new BadRequestException(`Discount deletion failed: ${error.message}`);
    }
  }

  /**
   * Get all discounts with filtering
   */
  async getDiscounts(filters: {
    isActive?: boolean;
    type?: DiscountType;
    userId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ discounts: Discount[]; total: number }> {
    try {
      const { page = 1, limit = 10, ...whereFilters } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (whereFilters.isActive !== undefined) {
        where.isActive = whereFilters.isActive;
      }

      if (whereFilters.type) {
        where.type = whereFilters.type;
      }

      if (whereFilters.userId) {
        where.applicableUsers = { has: whereFilters.userId };
      }

      const [discounts, total] = await Promise.all([
        this.databaseService.discount.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.databaseService.discount.count({ where })
      ]);

      return {
        discounts: discounts as Discount[],
        total
      };

    } catch (error) {
      this.logger.error('Discount retrieval failed:', error.message);
      throw new BadRequestException(`Discount retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get discount analytics
   */
  async getDiscountAnalytics(dateFrom?: Date, dateTo?: Date): Promise<any> {
    try {
      const where: any = {};

      if (dateFrom || dateTo) {
        where.usedAt = {};
        if (dateFrom) where.usedAt.gte = dateFrom;
        if (dateTo) where.usedAt.lte = dateTo;
      }

      const [totalUsage, totalSavings, topDiscounts] = await Promise.all([
        this.databaseService.discountUsage.count({ where }),
        this.databaseService.discountUsage.aggregate({
          where,
          _sum: { savings: true }
        }),
        this.databaseService.discountUsage.groupBy({
          by: ['discountId'],
          where,
          _count: { discountId: true },
          _sum: { savings: true },
          orderBy: { _count: { discountId: 'desc' } },
          take: 10
        })
      ]);

      return {
        totalUsage,
        totalSavings: totalSavings._sum.savings || 0,
        topDiscounts: topDiscounts.map(item => ({
          discountId: item.discountId,
          usageCount: item._count.discountId,
          totalSavings: item._sum.savings || 0
        }))
      };

    } catch (error) {
      this.logger.error('Discount analytics retrieval failed:', error.message);
      throw new BadRequestException(`Discount analytics retrieval failed: ${error.message}`);
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
   * Generate unique discount code
   */
  private generateDiscountCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
