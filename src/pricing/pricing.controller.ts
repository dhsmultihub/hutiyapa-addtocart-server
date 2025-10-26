import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { PricingEngineService } from '../services/pricing-engine.service';
import { DiscountService } from '../services/discount.service';
import { TaxService } from '../services/tax.service';
import { PromotionService } from '../services/promotion.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { 
  PricingRequest, 
  PricingResponse, 
  DiscountValidationRequest, 
  DiscountValidationResponse,
  TaxCalculationRequest,
  TaxCalculationResponse,
  PromotionApplicationRequest,
  PromotionApplicationResponse,
  Discount,
  TaxRate,
  Promotion,
  DiscountType,
  TaxType,
  PromotionType
} from '../types/pricing.types';

@Controller('api/v1/pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(
    private readonly pricingEngineService: PricingEngineService,
    private readonly discountService: DiscountService,
    private readonly taxService: TaxService,
    private readonly promotionService: PromotionService
  ) {}

  /**
   * Calculate comprehensive pricing
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculatePricing(
    @Body() pricingRequest: PricingRequest,
    @Request() req: any
  ): Promise<PricingResponse> {
    // Ensure the user ID is set
    pricingRequest.userId = req.user.id;
    
    return await this.pricingEngineService.calculatePricing(pricingRequest);
  }

  /**
   * Validate discount/coupon
   */
  @Post('discounts/validate')
  @HttpCode(HttpStatus.OK)
  async validateDiscount(
    @Body() validationRequest: DiscountValidationRequest,
    @Request() req: any
  ): Promise<DiscountValidationResponse> {
    validationRequest.userId = req.user.id;
    return await this.discountService.validateDiscount(validationRequest);
  }

  /**
   * Calculate taxes
   */
  @Post('taxes/calculate')
  @HttpCode(HttpStatus.OK)
  async calculateTaxes(
    @Body() taxRequest: TaxCalculationRequest,
    @Request() req: any
  ): Promise<TaxCalculationResponse> {
    taxRequest.userId = req.user.id;
    return await this.taxService.calculateTaxes(taxRequest);
  }

  /**
   * Apply promotion
   */
  @Post('promotions/apply')
  @HttpCode(HttpStatus.OK)
  async applyPromotion(
    @Body() promotionRequest: PromotionApplicationRequest,
    @Request() req: any
  ): Promise<PromotionApplicationResponse> {
    promotionRequest.userId = req.user.id;
    return await this.promotionService.validatePromotionApplication(promotionRequest);
  }

  // Discount Management Endpoints

  @Post('discounts')
  @HttpCode(HttpStatus.CREATED)
  async createDiscount(
    @Body() discountData: Partial<Discount>,
    @Request() req: any
  ): Promise<Discount> {
    // Only admin users can create discounts
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to create discounts');
    }
    
    return await this.discountService.createDiscount(discountData);
  }

  @Get('discounts')
  async getDiscounts(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: boolean,
    @Query('type') type?: DiscountType
  ): Promise<{ discounts: Discount[]; total: number }> {
    return await this.discountService.getDiscounts({
      page,
      limit,
      isActive,
      type,
      userId: req.user.id
    });
  }

  @Get('discounts/:id')
  async getDiscountById(
    @Param('id', ParseUUIDPipe) discountId: string
  ): Promise<Discount> {
    return await this.discountService.getDiscountById(discountId);
  }

  @Put('discounts/:id')
  async updateDiscount(
    @Param('id', ParseUUIDPipe) discountId: string,
    @Body() updateData: Partial<Discount>,
    @Request() req: any
  ): Promise<Discount> {
    // Only admin users can update discounts
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to update discounts');
    }
    
    return await this.discountService.updateDiscount(discountId, updateData);
  }

  @Delete('discounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDiscount(
    @Param('id', ParseUUIDPipe) discountId: string,
    @Request() req: any
  ): Promise<void> {
    // Only admin users can delete discounts
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to delete discounts');
    }
    
    return await this.discountService.deleteDiscount(discountId);
  }

  @Get('discounts/code/:code')
  async getDiscountByCode(
    @Param('code') code: string
  ): Promise<Discount | null> {
    return await this.discountService.getDiscountByCode(code);
  }

  @Get('discounts/analytics')
  async getDiscountAnalytics(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ): Promise<any> {
    // Only admin users can view analytics
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to view analytics');
    }
    
    return await this.discountService.getDiscountAnalytics(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );
  }

  // Tax Management Endpoints

  @Post('taxes')
  @HttpCode(HttpStatus.CREATED)
  async createTaxRate(
    @Body() taxRateData: Partial<TaxRate>,
    @Request() req: any
  ): Promise<TaxRate> {
    // Only admin users can create tax rates
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to create tax rates');
    }
    
    return await this.taxService.createTaxRate(taxRateData);
  }

  @Get('taxes')
  async getTaxRates(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('type') type?: TaxType,
    @Query('isActive') isActive?: boolean
  ): Promise<{ taxRates: TaxRate[]; total: number }> {
    return await this.taxService.getTaxRates({
      page,
      limit,
      country,
      state,
      city,
      type,
      isActive
    });
  }

  @Get('taxes/:id')
  async getTaxRateById(
    @Param('id', ParseUUIDPipe) taxRateId: string
  ): Promise<TaxRate> {
    return await this.taxService.getTaxRateById(taxRateId);
  }

  @Put('taxes/:id')
  async updateTaxRate(
    @Param('id', ParseUUIDPipe) taxRateId: string,
    @Body() updateData: Partial<TaxRate>,
    @Request() req: any
  ): Promise<TaxRate> {
    // Only admin users can update tax rates
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to update tax rates');
    }
    
    return await this.taxService.updateTaxRate(taxRateId, updateData);
  }

  @Delete('taxes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTaxRate(
    @Param('id', ParseUUIDPipe) taxRateId: string,
    @Request() req: any
  ): Promise<void> {
    // Only admin users can delete tax rates
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to delete tax rates');
    }
    
    return await this.taxService.deleteTaxRate(taxRateId);
  }

  @Get('taxes/region/:country')
  async getTaxRatesForRegion(
    @Param('country') country: string,
    @Query('state') state?: string,
    @Query('city') city?: string
  ): Promise<TaxRate[]> {
    return await this.taxService.getTaxRatesForRegion(country, state, city);
  }

  @Get('taxes/analytics')
  async getTaxAnalytics(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ): Promise<any> {
    // Only admin users can view analytics
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to view analytics');
    }
    
    return await this.taxService.getTaxAnalytics(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );
  }

  // Promotion Management Endpoints

  @Post('promotions')
  @HttpCode(HttpStatus.CREATED)
  async createPromotion(
    @Body() promotionData: Partial<Promotion>,
    @Request() req: any
  ): Promise<Promotion> {
    // Only admin users can create promotions
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to create promotions');
    }
    
    return await this.promotionService.createPromotion(promotionData);
  }

  @Get('promotions')
  async getPromotions(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('type') type?: PromotionType,
    @Query('isActive') isActive?: boolean
  ): Promise<{ promotions: Promotion[]; total: number }> {
    return await this.promotionService.getPromotions({
      page,
      limit,
      type,
      isActive,
      userId: req.user.id
    });
  }

  @Get('promotions/:id')
  async getPromotionById(
    @Param('id', ParseUUIDPipe) promotionId: string
  ): Promise<Promotion> {
    return await this.promotionService.getPromotionById(promotionId);
  }

  @Put('promotions/:id')
  async updatePromotion(
    @Param('id', ParseUUIDPipe) promotionId: string,
    @Body() updateData: Partial<Promotion>,
    @Request() req: any
  ): Promise<Promotion> {
    // Only admin users can update promotions
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to update promotions');
    }
    
    return await this.promotionService.updatePromotion(promotionId, updateData);
  }

  @Delete('promotions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePromotion(
    @Param('id', ParseUUIDPipe) promotionId: string,
    @Request() req: any
  ): Promise<void> {
    // Only admin users can delete promotions
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to delete promotions');
    }
    
    return await this.promotionService.deletePromotion(promotionId);
  }

  @Get('promotions/active')
  async getActivePromotions(
    @Request() req: any,
    @Query('type') type?: PromotionType
  ): Promise<Promotion[]> {
    return await this.promotionService.getActivePromotions(req.user.id, { type });
  }

  @Get('promotions/seasonal')
  async getSeasonalPromotions(): Promise<Promotion[]> {
    return await this.promotionService.getSeasonalPromotions();
  }

  @Get('promotions/loyalty')
  async getLoyaltyPromotions(
    @Request() req: any
  ): Promise<Promotion[]> {
    return await this.promotionService.getLoyaltyPromotions(req.user.id);
  }

  @Get('promotions/analytics')
  async getPromotionAnalytics(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ): Promise<any> {
    // Only admin users can view analytics
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to view analytics');
    }
    
    return await this.promotionService.getPromotionAnalytics(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );
  }

  // General Pricing Endpoints

  @Get('analytics')
  async getPricingAnalytics(
    @Request() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ): Promise<any> {
    // Only admin users can view analytics
    if (!req.user.roles?.includes('admin')) {
      throw new Error('Unauthorized to view analytics');
    }
    
    return await this.pricingEngineService.getPricingAnalytics(
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}
