import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { CartValidatorService } from '../cart/validation/cart-validator.service';
import { InventoryService } from './inventory.service';
import { PricingService } from './pricing.service';
import { ProductApiService } from './product-api.service';
import { OrderService } from './order.service';
import {
  CheckoutRequest,
  CheckoutValidationResult,
  CheckoutCalculation,
  CheckoutSession,
  CheckoutResult,
  PaymentIntent,
  OrderCreationRequest,
  OrderCreationResult,
  CheckoutError,
  CheckoutServiceConfig,
  ShippingOption,
  TaxCalculation,
  DiscountApplication
} from '../types/checkout.types';
import { SessionContext } from '../types/cart.types';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly config: CheckoutServiceConfig;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cartValidatorService: CartValidatorService,
    private readonly inventoryService: InventoryService,
    private readonly pricingService: PricingService,
    private readonly productApiService: ProductApiService,
    private readonly orderService: OrderService,
    private readonly configService: ConfigService
  ) {
    this.config = {
      orderServiceUrl: this.configService.get('ORDER_SERVICE_URL', 'http://localhost:3003'),
      paymentServiceUrl: this.configService.get('PAYMENT_SERVICE_URL', 'http://localhost:3004'),
      shippingServiceUrl: this.configService.get('SHIPPING_SERVICE_URL', 'http://localhost:3005'),
      taxServiceUrl: this.configService.get('TAX_SERVICE_URL', 'http://localhost:3006'),
      timeout: parseInt(this.configService.get('CHECKOUT_TIMEOUT', '30000'), 10),
      retryAttempts: parseInt(this.configService.get('CHECKOUT_RETRY_ATTEMPTS', '3'), 10),
      sessionTimeout: parseInt(this.configService.get('CHECKOUT_SESSION_TIMEOUT', '1800000'), 10) // 30 minutes
    };
  }

  /**
   * Initialize checkout process
   */
  async initializeCheckout(
    checkoutRequest: CheckoutRequest,
    sessionContext: SessionContext
  ): Promise<CheckoutSession> {
    try {
      this.logger.log(`Initializing checkout for cart ${checkoutRequest.cartId}`);

      // Validate cart exists and is accessible
      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: checkoutRequest.cartId },
        include: { items: true }
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      // Check cart ownership
      if (cart.userId && cart.userId !== sessionContext.userId) {
        throw new BadRequestException('Cart does not belong to user');
      }

      if (cart.sessionId && cart.sessionId !== sessionContext.sessionId) {
        throw new BadRequestException('Cart does not belong to session');
      }

      // Create checkout session
      const checkoutSession: CheckoutSession = {
        id: `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cartId: checkoutRequest.cartId,
        sessionId: checkoutRequest.sessionId,
        userId: checkoutRequest.userId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.sessionTimeout),
        checkoutData: checkoutRequest,
        metadata: {}
      };

      // Store checkout session in database
      await this.databaseService.prisma.cartMetadata.create({
        data: {
          cartId: checkoutRequest.cartId,
          key: `checkout_session_${checkoutSession.id}`,
          value: JSON.stringify(checkoutSession)
        }
      });

      this.logger.log(`Checkout session created: ${checkoutSession.id}`);
      return checkoutSession;

    } catch (error) {
      this.logger.error('Failed to initialize checkout:', error.message);
      throw new BadRequestException(`Checkout initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate checkout request
   */
  async validateCheckout(
    checkoutSessionId: string,
    sessionContext: SessionContext
  ): Promise<CheckoutValidationResult> {
    try {
      this.logger.log(`Validating checkout session: ${checkoutSessionId}`);

      // Get checkout session
      const checkoutSession = await this.getCheckoutSession(checkoutSessionId);
      if (!checkoutSession) {
        throw new NotFoundException('Checkout session not found');
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];

      // Validate cart
      const cartValidation = await this.cartValidatorService.validateForCheckout(
        checkoutSession.cartId,
        sessionContext
      );

      if (!cartValidation.isValid) {
        errors.push(...cartValidation.errors);
      }
      warnings.push(...cartValidation.warnings);
      suggestions.push(...cartValidation.suggestions);

      // Validate inventory
      let inventoryValidation: any = null;
      let pricingValidation: any = null;

      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: checkoutSession.cartId },
        include: { items: true }
      });

      if (cart && cart.items.length > 0) {
        inventoryValidation = await this.inventoryService.validateInventoryForCheckout(
          cart.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity
          }))
        );

        if (!inventoryValidation.isValid) {
          errors.push(...inventoryValidation.errors);
        }
        warnings.push(...inventoryValidation.warnings);

        // Validate pricing
        pricingValidation = await this.pricingService.validateBulkPricing(
          cart.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            cartPrice: Number(item.price)
          }))
        );

        if (pricingValidation.summary.invalidPrices > 0) {
          errors.push(`${pricingValidation.summary.invalidPrices} items have invalid pricing`);
        }

        if (pricingValidation.summary.itemsNeedingUpdate > 0) {
          warnings.push(`${pricingValidation.summary.itemsNeedingUpdate} items have outdated pricing`);
        }
      }

      // Validate shipping address
      const shippingValidation = this.validateShippingAddress(checkoutSession.checkoutData.shippingAddress);
      if (!shippingValidation.isValid) {
        errors.push(...shippingValidation.errors);
      }
      warnings.push(...shippingValidation.warnings);

      // Validate payment method
      const paymentValidation = this.validatePaymentMethod(checkoutSession.checkoutData.paymentMethod);
      if (!paymentValidation.isValid) {
        errors.push(...paymentValidation.errors);
      }
      warnings.push(...paymentValidation.warnings);

      const validationResult: CheckoutValidationResult = {
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
          isValid: inventoryValidation?.isValid ?? true,
          errors: inventoryValidation?.errors ?? [],
          warnings: inventoryValidation?.warnings ?? []
        },
        pricingValidation: {
          isValid: pricingValidation?.summary.invalidPrices === 0,
          errors: pricingValidation?.results.filter(r => !r.isValid).map(r => r.errors.join(', ')) ?? [],
          warnings: pricingValidation?.results.filter(r => r.warnings.length > 0).map(r => r.warnings.join(', ')) ?? []
        },
        shippingValidation,
        paymentValidation
      };

      // Update checkout session with validation result
      checkoutSession.validationResult = validationResult;
      checkoutSession.updatedAt = new Date();
      await this.updateCheckoutSession(checkoutSession);

      return validationResult;

    } catch (error) {
      this.logger.error('Checkout validation failed:', error.message);
      throw new BadRequestException(`Checkout validation failed: ${error.message}`);
    }
  }

  /**
   * Calculate checkout totals
   */
  async calculateCheckout(
    checkoutSessionId: string,
    sessionContext: SessionContext
  ): Promise<CheckoutCalculation> {
    try {
      this.logger.log(`Calculating checkout for session: ${checkoutSessionId}`);

      const checkoutSession = await this.getCheckoutSession(checkoutSessionId);
      if (!checkoutSession) {
        throw new NotFoundException('Checkout session not found');
      }

      const cart = await this.databaseService.prisma.cart.findUnique({
        where: { id: checkoutSession.cartId },
        include: { items: true }
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // Calculate subtotal
      const subtotal = cart.items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

      // Calculate shipping
      const shipping = await this.calculateShipping(
        checkoutSession.checkoutData.shippingAddress,
        checkoutSession.checkoutData.shippingMethod,
        cart.items
      );

      // Calculate tax
      const tax = await this.calculateTax(
        checkoutSession.checkoutData.shippingAddress,
        subtotal,
        cart.items
      );

      // Calculate discount
      const discount = await this.calculateDiscount(
        checkoutSession.checkoutData.couponCode,
        subtotal,
        cart.items
      );

      const total = subtotal + shipping + tax - discount;

      const calculation: CheckoutCalculation = {
        subtotal,
        shipping,
        tax,
        discount,
        total,
        currency: 'USD', // This should come from configuration
        breakdown: {
          items: cart.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            name: `Product ${item.productId}`, // This should come from product service
            quantity: item.quantity,
            unitPrice: Number(item.price),
            totalPrice: Number(item.price) * item.quantity
          })),
          taxes: [{
            type: 'sales_tax',
            rate: 0.08, // This should be calculated based on location
            amount: tax
          }],
          discounts: discount > 0 ? [{
            code: checkoutSession.checkoutData.couponCode || 'discount',
            type: 'fixed_amount',
            amount: discount
          }] : []
        }
      };

      // Update checkout session with calculation
      checkoutSession.calculation = calculation;
      checkoutSession.updatedAt = new Date();
      await this.updateCheckoutSession(checkoutSession);

      return calculation;

    } catch (error) {
      this.logger.error('Checkout calculation failed:', error.message);
      throw new BadRequestException(`Checkout calculation failed: ${error.message}`);
    }
  }

  /**
   * Process checkout payment
   */
  async processPayment(
    checkoutSessionId: string,
    sessionContext: SessionContext
  ): Promise<PaymentIntent> {
    try {
      this.logger.log(`Processing payment for checkout session: ${checkoutSessionId}`);

      const checkoutSession = await this.getCheckoutSession(checkoutSessionId);
      if (!checkoutSession) {
        throw new NotFoundException('Checkout session not found');
      }

      if (!checkoutSession.calculation) {
        throw new BadRequestException('Checkout calculation not found');
      }

      // Create payment intent
      const paymentIntent: PaymentIntent = {
        id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.round(checkoutSession.calculation.total * 100), // Convert to cents
        currency: checkoutSession.calculation.currency,
        status: 'pending',
        metadata: {
          checkoutSessionId,
          cartId: checkoutSession.cartId,
          userId: checkoutSession.userId
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store payment intent
      await this.databaseService.prisma.cartMetadata.create({
        data: {
          cartId: checkoutSession.cartId,
          key: `payment_intent_${paymentIntent.id}`,
          value: JSON.stringify(paymentIntent)
        }
      });

      // Update checkout session
      checkoutSession.paymentIntentId = paymentIntent.id;
      checkoutSession.status = 'processing';
      checkoutSession.updatedAt = new Date();
      await this.updateCheckoutSession(checkoutSession);

      this.logger.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;

    } catch (error) {
      this.logger.error('Payment processing failed:', error.message);
      throw new BadRequestException(`Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Complete checkout and create order
   */
  async completeCheckout(
    checkoutSessionId: string,
    sessionContext: SessionContext
  ): Promise<CheckoutResult> {
    try {
      this.logger.log(`Completing checkout for session: ${checkoutSessionId}`);

      const checkoutSession = await this.getCheckoutSession(checkoutSessionId);
      if (!checkoutSession) {
        throw new NotFoundException('Checkout session not found');
      }

      if (checkoutSession.status !== 'processing') {
        throw new BadRequestException('Checkout session is not in processing state');
      }

      // Create order
      const orderCreationRequest: OrderCreationRequest = {
        checkoutSessionId,
        cartId: checkoutSession.cartId,
        userId: checkoutSession.userId,
        shippingAddress: checkoutSession.checkoutData.shippingAddress,
        billingAddress: checkoutSession.checkoutData.billingAddress,
        items: checkoutSession.calculation?.breakdown.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.unitPrice,
          name: item.name
        })) || [],
        totals: checkoutSession.calculation!,
        paymentIntentId: checkoutSession.paymentIntentId,
        metadata: checkoutSession.metadata
      };

      const orderResult = await this.createOrder(orderCreationRequest);

      if (orderResult.success) {
        // Update checkout session
        checkoutSession.status = 'completed';
        checkoutSession.orderId = orderResult.orderId;
        checkoutSession.updatedAt = new Date();
        await this.updateCheckoutSession(checkoutSession);

        // Clear cart
        await this.clearCartAfterCheckout(checkoutSession.cartId);

        this.logger.log(`Checkout completed successfully. Order ID: ${orderResult.orderId}`);
        return {
          success: true,
          checkoutSessionId,
          orderId: orderResult.orderId,
          metadata: {
            orderNumber: orderResult.orderNumber,
            status: orderResult.status
          }
        };
      } else {
        checkoutSession.status = 'failed';
        checkoutSession.updatedAt = new Date();
        await this.updateCheckoutSession(checkoutSession);

        return {
          success: false,
          checkoutSessionId,
          errors: orderResult.errors
        };
      }

    } catch (error) {
      this.logger.error('Checkout completion failed:', error.message);
      throw new BadRequestException(`Checkout completion failed: ${error.message}`);
    }
  }

  /**
   * Get checkout session
   */
  async getCheckoutSession(checkoutSessionId: string): Promise<CheckoutSession | null> {
    try {
      const metadata = await this.databaseService.prisma.cartMetadata.findFirst({
        where: {
          key: `checkout_session_${checkoutSessionId}`
        }
      });

      if (!metadata) {
        return null;
      }

      return JSON.parse(metadata.value) as CheckoutSession;
    } catch (error) {
      this.logger.error('Failed to get checkout session:', error.message);
      return null;
    }
  }

  /**
   * Update checkout session
   */
  private async updateCheckoutSession(checkoutSession: CheckoutSession): Promise<void> {
    try {
      await this.databaseService.prisma.cartMetadata.updateMany({
        where: {
          key: `checkout_session_${checkoutSession.id}`
        },
        data: {
          value: JSON.stringify(checkoutSession)
        }
      });
    } catch (error) {
      this.logger.error('Failed to update checkout session:', error.message);
    }
  }

  /**
   * Validate shipping address
   */
  private validateShippingAddress(address: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!address.firstName) errors.push('First name is required');
    if (!address.lastName) errors.push('Last name is required');
    if (!address.address1) errors.push('Address line 1 is required');
    if (!address.city) errors.push('City is required');
    if (!address.state) errors.push('State is required');
    if (!address.postalCode) errors.push('Postal code is required');
    if (!address.country) errors.push('Country is required');

    if (address.postalCode && !/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
      warnings.push('Postal code format may be incorrect');
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
  private validatePaymentMethod(paymentMethod: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!paymentMethod.type) {
      errors.push('Payment method type is required');
    }

    if (paymentMethod.type === 'credit_card' || paymentMethod.type === 'debit_card') {
      if (!paymentMethod.cardNumber) errors.push('Card number is required');
      if (!paymentMethod.expiryMonth) errors.push('Expiry month is required');
      if (!paymentMethod.expiryYear) errors.push('Expiry year is required');
      if (!paymentMethod.cvv) errors.push('CVV is required');
      if (!paymentMethod.cardholderName) errors.push('Cardholder name is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate shipping cost
   */
  private async calculateShipping(
    address: any,
    shippingMethod: any,
    items: any[]
  ): Promise<number> {
    // This would typically integrate with a shipping service
    // For now, return a fixed shipping cost
    return shippingMethod?.cost || 9.99;
  }

  /**
   * Calculate tax
   */
  private async calculateTax(
    address: any,
    subtotal: number,
    items: any[]
  ): Promise<number> {
    // This would typically integrate with a tax service
    // For now, return a simple tax calculation
    const taxRate = 0.08; // 8% tax rate
    return subtotal * taxRate;
  }

  /**
   * Calculate discount
   */
  private async calculateDiscount(
    couponCode: string | undefined,
    subtotal: number,
    items: any[]
  ): Promise<number> {
    if (!couponCode) return 0;

    // This would typically integrate with a discount service
    // For now, return a simple discount
    if (couponCode === 'SAVE10') {
      return Math.min(subtotal * 0.1, 10); // 10% discount, max $10
    }

    return 0;
  }

  /**
   * Create order
   */
  private async createOrder(orderRequest: OrderCreationRequest): Promise<OrderCreationResult> {
    try {
      // Create order using OrderService
      const createOrderRequest = {
        userId: orderRequest.userId,
        sessionId: orderRequest.checkoutSessionId,
        items: orderRequest.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price,
          metadata: {
            productName: item.name,
            checkoutSessionId: orderRequest.checkoutSessionId
          }
        })),
        shippingAddress: {
          firstName: orderRequest.shippingAddress.firstName,
          lastName: orderRequest.shippingAddress.lastName,
          company: orderRequest.shippingAddress.company,
          address1: orderRequest.shippingAddress.address1,
          address2: orderRequest.shippingAddress.address2,
          city: orderRequest.shippingAddress.city,
          state: orderRequest.shippingAddress.state,
          postalCode: orderRequest.shippingAddress.postalCode,
          country: orderRequest.shippingAddress.country,
          phone: orderRequest.shippingAddress.phone,
          email: orderRequest.shippingAddress.email,
          isDefault: false
        },
        billingAddress: {
          firstName: orderRequest.billingAddress.firstName,
          lastName: orderRequest.billingAddress.lastName,
          company: orderRequest.billingAddress.company,
          address1: orderRequest.billingAddress.address1,
          address2: orderRequest.billingAddress.address2,
          city: orderRequest.billingAddress.city,
          state: orderRequest.billingAddress.state,
          postalCode: orderRequest.billingAddress.postalCode,
          country: orderRequest.billingAddress.country,
          phone: orderRequest.billingAddress.phone,
          email: orderRequest.billingAddress.email,
          isDefault: false
        },
        paymentMethod: 'credit_card', // Default payment method
        paymentProvider: 'stripe', // Default payment provider
        shippingMethod: 'standard',
        notes: `Checkout session: ${orderRequest.checkoutSessionId}`,
        metadata: {
          checkoutSessionId: orderRequest.checkoutSessionId,
          cartId: orderRequest.cartId,
          paymentIntentId: orderRequest.paymentIntentId,
          ...orderRequest.metadata
        }
      };

      const order = await this.orderService.createOrder(createOrderRequest);

      this.logger.log(`Order created: ${order.id} (${order.orderNumber})`);
      return {
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        metadata: {
          createdAt: order.createdAt,
          total: order.totals.total,
          status: order.status
        }
      };
    } catch (error) {
      this.logger.error('Order creation failed:', error.message);
      return {
        success: false,
        errors: [`Order creation failed: ${error.message}`]
      };
    }
  }

  /**
   * Clear cart after successful checkout
   */
  private async clearCartAfterCheckout(cartId: string): Promise<void> {
    try {
      // Remove all items from cart
      await this.databaseService.prisma.cartItem.deleteMany({
        where: { cartId }
      });

      // Update cart metadata
      await this.databaseService.prisma.cartMetadata.create({
        data: {
          cartId,
          key: 'checkout_completed',
          value: JSON.stringify({
            completed: true,
            completedAt: new Date()
          })
        }
      });

      this.logger.log(`Cart cleared after checkout: ${cartId}`);
    } catch (error) {
      this.logger.error('Failed to clear cart after checkout:', error.message);
    }
  }
}
