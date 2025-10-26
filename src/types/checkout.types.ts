export interface CheckoutRequest {
  cartId: string;
  sessionId: string;
  userId?: string;
  shippingAddress: ShippingAddress;
  billingAddress?: BillingAddress;
  paymentMethod: PaymentMethod;
  shippingMethod: ShippingMethod;
  couponCode?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface BillingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  sameAsShipping?: boolean;
}

export interface PaymentMethod {
  type: 'credit_card' | 'debit_card' | 'paypal' | 'stripe' | 'apple_pay' | 'google_pay' | 'bank_transfer';
  token?: string;
  cardNumber?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cvv?: string;
  cardholderName?: string;
  billingAddress?: BillingAddress;
  metadata?: Record<string, any>;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  cost: number;
  estimatedDays: number;
  carrier?: string;
  trackingNumber?: string;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  cartValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  inventoryValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  pricingValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  shippingValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  paymentValidation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface CheckoutCalculation {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  breakdown: {
    items: Array<{
      productId: string;
      variantId?: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    taxes: Array<{
      type: string;
      rate: number;
      amount: number;
    }>;
    discounts: Array<{
      code: string;
      type: string;
      amount: number;
    }>;
  };
}

export interface CheckoutSession {
  id: string;
  cartId: string;
  sessionId: string;
  userId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  checkoutData: CheckoutRequest;
  validationResult?: CheckoutValidationResult;
  calculation?: CheckoutCalculation;
  orderId?: string;
  paymentIntentId?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutResult {
  success: boolean;
  checkoutSessionId: string;
  orderId?: string;
  paymentIntentId?: string;
  redirectUrl?: string;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  clientSecret?: string;
  paymentMethodId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderCreationRequest {
  checkoutSessionId: string;
  cartId: string;
  userId?: string;
  shippingAddress: ShippingAddress;
  billingAddress?: BillingAddress;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
    name: string;
  }>;
  totals: CheckoutCalculation;
  paymentIntentId?: string;
  metadata?: Record<string, any>;
}

export interface OrderCreationResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  status?: string;
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface CheckoutError {
  code: string;
  message: string;
  field?: string;
  details?: any;
  timestamp: Date;
}

export interface CheckoutServiceConfig {
  orderServiceUrl: string;
  paymentServiceUrl: string;
  shippingServiceUrl: string;
  taxServiceUrl: string;
  timeout: number;
  retryAttempts: number;
  sessionTimeout: number;
}

export interface ShippingOption {
  id: string;
  name: string;
  description?: string;
  cost: number;
  estimatedDays: number;
  carrier: string;
  service: string;
  trackingSupported: boolean;
  insuranceIncluded: boolean;
  signatureRequired: boolean;
}

export interface TaxCalculation {
  rate: number;
  amount: number;
  type: string;
  jurisdiction: string;
  description?: string;
}

export interface DiscountApplication {
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  description?: string;
  validFrom?: Date;
  validTo?: Date;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  status: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
  errors?: string[];
}

export interface PaymentServiceConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  webhookSecret: string;
  supportedCurrencies: string[];
  supportedPaymentMethods: string[];
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded' 
  | 'failed';

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  status: OrderStatus;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  billingAddress?: BillingAddress;
  totals: CheckoutCalculation;
  paymentIntentId?: string;
  trackingNumber?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: Record<string, any>;
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  totalItems: number;
  totalAmount: number;
  currency: string;
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  createdAt: Date;
}
