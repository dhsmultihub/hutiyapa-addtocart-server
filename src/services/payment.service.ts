import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  PaymentIntent,
  PaymentMethod,
  PaymentResult,
  PaymentServiceConfig
} from '../types/checkout.types';

export interface PaymentProcessingRequest {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, any>;
  customerId?: string;
  description?: string;
}

export interface PaymentConfirmationRequest {
  paymentIntentId: string;
  paymentMethodId?: string;
  confirmationData?: any;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly config: PaymentServiceConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.config = {
      baseUrl: this.configService.get('PAYMENT_SERVICE_URL', 'http://localhost:3004'),
      apiKey: this.configService.get('PAYMENT_SERVICE_API_KEY', ''),
      timeout: parseInt(this.configService.get('PAYMENT_SERVICE_TIMEOUT', '30000'), 10),
      retryAttempts: parseInt(this.configService.get('PAYMENT_SERVICE_RETRY_ATTEMPTS', '3'), 10),
      webhookSecret: this.configService.get('PAYMENT_WEBHOOK_SECRET', ''),
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
      supportedPaymentMethods: ['credit_card', 'debit_card', 'paypal', 'stripe', 'apple_pay', 'google_pay']
    };
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(request: PaymentProcessingRequest): Promise<PaymentIntent> {
    try {
      this.logger.log(`Creating payment intent for amount: ${request.amount} ${request.currency}`);

      // Validate payment method
      this.validatePaymentMethod(request.paymentMethod);

      // Validate currency
      if (!this.config.supportedCurrencies.includes(request.currency)) {
        throw new BadRequestException(`Unsupported currency: ${request.currency}`);
      }

      // Create payment intent via payment service
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/api/v1/payment-intents`,
          {
            amount: request.amount,
            currency: request.currency,
            paymentMethod: request.paymentMethod,
            metadata: request.metadata,
            customerId: request.customerId,
            description: request.description
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        )
      );

      const paymentIntent: PaymentIntent = {
        id: response.data.id,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
        clientSecret: response.data.client_secret,
        paymentMethodId: response.data.payment_method_id,
        metadata: response.data.metadata,
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.updated_at)
      };

      this.logger.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;

    } catch (error) {
      this.logger.error('Failed to create payment intent:', error.message);
      throw new BadRequestException(`Payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Confirm payment intent
   */
  async confirmPaymentIntent(request: PaymentConfirmationRequest): Promise<PaymentResult> {
    try {
      this.logger.log(`Confirming payment intent: ${request.paymentIntentId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/api/v1/payment-intents/${request.paymentIntentId}/confirm`,
          {
            paymentMethodId: request.paymentMethodId,
            confirmationData: request.confirmationData
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        )
      );

      const result: PaymentResult = {
        success: response.data.status === 'succeeded',
        paymentIntentId: request.paymentIntentId,
        status: response.data.status,
        transactionId: response.data.transaction_id,
        amount: response.data.amount,
        currency: response.data.currency,
        metadata: response.data.metadata,
        errors: response.data.errors || []
      };

      this.logger.log(`Payment intent confirmed: ${result.success ? 'success' : 'failed'}`);
      return result;

    } catch (error) {
      this.logger.error('Failed to confirm payment intent:', error.message);
      throw new BadRequestException(`Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Cancel payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentResult> {
    try {
      this.logger.log(`Cancelling payment intent: ${paymentIntentId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/api/v1/payment-intents/${paymentIntentId}/cancel`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        )
      );

      const result: PaymentResult = {
        success: response.data.status === 'cancelled',
        paymentIntentId,
        status: response.data.status,
        metadata: response.data.metadata,
        errors: response.data.errors || []
      };

      this.logger.log(`Payment intent cancelled: ${result.success ? 'success' : 'failed'}`);
      return result;

    } catch (error) {
      this.logger.error('Failed to cancel payment intent:', error.message);
      throw new BadRequestException(`Payment cancellation failed: ${error.message}`);
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntentStatus(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      this.logger.log(`Getting payment intent status: ${paymentIntentId}`);

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.config.baseUrl}/api/v1/payment-intents/${paymentIntentId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`
            },
            timeout: this.config.timeout
          }
        )
      );

      const paymentIntent: PaymentIntent = {
        id: response.data.id,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
        clientSecret: response.data.client_secret,
        paymentMethodId: response.data.payment_method_id,
        metadata: response.data.metadata,
        createdAt: new Date(response.data.created_at),
        updatedAt: new Date(response.data.updated_at)
      };

      return paymentIntent;

    } catch (error) {
      this.logger.error('Failed to get payment intent status:', error.message);
      throw new BadRequestException(`Failed to get payment intent status: ${error.message}`);
    }
  }

