import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  Promotion, 
  PromotionType, 
  PromotionCondition, 
  PromotionReward,
  PricingRequest,
  PromotionApplicationRequest,
  PromotionApplicationResponse,
  PricingItem
} from '../types/pricing.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new promotion
   */
  async createPromotion(promotionData: Partial<Promotion>): Promise<Promotion> {
    try {
      const promotion: Promotion = {
        id: uuidv4(),
        name: promotionData.name || '',
        description: promotionData.description,
        type: promotionData.type || PromotionType.COUPON,
        isActive: promotionData.isActive ?? true,
        validFrom: promotionData.validFrom || new Date(),
        validTo: promotionData.validTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        conditions: promotionData.conditions || [],
        rewards: promotionData.rewards || [],
        usageLimit: promotionData.usageLimit,
        usageCount: 0,
        metadata: promotionData.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.databaseService.promotion.create({
        data: {
          id: promotion.id,
          name: promotion.name,
          description: promotion.description,
          type: promotion.type,
          isActive: promotion.isActive,
          validFrom: promotion.validFrom,
          validTo: promotion.validTo,
          conditions: promotion.conditions,
          rewards: promotion.rewards,
          usageLimit: promotion.usageLimit,
          usageCount: promotion.usageCount,
          metadata: promotion.metadata,
          createdAt: promotion.createdAt,
          updatedAt: promotion.updatedAt
        }
      });

      this.logger.log(`Promotion created: ${promotion.id} (${promotion.name})`);
      return promotion;

    } catch (error) {
      this.logger.error('Promotion creation failed:', error.message);
      throw new BadRequestException(`Promotion creation failed: ${error.message}`);
    }
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(promotionId: string): Promise<Promotion> {
    try {
      const promotion = await this.databaseService.promotion.findUnique({
        where: { id: promotionId }
      });

      if (!promotion) {
        throw new NotFoundException(`Promotion with ID ${promotionId} not found`);
      }

      return promotion as Promotion;

    } catch (error) {
      this.logger.error('Promotion retrieval failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if promotion is applicable
   */
  async isPromotionApplicable(promotion: Promotion, request: PricingRequest): Promise<boolean> {
    try {
      // Check if promotion is active
      if (!promotion.isActive) {
        return false;
      }

      // Check validity period
      const now = new Date();
      if (now < promotion.validFrom || (promotion.validTo && now > promotion.validTo)) {
        return false;
      }

      // Check usage limit
      if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
        return false;
      }

      // Check conditions
      for (const condition of promotion.conditions) {
        if (!this.evaluateCondition(condition, request)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.error('Promotion applicability check failed:', error.message);
      return false;
    }
  }

  /**
   * Evaluate promotion condition
   */
  private evaluateCondition(condition: PromotionCondition, request: PricingRequest): boolean {
    try {
      switch (condition.type) {
        case 'minimum_order_amount':
          const subtotal = this.calculateSubtotal(request.items);
          return this.compareValues(subtotal, condition.value, condition.operator);

        case 'minimum_quantity':
          const totalQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0);
          return this.compareValues(totalQuantity, condition.value, condition.operator);

        case 'specific_products':
          const hasSpecificProduct = request.items.some(item => 
            condition.value.includes(item.productId)
          );
          return condition.operator === 'contains' ? hasSpecificProduct : !hasSpecificProduct;

        case 'specific_categories':
          const hasSpecificCategory = request.items.some(item => 
            item.category && condition.value.includes(item.category)
          );
          return condition.operator === 'contains' ? hasSpecificCategory : !hasSpecificCategory;

        case 'user_type':
          if (!request.userId) return false;
          // This would typically check user type from user service
          return condition.operator === 'equals' && condition.value === 'registered';

        case 'time_based':
          const now = new Date();
          const timeCondition = condition.value;
          if (timeCondition.startTime && timeCondition.endTime) {
            const startTime = new Date(timeCondition.startTime);
            const endTime = new Date(timeCondition.endTime);
            return now >= startTime && now <= endTime;
          }
          return true;

        default:
          return false;
      }

    } catch (error) {
      this.logger.error('Condition evaluation failed:', error.message);
      return false;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: number, expected: number, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'greater_than':
        return actual > expected;
      case 'less_than':
        return actual < expected;
      case 'greater_than_or_equal':
        return actual >= expected;
      case 'less_than_or_equal':
        return actual <= expected;
      default:
        return false;
    }
  }

  /**
   * Apply promotion and get rewards
   */
  async applyPromotion(promotion: Promotion, request: PricingRequest): Promise<PromotionReward[]> {
    try {
      if (!await this.isPromotionApplicable(promotion, request)) {
        return [];
      }

      // Update usage count
      await this.databaseService.promotion.update({
        where: { id: promotion.id },
        data: {
          usageCount: { increment: 1 },
          updatedAt: new Date()
        }
      });

      // Log promotion usage
      await this.databaseService.promotionUsage.create({
        data: {
          id: uuidv4(),
          promotionId: promotion.id,
          userId: request.userId,
          orderId: request.metadata?.orderId,
          appliedAt: new Date(),
          metadata: {
            items: request.items.length,
            subtotal: this.calculateSubtotal(request.items)
          }
        }
      });

      this.logger.log(`Promotion applied: ${promotion.id} (${promotion.name})`);
      return promotion.rewards;

    } catch (error) {
      this.logger.error('Promotion application failed:', error.message);
      return [];
    }
  }

  /**
   * Validate promotion application
   */
  async validatePromotionApplication(request: PromotionApplicationRequest): Promise<PromotionApplicationResponse> {
    try {
      const promotion = await this.getPromotionById(request.promotionId);
      
      if (!promotion) {
        return {
          isApplicable: false,
          errorMessage: 'Promotion not found'
        };
      }

      const isApplicable = await this.isPromotionApplicable(promotion, {
        items: request.items,
        shippingAddress: request.shippingAddress,
        billingAddress: request.billingAddress,
        userId: request.userId
      });

      if (!isApplicable) {
        return {
          isApplicable: false,
          errorMessage: 'Promotion is not applicable'
        };
      }

      return {
        isApplicable: true,
        promotion,
        rewards: promotion.rewards
      };

    } catch (error) {
      this.logger.error('Promotion validation failed:', error.message);
      return {
        isApplicable: false,
        errorMessage: `Promotion validation failed: ${error.message}`
      };
    }
  }

  /**
   * Get active promotions for user
   */
  async getActivePromotions(userId?: string, filters: {
    type?: PromotionType;
    applicableToItems?: PricingItem[];
  } = {}): Promise<Promotion[]> {
    try {
      const where: any = {
        isActive: true,
        validFrom: { lte: new Date() },
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } }
        ]
      };

      if (filters.type) {
        where.type = filters.type;
      }

      const promotions = await this.databaseService.promotion.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      // Filter promotions that are applicable to the user/items
      const applicablePromotions: Promotion[] = [];

      for (const promotion of promotions) {
        if (filters.applicableToItems) {
          const isApplicable = await this.isPromotionApplicable(promotion, {
            items: filters.applicableToItems,
            userId
          });
          if (isApplicable) {
            applicablePromotions.push(promotion as Promotion);
          }
        } else {
          applicablePromotions.push(promotion as Promotion);
        }
      }

      return applicablePromotions;

    } catch (error) {
      this.logger.error('Active promotions retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Update promotion
   */
  async updatePromotion(promotionId: string, updateData: Partial<Promotion>): Promise<Promotion> {
    try {
      const updatedPromotion = await this.databaseService.promotion.update({
        where: { id: promotionId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      this.logger.log(`Promotion updated: ${promotionId}`);
      return updatedPromotion as Promotion;

    } catch (error) {
      this.logger.error('Promotion update failed:', error.message);
      throw new BadRequestException(`Promotion update failed: ${error.message}`);
    }
  }

  /**
   * Delete promotion
   */
  async deletePromotion(promotionId: string): Promise<void> {
    try {
      await this.databaseService.promotion.delete({
        where: { id: promotionId }
      });

      this.logger.log(`Promotion deleted: ${promotionId}`);

    } catch (error) {
      this.logger.error('Promotion deletion failed:', error.message);
      throw new BadRequestException(`Promotion deletion failed: ${error.message}`);
    }
  }

  /**
   * Get all promotions with filtering
   */
  async getPromotions(filters: {
    type?: PromotionType;
    isActive?: boolean;
    userId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ promotions: Promotion[]; total: number }> {
    try {
      const { page = 1, limit = 10, ...whereFilters } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (whereFilters.type) {
        where.type = whereFilters.type;
      }

      if (whereFilters.isActive !== undefined) {
        where.isActive = whereFilters.isActive;
      }

      const [promotions, total] = await Promise.all([
        this.databaseService.promotion.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.databaseService.promotion.count({ where })
      ]);

      return {
        promotions: promotions as Promotion[],
        total
      };

    } catch (error) {
      this.logger.error('Promotion retrieval failed:', error.message);
      throw new BadRequestException(`Promotion retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get promotion analytics
   */
  async getPromotionAnalytics(dateFrom?: Date, dateTo?: Date): Promise<any> {
    try {
      const where: any = {};

      if (dateFrom || dateTo) {
        where.appliedAt = {};
        if (dateFrom) where.appliedAt.gte = dateFrom;
        if (dateTo) where.appliedAt.lte = dateTo;
      }

      const [totalUsage, topPromotions] = await Promise.all([
        this.databaseService.promotionUsage.count({ where }),
        this.databaseService.promotionUsage.groupBy({
          by: ['promotionId'],
          where,
          _count: { promotionId: true },
          orderBy: { _count: { promotionId: 'desc' } },
          take: 10
        })
      ]);

      return {
        totalUsage,
        topPromotions: topPromotions.map(item => ({
          promotionId: item.promotionId,
          usageCount: item._count.promotionId
        }))
      };

    } catch (error) {
      this.logger.error('Promotion analytics retrieval failed:', error.message);
      throw new BadRequestException(`Promotion analytics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get seasonal promotions
   */
  async getSeasonalPromotions(): Promise<Promotion[]> {
    try {
      const now = new Date();
      
      const seasonalPromotions = await this.databaseService.promotion.findMany({
        where: {
          type: PromotionType.SEASONAL,
          isActive: true,
          validFrom: { lte: now },
          OR: [
            { validTo: null },
            { validTo: { gte: now } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      return seasonalPromotions as Promotion[];

    } catch (error) {
      this.logger.error('Seasonal promotions retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Get loyalty promotions for user
   */
  async getLoyaltyPromotions(userId: string): Promise<Promotion[]> {
    try {
      if (!userId) {
        return [];
      }

      const loyaltyPromotions = await this.databaseService.promotion.findMany({
        where: {
          type: PromotionType.LOYALTY,
          isActive: true,
          validFrom: { lte: new Date() },
          OR: [
            { validTo: null },
            { validTo: { gte: new Date() } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      return loyaltyPromotions as Promotion[];

    } catch (error) {
      this.logger.error('Loyalty promotions retrieval failed:', error.message);
      return [];
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
}
