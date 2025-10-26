import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { InventoryService } from './inventory.service';
import { PricingService } from './pricing.service';
import { ProductApiService } from './product-api.service';
import {
  CheckoutRequest,
  CheckoutValidationResult,
  ShippingAddress,
  BillingAddress,
  PaymentMethod,
  ShippingMethod
} from '../types/checkout.types';
import { SessionContext } from '../types/cart.types';

export interface ValidationRule {
  name: string;
  validate: (data: any) => Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>;
  required: boolean;
}

@Injectable()
export class CheckoutValidationService {
  private readonly logger = new Logger(CheckoutValidationService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: PricingService,
    private readonly productApiService: ProductApiService
  ) {}

  /**
   * Comprehensive checkout validation
   */
  async validateCheckout(
    checkoutRequest: CheckoutRequest,
    sessionContext: SessionContext
  ): Promise<CheckoutValidationResult> {
    try {
      this.logger.log(`Validating checkout for cart: ${checkoutRequest.cartId}`);

      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Validate cart
      const cartValidation = await this.validateCart(checkoutRequest.cartId, sessionContext);
      if (!cartValidation.isValid) {
        errors.push(...cartValidation.errors);
      }
      warnings.push(...cartValidation.warnings);
      suggestions.push(...cartValidation.suggestions);

      // Validate shipping address
      const shippingValidation = this.validateShippingAddress(checkoutRequest.shippingAddress);
      if (!shippingValidation.isValid) {
        errors.push(...shippingValidation.errors);
      }
      warnings.push(...shippingValidation.warnings);

      // Validate billing address
      const billingValidation = this.validateBillingAddress(checkoutRequest.billingAddress);
      if (!billingValidation.isValid) {
        errors.push(...billingValidation.errors);
      }
      warnings.push(...billingValidation.warnings);

      // Validate payment method
      const paymentValidation = this.validatePaymentMethod(checkoutRequest.paymentMethod);
      if (!paymentValidation.isValid) {
        errors.push(...paymentValidation.errors);
      }
      warnings.push(...paymentValidation.warnings);

      // Validate shipping method
      const shippingMethodValidation = this.validateShippingMethod(checkoutRequest.shippingMethod);
      if (!shippingMethodValidation.isValid) {
        errors.push(...shippingMethodValidation.errors);
      }
      warnings.push(...shippingMethodValidation.warnings);

      // Validate inventory
      const inventoryValidation = await this.validateInventory(checkoutRequest.cartId);
      if (!inventoryValidation.isValid) {
        errors.push(...inventoryValidation.errors);
      }
      warnings.push(...inventoryValidation.warnings);

      // Validate pricing
      const pricingValidation = await this.validatePricing(checkoutRequest.cartId);
      if (!pricingValidation.isValid) {
        errors.push(...pricingValidation.errors);
      }
      warnings.push(...pricingValidation.warnings);

      // Validate coupon code if provided
      if (checkoutRequest.couponCode) {
        const couponValidation = await this.validateCouponCode(
          checkoutRequest.couponCode,
          checkoutRequest.cartId
        );
        if (!couponValidation.isValid) {
          errors.push(...couponValidation.errors);
        }
        warnings.push(...couponValidation.warnings);
      }

      const result: CheckoutValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        cartValidation: {
          isValid: cartValidation.isValid,
          errors: cartValidation.errors,
          warnings: cartValidation.warnings
        },
        inventoryValidation: {
          isValid: inventoryValidation.isValid,
          errors: inventoryValidation.errors,
          warnings: inventoryValidation.warnings
        },
        pricingValidation: {
          isValid: pricingValidation.isValid,
          errors: pricingValidation.errors,
          warnings: pricingValidation.warnings
        },
        shippingValidation: {
          isValid: shippingValidation.isValid,
          errors: shippingValidation.errors,
          warnings: shippingValidation.warnings
        },
        paymentValidation: {
          isValid: paymentValidation.isValid,
          errors: paymentValidation.errors,
          warnings: paymentValidation.warnings
        }
      };

      this.logger.log(`Checkout validation completed. Valid: ${result.isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`);
      return result;

    } catch (error) {
      this.logger.error('Checkout validation failed:', error.message);
      throw new BadRequestException(`Checkout validation failed: ${error.message}`);
    }
  }

  /**
   * Validate cart
   */
  private async validateCart(
    cartId: string,
    sessionContext: SessionContext
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[]; suggestions: string[] }> {
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
        errors.push('Cart not found');
        return { isValid: false, errors, warnings, suggestions };
      }

      // Check cart ownership
      if (cart.userId && cart.userId !== sessionContext.userId) {
        errors.push('Cart does not belong to user');
        return { isValid: false, errors, warnings, suggestions };
      }

      if (cart.sessionId && cart.sessionId !== sessionContext.sessionId) {
        errors.push('Cart does not belong to session');
        return { isValid: false, errors, warnings, suggestions };
      }

      // Check if cart is empty
      if (cart.items.length === 0) {
        errors.push('Cart is empty');
        return { isValid: false, errors, warnings, suggestions };
      }

      // Check for expired items
      const expiredItems = cart.items.filter(item => {
        const addedAt = new Date(item.addedAt);
        const now = new Date();
        const hoursSinceAdded = (now.getTime() - addedAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceAdded > 24; // Items older than 24 hours
      });

      if (expiredItems.length > 0) {
        warnings.push(`${expiredItems.length} items have been in cart for more than 24 hours`);
        suggestions.push('Consider reviewing your cart items before checkout');
      }

      // Check for duplicate items
      const itemCounts = new Map<string, number>();
      cart.items.forEach(item => {
        const key = `${item.productId}_${item.variantId || 'default'}`;
        itemCounts.set(key, (itemCounts.get(key) || 0) + 1);
      });

      const duplicates = Array.from(itemCounts.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        warnings.push('Cart contains duplicate items');
        suggestions.push('Consider consolidating duplicate items');
      }

      return { isValid: true, errors, warnings, suggestions };

    } catch (error) {
      this.logger.error('Cart validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Cart validation failed: ${error.message}`],
        warnings,
        suggestions
      };
    }
  }

  /**
   * Validate shipping address
   */
  private validateShippingAddress(address: ShippingAddress): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!address.firstName?.trim()) errors.push('First name is required');
    if (!address.lastName?.trim()) errors.push('Last name is required');
    if (!address.address1?.trim()) errors.push('Address line 1 is required');
    if (!address.city?.trim()) errors.push('City is required');
    if (!address.state?.trim()) errors.push('State is required');
    if (!address.postalCode?.trim()) errors.push('Postal code is required');
    if (!address.country?.trim()) errors.push('Country is required');

    // Format validation
    if (address.postalCode && !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
      warnings.push('Postal code format may be incorrect');
    }

    if (address.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      warnings.push('Email format may be incorrect');
    }

    if (address.phone && !/^\+?[\d\s\-\(\)]+$/.test(address.phone)) {
      warnings.push('Phone number format may be incorrect');
    }

    // Address completeness
    if (address.address1 && address.address1.length < 5) {
      warnings.push('Address line 1 seems too short');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate billing address
   */
  private validateBillingAddress(address?: BillingAddress): { isValid: boolean; errors: string[]; warnings: string[] } {
    if (!address) {
      return { isValid: true, errors: [], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!address.firstName?.trim()) errors.push('Billing first name is required');
    if (!address.lastName?.trim()) errors.push('Billing last name is required');
    if (!address.address1?.trim()) errors.push('Billing address line 1 is required');
    if (!address.city?.trim()) errors.push('Billing city is required');
    if (!address.state?.trim()) errors.push('Billing state is required');
    if (!address.postalCode?.trim()) errors.push('Billing postal code is required');
    if (!address.country?.trim()) errors.push('Billing country is required');

    // Format validation
    if (address.postalCode && !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
      warnings.push('Billing postal code format may be incorrect');
    }

    if (address.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      warnings.push('Billing email format may be incorrect');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate payment method
   */
  private validatePaymentMethod(paymentMethod: PaymentMethod): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!paymentMethod.type) {
      errors.push('Payment method type is required');
      return { isValid: false, errors, warnings };
    }

    // Validate based on payment method type
    switch (paymentMethod.type) {
      case 'credit_card':
      case 'debit_card':
        if (!paymentMethod.cardNumber) errors.push('Card number is required');
        if (!paymentMethod.expiryMonth) errors.push('Expiry month is required');
        if (!paymentMethod.expiryYear) errors.push('Expiry year is required');
        if (!paymentMethod.cvv) errors.push('CVV is required');
        if (!paymentMethod.cardholderName) errors.push('Cardholder name is required');

        // Format validation
        if (paymentMethod.cardNumber && !/^\d{13,19}$/.test(paymentMethod.cardNumber.replace(/\s/g, ''))) {
          warnings.push('Card number format may be incorrect');
        }

        if (paymentMethod.expiryMonth && (paymentMethod.expiryMonth < 1 || paymentMethod.expiryMonth > 12)) {
          errors.push('Invalid expiry month');
        }

        if (paymentMethod.expiryYear && paymentMethod.expiryYear < new Date().getFullYear()) {
          errors.push('Card has expired');
        }

        if (paymentMethod.cvv && !/^\d{3,4}$/.test(paymentMethod.cvv)) {
          warnings.push('CVV format may be incorrect');
        }
        break;

      case 'paypal':
        if (!paymentMethod.token) {
          warnings.push('PayPal token is recommended for security');
        }
        break;

      case 'stripe':
        if (!paymentMethod.token) {
          warnings.push('Stripe token is recommended for security');
        }
        break;

      case 'apple_pay':
      case 'google_pay':
        if (!paymentMethod.token) {
          warnings.push('Payment token is required for digital wallet');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate shipping method
   */
  private validateShippingMethod(shippingMethod: ShippingMethod): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!shippingMethod.id) errors.push('Shipping method ID is required');
    if (!shippingMethod.name) errors.push('Shipping method name is required');
    if (shippingMethod.cost < 0) errors.push('Shipping cost cannot be negative');
    if (shippingMethod.estimatedDays < 0) errors.push('Estimated days cannot be negative');

    if (shippingMethod.cost === 0) {
      warnings.push('Free shipping selected - verify this is correct');
    }

    if (shippingMethod.estimatedDays > 14) {
      warnings.push('Shipping time is longer than 2 weeks');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate inventory
   */
  private async validateInventory(cartId: string): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: true }
      });

      if (!cart || cart.items.length === 0) {
        return { isValid: false, errors: ['Cart is empty'], warnings: [] };
      }

      const inventoryValidation = await this.inventoryService.validateInventoryForCheckout(
        cart.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        }))
      );

      return {
        isValid: inventoryValidation.isValid,
        errors: inventoryValidation.errors,
        warnings: inventoryValidation.warnings
      };

    } catch (error) {
      this.logger.error('Inventory validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Inventory validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate pricing
   */
  private async validatePricing(cartId: string): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: true }
      });

      if (!cart || cart.items.length === 0) {
        return { isValid: false, errors: ['Cart is empty'], warnings: [] };
      }

      const pricingValidation = await this.pricingService.validateBulkPricing(
        cart.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          cartPrice: Number(item.price)
        }))
      );

      const errors: string[] = [];
      const warnings: string[] = [];

      if (pricingValidation.summary.invalidPrices > 0) {
        errors.push(`${pricingValidation.summary.invalidPrices} items have invalid pricing`);
      }

      if (pricingValidation.summary.itemsNeedingUpdate > 0) {
        warnings.push(`${pricingValidation.summary.itemsNeedingUpdate} items have outdated pricing`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Pricing validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Pricing validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate coupon code
   */
  private async validateCouponCode(
    couponCode: string,
    cartId: string
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // This would typically integrate with a discount service
      // For now, implement basic validation
      if (!couponCode.trim()) {
        errors.push('Coupon code cannot be empty');
        return { isValid: false, errors, warnings };
      }

      if (couponCode.length < 3) {
        errors.push('Coupon code is too short');
        return { isValid: false, errors, warnings };
      }

      if (couponCode.length > 20) {
        errors.push('Coupon code is too long');
        return { isValid: false, errors, warnings };
      }

      // Check if coupon code format is valid
      if (!/^[A-Z0-9_-]+$/.test(couponCode)) {
        warnings.push('Coupon code contains invalid characters');
      }

      // Mock validation - in real implementation, this would check against discount service
      const validCoupons = ['SAVE10', 'FREESHIP', 'WELCOME20'];
      if (!validCoupons.includes(couponCode.toUpperCase())) {
        errors.push('Invalid coupon code');
        return { isValid: false, errors, warnings };
      }

      return { isValid: true, errors, warnings };

    } catch (error) {
      this.logger.error('Coupon validation failed:', error.message);
      return {
        isValid: false,
        errors: [`Coupon validation failed: ${error.message}`],
        warnings: []
      };
    }
  }
}