  /**
   * Process refund
   */
  async processRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<{
    success: boolean;
    refundId: string;
    amount: number;
    status: string;
    errors?: string[];
  }> {
    try {
      this.logger.log(`Processing refund for payment intent: ${paymentIntentId}`);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.config.baseUrl}/api/v1/payment-intents/${paymentIntentId}/refund`,
          {
            amount,
            reason
          },
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
          }
        )
      );

      return {
        success: response.data.status === 'succeeded',
        refundId: response.data.refund_id,
        amount: response.data.amount,
        status: response.data.status,
        errors: response.data.errors || []
      };

    } catch (error) {
      this.logger.error('Failed to process refund:', error.message);
      throw new BadRequestException(`Refund processing failed: ${error.message}`);
    }
  }

  /**
   * Validate webhook signature
   */
  async validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): Promise<boolean> {
    try {
      // This would typically validate the webhook signature using the webhook secret
      // For now, return true for demonstration
      return true;
    } catch (error) {
      this.logger.error('Webhook signature validation failed:', error.message);
      return false;
    }
  }

  /**
   * Handle payment webhook
   */
  async handlePaymentWebhook(
    eventType: string,
    data: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Handling payment webhook: ${eventType}`);

      switch (eventType) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(data);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(data);
          break;
        case 'payment_intent.cancelled':
          await this.handlePaymentCancellation(data);
          break;
        default:
          this.logger.warn(`Unhandled webhook event type: ${eventType}`);
      }

      return {
        success: true,
        message: 'Webhook handled successfully'
      };

    } catch (error) {
      this.logger.error('Failed to handle payment webhook:', error.message);
      return {
        success: false,
        message: `Webhook handling failed: ${error.message}`
      };
    }
  }

  /**
   * Get supported payment methods
   */
  getSupportedPaymentMethods(): string[] {
    return this.config.supportedPaymentMethods;
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies(): string[] {
    return this.config.supportedCurrencies;
  }

  /**
   * Validate payment method
   */
  private validatePaymentMethod(paymentMethod: PaymentMethod): void {
    if (!this.config.supportedPaymentMethods.includes(paymentMethod.type)) {
      throw new BadRequestException(`Unsupported payment method: ${paymentMethod.type}`);
    }

    if (paymentMethod.type === 'credit_card' || paymentMethod.type === 'debit_card') {
      if (!paymentMethod.cardNumber || !paymentMethod.expiryMonth || !paymentMethod.expiryYear || !paymentMethod.cvv) {
        throw new BadRequestException('Credit card details are incomplete');
      }
    }
  }

  /**
   * Handle payment success
   */
  private async handlePaymentSuccess(data: any): Promise<void> {
    this.logger.log(`Payment succeeded: ${data.payment_intent_id}`);
    // This would typically update order status, send confirmation emails, etc.
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(data: any): Promise<void> {
    this.logger.log(`Payment failed: ${data.payment_intent_id}`);
    // This would typically update order status, send failure notifications, etc.
  }

  /**
   * Handle payment cancellation
   */
  private async handlePaymentCancellation(data: any): Promise<void> {
    this.logger.log(`Payment cancelled: ${data.payment_intent_id}`);
    // This would typically update order status, release inventory, etc.
  }
}
