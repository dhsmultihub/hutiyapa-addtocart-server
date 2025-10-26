import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SessionContext } from '../../types/cart.types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface CartValidationOptions {
  checkStock: boolean;
  checkPricing: boolean;
  checkAvailability: boolean;
  checkExpiration: boolean;
}

@Injectable()
export class CartValidatorService {
  private readonly logger = new Logger(CartValidatorService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Validate entire cart
   */
  async validateCart(
    cartId: string,
    sessionContext: SessionContext,
    options: CartValidationOptions = {
      checkStock: true,
      checkPricing: true,
      checkAvailability: true,
      checkExpiration: true
    }
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Get cart with items
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: true,
          session: true
        }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      if (cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Unauthorized access to cart');
      }

      // Validate cart status
      if (cart.status !== 'ACTIVE') {
        errors.push(`Cart is not active (status: ${cart.status})`);
      }

      // Validate session
      if (cart.session.expiresAt < new Date()) {
        errors.push('Cart session has expired');
      }

      // Validate each item
      for (const item of cart.items) {
        const itemValidation = await this.validateCartItem(item, options);
        
        if (!itemValidation.isValid) {
          errors.push(...itemValidation.errors);
        }
        
        warnings.push(...itemValidation.warnings);
        suggestions.push(...itemValidation.suggestions);
      }

      // Validate cart totals
      const totalValidation = await this.validateCartTotals(cart);
      if (!totalValidation.isValid) {
        errors.push(...totalValidation.errors);
      }

      // Check for duplicate items
      const duplicateValidation = await this.checkDuplicateItems(cart.items);
      if (!duplicateValidation.isValid) {
        warnings.push(...duplicateValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      this.logger.error('Cart validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Validate individual cart item
   */
  async validateCartItem(
    item: any,
    options: CartValidationOptions
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Validate quantity
      if (item.quantity <= 0) {
        errors.push(`Item ${item.productId} has invalid quantity: ${item.quantity}`);
      }

      if (item.quantity > 100) {
        warnings.push(`Item ${item.productId} has unusually high quantity: ${item.quantity}`);
      }

      // Validate price
      if (item.price <= 0) {
        errors.push(`Item ${item.productId} has invalid price: ${item.price}`);
      }

      // Check if item is too old
      const daysSinceAdded = Math.floor(
        (Date.now() - item.addedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceAdded > 30) {
        warnings.push(`Item ${item.productId} has been in cart for ${daysSinceAdded} days`);
        suggestions.push('Consider removing old items');
      }

      // TODO: Integrate with Product service for real validation
      // This would check:
      // - Product availability
      // - Stock levels
      // - Current pricing
      // - Product status (active/discontinued)

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      this.logger.error('Item validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Item validation failed: ${error.message}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Validate cart totals
   */
  async validateCartTotals(cart: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      const subtotal = cart.items.reduce((sum: number, item: any) => 
        sum + (item.price * item.quantity), 0
      );

      // Check for reasonable cart total
      if (subtotal > 10000) {
        warnings.push('Cart total is unusually high');
      }

      if (subtotal < 0) {
        errors.push('Cart total cannot be negative');
      }

      // Check for free items
      const freeItems = cart.items.filter((item: any) => item.price === 0);
      if (freeItems.length > 0) {
        warnings.push(`${freeItems.length} free items in cart`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      this.logger.error('Total validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Total validation failed: ${error.message}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Check for duplicate items
   */
  async checkDuplicateItems(items: any[]): Promise<ValidationResult> {
    const warnings: string[] = [];
    const itemMap = new Map<string, number>();

    try {
      for (const item of items) {
        const key = `${item.productId}_${item.variantId || 'no_variant'}`;
        const count = itemMap.get(key) || 0;
        itemMap.set(key, count + 1);
      }

      for (const [key, count] of itemMap.entries()) {
        if (count > 1) {
          warnings.push(`Duplicate items found for ${key} (${count} instances)`);
        }
      }

      return {
        isValid: warnings.length === 0,
        errors: [],
        warnings,
        suggestions: ['Consider consolidating duplicate items']
      };

    } catch (error) {
      this.logger.error('Duplicate check failed:', error.message);
      return {
        isValid: false,
        errors: [`Duplicate check failed: ${error.message}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Validate cart before checkout
   */
  async validateForCheckout(
    cartId: string,
    sessionContext: SessionContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Get cart
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: true }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      // Check if cart is empty
      if (cart.items.length === 0) {
        errors.push('Cart is empty');
        return { isValid: false, errors, warnings, suggestions };
      }

      // Validate all items
      const validation = await this.validateCart(cartId, sessionContext, {
        checkStock: true,
        checkPricing: true,
        checkAvailability: true,
        checkExpiration: true
      });

      if (!validation.isValid) {
        errors.push(...validation.errors);
      }

      warnings.push(...validation.warnings);
      suggestions.push(...validation.suggestions);

      // Additional checkout-specific validations
      const total = cart.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
      
      if (total === 0) {
        warnings.push('Cart total is zero - verify all items are free');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      this.logger.error('Checkout validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Checkout validation failed: ${error.message}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(cartId: string, sessionContext: SessionContext) {
    try {
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: true }
      });

      if (!cart) {
        throw new BadRequestException('Cart not found');
      }

      const validation = await this.validateCart(cartId, sessionContext);

      return {
        cartId,
        totalItems: cart.items.length,
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        suggestionCount: validation.suggestions.length,
        lastValidated: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get validation stats:', error.message);
      throw new BadRequestException(`Failed to get validation stats: ${error.message}`);
    }
  }
}
