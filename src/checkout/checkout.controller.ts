import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UseGuards,
  Request
} from '@nestjs/common';
import { CheckoutService } from '../services/checkout.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  CheckoutRequest,
  CheckoutValidationResult,
  CheckoutCalculation,
  CheckoutSession,
  CheckoutResult,
  PaymentIntent,
  ShippingOption,
  TaxCalculation,
  DiscountApplication
} from '../types/checkout.types';

@Controller('checkout')
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Initialize checkout process
   */
  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  async initializeCheckout(
    @Body() checkoutRequest: CheckoutRequest,
    @CurrentUser() user: any,
    @Request() req: any
  ): Promise<CheckoutSession> {
    try {
      const sessionContext = {
        userId: user?.id,
        sessionId: req.sessionId || checkoutRequest.sessionId,
        isGuest: !user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      return await this.checkoutService.initializeCheckout(checkoutRequest, sessionContext);
    } catch (error) {
      this.logger.error('Checkout initialization failed:', error.message);
      throw new BadRequestException(`Checkout initialization failed: ${error.message}`);
    }
  }

  /**
   * Validate checkout request
   */
  @Post(':checkoutSessionId/validate')
  @UseGuards(JwtAuthGuard)
  async validateCheckout(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any,
    @Request() req: any
  ): Promise<CheckoutValidationResult> {
    try {
      const sessionContext = {
        userId: user?.id,
        sessionId: req.sessionId,
        isGuest: !user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      return await this.checkoutService.validateCheckout(checkoutSessionId, sessionContext);
    } catch (error) {
      this.logger.error('Checkout validation failed:', error.message);
      throw new BadRequestException(`Checkout validation failed: ${error.message}`);
    }
  }

  /**
   * Calculate checkout totals
   */
  @Post(':checkoutSessionId/calculate')
  @UseGuards(JwtAuthGuard)
  async calculateCheckout(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any,
    @Request() req: any
  ): Promise<CheckoutCalculation> {
    try {
      const sessionContext = {
        userId: user?.id,
        sessionId: req.sessionId,
        isGuest: !user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      return await this.checkoutService.calculateCheckout(checkoutSessionId, sessionContext);
    } catch (error) {
      this.logger.error('Checkout calculation failed:', error.message);
      throw new BadRequestException(`Checkout calculation failed: ${error.message}`);
    }
  }

  /**
   * Process payment
   */
  @Post(':checkoutSessionId/payment')
  @UseGuards(JwtAuthGuard)
  async processPayment(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any,
    @Request() req: any
  ): Promise<PaymentIntent> {
    try {
      const sessionContext = {
        userId: user?.id,
        sessionId: req.sessionId,
        isGuest: !user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      return await this.checkoutService.processPayment(checkoutSessionId, sessionContext);
    } catch (error) {
      this.logger.error('Payment processing failed:', error.message);
      throw new BadRequestException(`Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Complete checkout
   */
  @Post(':checkoutSessionId/complete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeCheckout(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any,
    @Request() req: any
  ): Promise<CheckoutResult> {
    try {
      const sessionContext = {
        userId: user?.id,
        sessionId: req.sessionId,
        isGuest: !user,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      };

      return await this.checkoutService.completeCheckout(checkoutSessionId, sessionContext);
    } catch (error) {
      this.logger.error('Checkout completion failed:', error.message);
      throw new BadRequestException(`Checkout completion failed: ${error.message}`);
    }
  }

  /**
   * Get checkout session
   */
  @Get(':checkoutSessionId')
  @UseGuards(JwtAuthGuard)
  async getCheckoutSession(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any
  ): Promise<CheckoutSession> {
    try {
      const session = await this.checkoutService.getCheckoutSession(checkoutSessionId);
      if (!session) {
        throw new BadRequestException('Checkout session not found');
      }

      // Verify user has access to this session
      if (session.userId && session.userId !== user?.id) {
        throw new BadRequestException('Access denied to checkout session');
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to get checkout session:', error.message);
      throw new BadRequestException(`Failed to get checkout session: ${error.message}`);
    }
  }

  /**
   * Get available shipping options
   */
  @Get('shipping/options')
  @Public()
  async getShippingOptions(
    @Query('address') address?: string,
    @Query('items') items?: string
  ): Promise<ShippingOption[]> {
    try {
      // This would typically integrate with a shipping service
      // For now, return mock shipping options
      return [
        {
          id: 'standard',
          name: 'Standard Shipping',
          description: '5-7 business days',
          cost: 9.99,
          estimatedDays: 5,
          carrier: 'UPS',
          service: 'Ground',
          trackingSupported: true,
          insuranceIncluded: false,
          signatureRequired: false
        },
        {
          id: 'express',
          name: 'Express Shipping',
          description: '2-3 business days',
          cost: 19.99,
          estimatedDays: 2,
          carrier: 'FedEx',
          service: 'Express',
          trackingSupported: true,
          insuranceIncluded: true,
          signatureRequired: false
        },
        {
          id: 'overnight',
          name: 'Overnight Shipping',
          description: 'Next business day',
          cost: 39.99,
          estimatedDays: 1,
          carrier: 'FedEx',
          service: 'Overnight',
          trackingSupported: true,
          insuranceIncluded: true,
          signatureRequired: true
        }
      ];
    } catch (error) {
      this.logger.error('Failed to get shipping options:', error.message);
      throw new BadRequestException(`Failed to get shipping options: ${error.message}`);
    }
  }

  /**
   * Calculate shipping cost
   */
  @Post('shipping/calculate')
  @Public()
  async calculateShipping(
    @Body() body: {
      address: any;
      items: Array<{ productId: string; quantity: number; weight?: number }>;
      shippingMethodId?: string;
    }
  ): Promise<{ cost: number; estimatedDays: number; carrier: string }> {
    try {
      // This would typically integrate with a shipping service
      // For now, return mock calculation
      const baseCost = 9.99;
      const weightMultiplier = body.items.reduce((sum, item) => sum + (item.weight || 1) * item.quantity, 0);
      const cost = baseCost + (weightMultiplier * 0.5);

      return {
        cost: Math.round(cost * 100) / 100,
        estimatedDays: 5,
        carrier: 'UPS'
      };
    } catch (error) {
      this.logger.error('Shipping calculation failed:', error.message);
      throw new BadRequestException(`Shipping calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate tax
   */
  @Post('tax/calculate')
  @Public()
  async calculateTax(
    @Body() body: {
      address: any;
      subtotal: number;
      items: Array<{ productId: string; quantity: number; price: number; category?: string }>;
    }
  ): Promise<TaxCalculation[]> {
    try {
      // This would typically integrate with a tax service
      // For now, return mock tax calculation
      const taxRate = 0.08; // 8% tax rate
      const taxAmount = body.subtotal * taxRate;

      return [{
        type: 'sales_tax',
        rate: taxRate,
        amount: taxAmount,
        jurisdiction: `${body.address.state}, ${body.address.country}`,
        description: 'State sales tax'
      }];
    } catch (error) {
      this.logger.error('Tax calculation failed:', error.message);
      throw new BadRequestException(`Tax calculation failed: ${error.message}`);
    }
  }

  /**
   * Validate coupon code
   */
  @Post('discount/validate')
  @Public()
  async validateCoupon(
    @Body() body: { code: string; subtotal: number; items: any[] }
  ): Promise<DiscountApplication | null> {
    try {
      // This would typically integrate with a discount service
      // For now, return mock validation
      if (body.code === 'SAVE10') {
        return {
          code: 'SAVE10',
          type: 'percentage',
          value: 10,
          description: '10% off your order',
          minimumOrderAmount: 50,
          maximumDiscountAmount: 25
        };
      }

      if (body.code === 'FREESHIP') {
        return {
          code: 'FREESHIP',
          type: 'free_shipping',
          value: 0,
          description: 'Free shipping on your order'
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Coupon validation failed:', error.message);
      throw new BadRequestException(`Coupon validation failed: ${error.message}`);
    }
  }

  /**
   * Get checkout session status
   */
  @Get(':checkoutSessionId/status')
  @UseGuards(JwtAuthGuard)
  async getCheckoutStatus(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any
  ): Promise<{
    status: string;
    progress: number;
    steps: Array<{ name: string; completed: boolean; current: boolean }>;
    nextAction?: string;
  }> {
    try {
      const session = await this.checkoutService.getCheckoutSession(checkoutSessionId);
      if (!session) {
        throw new BadRequestException('Checkout session not found');
      }

      const steps = [
        { name: 'Cart Review', completed: true, current: false },
        { name: 'Shipping', completed: !!session.checkoutData.shippingAddress, current: !session.checkoutData.shippingAddress },
        { name: 'Payment', completed: !!session.paymentIntentId, current: !session.paymentIntentId && !!session.checkoutData.shippingAddress },
        { name: 'Confirmation', completed: session.status === 'completed', current: session.status === 'processing' }
      ];

      const completedSteps = steps.filter(step => step.completed).length;
      const progress = (completedSteps / steps.length) * 100;

      let nextAction: string | undefined;
      if (!session.checkoutData.shippingAddress) {
        nextAction = 'Add shipping address';
      } else if (!session.paymentIntentId) {
        nextAction = 'Add payment method';
      } else if (session.status === 'processing') {
        nextAction = 'Complete checkout';
      }

      return {
        status: session.status,
        progress,
        steps,
        nextAction
      };
    } catch (error) {
      this.logger.error('Failed to get checkout status:', error.message);
      throw new BadRequestException(`Failed to get checkout status: ${error.message}`);
    }
  }

  /**
   * Cancel checkout session
   */
  @Post(':checkoutSessionId/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelCheckout(
    @Param('checkoutSessionId') checkoutSessionId: string,
    @CurrentUser() user: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      const session = await this.checkoutService.getCheckoutSession(checkoutSessionId);
      if (!session) {
        throw new BadRequestException('Checkout session not found');
      }

      if (session.userId && session.userId !== user?.id) {
        throw new BadRequestException('Access denied to checkout session');
      }

      // Update session status
      session.status = 'cancelled';
      session.updatedAt = new Date();
      
      // This would typically update the session in the database
      // For now, just return success

      return {
        success: true,
        message: 'Checkout session cancelled successfully'
      };
    } catch (error) {
      this.logger.error('Failed to cancel checkout:', error.message);
      throw new BadRequestException(`Failed to cancel checkout: ${error.message}`);
    }
  }

  /**
   * Health check for checkout service
   */
  @Get('health')
  @Public()
  async getCheckoutHealth(): Promise<{
    status: string;
    timestamp: Date;
    services: {
      database: string;
      payment: string;
      shipping: string;
      tax: string;
    };
  }> {
    try {
      return {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          database: 'connected',
          payment: 'available',
          shipping: 'available',
          tax: 'available'
        }
      };
    } catch (error) {
      this.logger.error('Checkout health check failed:', error.message);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        services: {
          database: 'error',
          payment: 'error',
          shipping: 'error',
          tax: 'error'
        }
      };
    }
  }
}
