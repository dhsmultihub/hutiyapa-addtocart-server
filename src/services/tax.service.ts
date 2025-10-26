import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  TaxRate, 
  TaxType, 
  TaxCalculationRequest, 
  TaxCalculationResponse, 
  TaxApplication,
  PricingItem,
  ShippingAddress,
  BillingAddress
} from '../types/pricing.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Calculate taxes for items and addresses
   */
  async calculateTaxes(request: TaxCalculationRequest): Promise<TaxCalculationResponse> {
    try {
      this.logger.log(`Calculating taxes for ${request.items.length} items in ${request.shippingAddress.country}`);

      const taxApplications: TaxApplication[] = [];
      let totalTax = 0;

      // Get applicable tax rates for the shipping address
      const taxRates = await this.getApplicableTaxRates(request.shippingAddress);

      // Calculate tax for each applicable rate
      for (const taxRate of taxRates) {
        const taxableAmount = this.calculateTaxableAmount(request.items, taxRate);
        
        if (taxableAmount > 0) {
          const appliedAmount = this.calculateTaxAmount(taxableAmount, taxRate);
          
          if (appliedAmount > 0) {
            taxApplications.push({
              id: uuidv4(),
              type: taxRate.type,
              name: this.getTaxName(taxRate.type),
              rate: taxRate.rate,
              appliedAmount,
              region: taxRate.region,
              isInclusive: taxRate.isInclusive,
              metadata: {
                taxRateId: taxRate.id,
                country: taxRate.country,
                state: taxRate.state,
                city: taxRate.city,
                postalCode: taxRate.postalCode,
                calculatedAt: new Date()
              }
            });

            totalTax += appliedAmount;
          }
        }
      }

      this.logger.log(`Tax calculation completed: ${taxApplications.length} taxes, total: ${totalTax}`);

      return {
        taxes: taxApplications,
        totalTax,
        currency: 'USD', // Default currency
        metadata: {
          calculatedAt: new Date(),
          shippingAddress: request.shippingAddress,
          billingAddress: request.billingAddress,
          itemCount: request.items.length
        }
      };

    } catch (error) {
      this.logger.error('Tax calculation failed:', error.message);
      throw new BadRequestException(`Tax calculation failed: ${error.message}`);
    }
  }

  /**
   * Get applicable tax rates for an address
   */
  async getApplicableTaxRates(address: ShippingAddress): Promise<TaxRate[]> {
    try {
      const where: any = {
        isActive: true,
        validFrom: { lte: new Date() },
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } }
        ]
      };

      // Build location-based query
      const locationConditions = [];

      // Country-level tax rates
      locationConditions.push({
        country: address.country,
        state: null,
        city: null,
        postalCode: null
      });

      // State-level tax rates
      if (address.state) {
        locationConditions.push({
          country: address.country,
          state: address.state,
          city: null,
          postalCode: null
        });
      }

      // City-level tax rates
      if (address.city) {
        locationConditions.push({
          country: address.country,
          state: address.state || null,
          city: address.city,
          postalCode: null
        });
      }

      // Postal code-level tax rates
      if (address.postalCode) {
        locationConditions.push({
          country: address.country,
          state: address.state || null,
          city: address.city || null,
          postalCode: address.postalCode
        });
      }

      where.OR = locationConditions;

      const taxRates = await this.databaseService.taxRate.findMany({
        where,
        orderBy: [
          { postalCode: 'desc' }, // Most specific first
          { city: 'desc' },
          { state: 'desc' },
          { country: 'desc' }
        ]
      });

      return taxRates as TaxRate[];

    } catch (error) {
      this.logger.error('Tax rate retrieval failed:', error.message);
      return [];
    }
  }

  /**
   * Calculate taxable amount for items based on tax rate
   */
  private calculateTaxableAmount(items: PricingItem[], taxRate: TaxRate): number {
    let taxableAmount = 0;

    for (const item of items) {
      // Check if item is applicable for this tax rate
      if (this.isItemApplicableForTax(item, taxRate)) {
        taxableAmount += item.unitPrice * item.quantity;
      }
    }

    return taxableAmount;
  }

  /**
   * Check if item is applicable for tax rate
   */
  private isItemApplicableForTax(item: PricingItem, taxRate: TaxRate): boolean {
    // Check if item has specific product exclusions
    if (taxRate.applicableProducts && taxRate.applicableProducts.length > 0) {
      return taxRate.applicableProducts.includes(item.productId);
    }

    // Check if item has category exclusions
    if (taxRate.applicableCategories && taxRate.applicableCategories.length > 0) {
      return item.category && taxRate.applicableCategories.includes(item.category);
    }

    // If no specific products/categories, apply to all items
    return true;
  }

  /**
   * Calculate tax amount
   */
  private calculateTaxAmount(taxableAmount: number, taxRate: TaxRate): number {
    const taxAmount = (taxableAmount * taxRate.rate) / 100;
    
    // Round to 2 decimal places
    return Math.round(taxAmount * 100) / 100;
  }

  /**
   * Get tax name by type
   */
  private getTaxName(taxType: TaxType): string {
    const taxNames: Record<TaxType, string> = {
      [TaxType.VAT]: 'Value Added Tax',
      [TaxType.GST]: 'Goods and Services Tax',
      [TaxType.SALES_TAX]: 'Sales Tax',
      [TaxType.CONSUMPTION_TAX]: 'Consumption Tax'
    };

    return taxNames[taxType] || 'Tax';
  }

  /**
   * Create tax rate
   */
  async createTaxRate(taxRateData: Partial<TaxRate>): Promise<TaxRate> {
    try {
      const taxRate: TaxRate = {
        id: uuidv4(),
        region: taxRateData.region || '',
        country: taxRateData.country || '',
        state: taxRateData.state,
        city: taxRateData.city,
        postalCode: taxRateData.postalCode,
        type: taxRateData.type || TaxType.SALES_TAX,
        rate: taxRateData.rate || 0,
        isInclusive: taxRateData.isInclusive ?? false,
        applicableProducts: taxRateData.applicableProducts,
        applicableCategories: taxRateData.applicableCategories,
        isActive: taxRateData.isActive ?? true,
        validFrom: taxRateData.validFrom || new Date(),
        validTo: taxRateData.validTo,
        metadata: taxRateData.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      await this.databaseService.taxRate.create({
        data: {
          id: taxRate.id,
          region: taxRate.region,
          country: taxRate.country,
          state: taxRate.state,
          city: taxRate.city,
          postalCode: taxRate.postalCode,
          type: taxRate.type,
          rate: taxRate.rate,
          isInclusive: taxRate.isInclusive,
          applicableProducts: taxRate.applicableProducts,
          applicableCategories: taxRate.applicableCategories,
          isActive: taxRate.isActive,
          validFrom: taxRate.validFrom,
          validTo: taxRate.validTo,
          metadata: taxRate.metadata,
          createdAt: taxRate.createdAt,
          updatedAt: taxRate.updatedAt
        }
      });

      this.logger.log(`Tax rate created: ${taxRate.id} (${taxRate.region})`);
      return taxRate;

    } catch (error) {
      this.logger.error('Tax rate creation failed:', error.message);
      throw new BadRequestException(`Tax rate creation failed: ${error.message}`);
    }
  }

  /**
   * Get tax rate by ID
   */
  async getTaxRateById(taxRateId: string): Promise<TaxRate> {
    try {
      const taxRate = await this.databaseService.taxRate.findUnique({
        where: { id: taxRateId }
      });

      if (!taxRate) {
        throw new NotFoundException(`Tax rate with ID ${taxRateId} not found`);
      }

      return taxRate as TaxRate;

    } catch (error) {
      this.logger.error('Tax rate retrieval failed:', error.message);
      throw error;
    }
  }

  /**
   * Update tax rate
   */
  async updateTaxRate(taxRateId: string, updateData: Partial<TaxRate>): Promise<TaxRate> {
    try {
      const updatedTaxRate = await this.databaseService.taxRate.update({
        where: { id: taxRateId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      });

      this.logger.log(`Tax rate updated: ${taxRateId}`);
      return updatedTaxRate as TaxRate;

    } catch (error) {
      this.logger.error('Tax rate update failed:', error.message);
      throw new BadRequestException(`Tax rate update failed: ${error.message}`);
    }
  }

  /**
   * Delete tax rate
   */
  async deleteTaxRate(taxRateId: string): Promise<void> {
    try {
      await this.databaseService.taxRate.delete({
        where: { id: taxRateId }
      });

      this.logger.log(`Tax rate deleted: ${taxRateId}`);

    } catch (error) {
      this.logger.error('Tax rate deletion failed:', error.message);
      throw new BadRequestException(`Tax rate deletion failed: ${error.message}`);
    }
  }

  /**
   * Get all tax rates with filtering
   */
  async getTaxRates(filters: {
    country?: string;
    state?: string;
    city?: string;
    type?: TaxType;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{ taxRates: TaxRate[]; total: number }> {
    try {
      const { page = 1, limit = 10, ...whereFilters } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (whereFilters.country) {
        where.country = whereFilters.country;
      }

      if (whereFilters.state) {
        where.state = whereFilters.state;
      }

      if (whereFilters.city) {
        where.city = whereFilters.city;
      }

      if (whereFilters.type) {
        where.type = whereFilters.type;
      }

      if (whereFilters.isActive !== undefined) {
        where.isActive = whereFilters.isActive;
      }

      const [taxRates, total] = await Promise.all([
        this.databaseService.taxRate.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { country: 'asc' },
            { state: 'asc' },
            { city: 'asc' },
            { postalCode: 'asc' }
          ]
        }),
        this.databaseService.taxRate.count({ where })
      ]);

      return {
        taxRates: taxRates as TaxRate[],
        total
      };

    } catch (error) {
      this.logger.error('Tax rate retrieval failed:', error.message);
      throw new BadRequestException(`Tax rate retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get tax analytics
   */
  async getTaxAnalytics(dateFrom?: Date, dateTo?: Date): Promise<any> {
    try {
      // This would typically query order data for tax analytics
      // For now, return mock data
      return {
        totalTaxCollected: 0,
        averageTaxRate: 0,
        taxByRegion: [],
        taxByType: [],
        monthlyTaxTrend: []
      };

    } catch (error) {
      this.logger.error('Tax analytics retrieval failed:', error.message);
      throw new BadRequestException(`Tax analytics retrieval failed: ${error.message}`);
    }
  }

  /**
   * Validate tax exemption
   */
  async validateTaxExemption(userId: string, items: PricingItem[]): Promise<boolean> {
    try {
      // Check if user has tax exemption status
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: { taxExempt: true }
      });

      if (user?.taxExempt) {
        return true;
      }

      // Check if any items are tax exempt
      const exemptItems = items.filter(item => 
        item.metadata?.taxExempt === true
      );

      return exemptItems.length > 0;

    } catch (error) {
      this.logger.error('Tax exemption validation failed:', error.message);
      return false;
    }
  }

  /**
   * Get tax rates for a specific region
   */
  async getTaxRatesForRegion(country: string, state?: string, city?: string): Promise<TaxRate[]> {
    try {
      const where: any = {
        country,
        isActive: true,
        validFrom: { lte: new Date() },
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } }
        ]
      };

      if (state) {
        where.state = state;
      }

      if (city) {
        where.city = city;
      }

      const taxRates = await this.databaseService.taxRate.findMany({
        where,
        orderBy: [
          { postalCode: 'desc' },
          { city: 'desc' },
          { state: 'desc' },
          { country: 'desc' }
        ]
      });

      return taxRates as TaxRate[];

    } catch (error) {
      this.logger.error('Tax rate retrieval for region failed:', error.message);
      return [];
    }
  }
}
