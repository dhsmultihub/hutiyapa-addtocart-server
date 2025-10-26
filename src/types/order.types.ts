export enum OrderStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded',
    FAILED = 'failed'
}

export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
    CANCELLED = 'cancelled'
}

export enum ShippingStatus {
    PENDING = 'pending',
    PREPARING = 'preparing',
    SHIPPED = 'shipped',
    IN_TRANSIT = 'in_transit',
    DELIVERED = 'delivered',
    RETURNED = 'returned',
    LOST = 'lost'
}

export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    variantId?: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productImage?: string;
    productUrl?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ShippingAddress {
    id: string;
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
    isDefault?: boolean;
}

export interface BillingAddress {
    id: string;
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
    isDefault?: boolean;
}

export interface OrderTotals {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
    currency: string;
}

export interface OrderPayment {
    id: string;
    orderId: string;
    paymentMethod: string;
    paymentProvider: string;
    transactionId?: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    processedAt?: Date;
    failedAt?: Date;
    refundedAt?: Date;
    refundAmount?: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderShipping {
    id: string;
    orderId: string;
    carrier: string;
    trackingNumber?: string;
    status: ShippingStatus;
    estimatedDelivery?: Date;
    actualDelivery?: Date;
    shippingAddress: ShippingAddress;
    shippingMethod: string;
    shippingCost: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Order {
    id: string;
    orderNumber: string;
    userId: string;
    sessionId?: string;
    status: OrderStatus;
    items: OrderItem[];
    totals: OrderTotals;
    payment: OrderPayment;
    shipping: OrderShipping;
    billingAddress: BillingAddress;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    cancelledAt?: Date;
}

export interface CreateOrderRequest {
    userId: string;
    sessionId?: string;
    items: {
        productId: string;
        variantId?: string;
        quantity: number;
        unitPrice: number;
        metadata?: Record<string, any>;
    }[];
    shippingAddress: Omit<ShippingAddress, 'id'>;
    billingAddress: Omit<BillingAddress, 'id'>;
    paymentMethod: string;
    paymentProvider: string;
    shippingMethod: string;
    notes?: string;
    metadata?: Record<string, any>;
}

export interface UpdateOrderRequest {
    status?: OrderStatus;
    notes?: string;
    metadata?: Record<string, any>;
    trackingNumber?: string;
    shippingStatus?: ShippingStatus;
}

export interface OrderResponse {
    id: string;
    orderNumber: string;
    userId: string;
    status: OrderStatus;
    items: OrderItem[];
    totals: OrderTotals;
    payment: {
        id: string;
        status: PaymentStatus;
        amount: number;
        currency: string;
        method: string;
        provider: string;
        transactionId?: string;
    };
    shipping: {
        id: string;
        status: ShippingStatus;
        carrier: string;
        trackingNumber?: string;
        estimatedDelivery?: Date;
        actualDelivery?: Date;
    };
    addresses: {
        shipping: ShippingAddress;
        billing: BillingAddress;
    };
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

export interface OrderListResponse {
    orders: OrderResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface OrderSearchFilters {
    userId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    shippingStatus?: ShippingStatus;
    dateFrom?: Date;
    dateTo?: Date;
    orderNumber?: string;
    productId?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'total' | 'status';
    sortOrder?: 'asc' | 'desc';
}

export interface OrderAnalytics {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<OrderStatus, number>;
    ordersByPaymentStatus: Record<PaymentStatus, number>;
    ordersByShippingStatus: Record<ShippingStatus, number>;
    topProducts: Array<{
        productId: string;
        productName: string;
        quantity: number;
        revenue: number;
    }>;
    ordersByDateRange: Array<{
        date: string;
        orders: number;
        revenue: number;
    }>;
}

export interface OrderEvent {
    id: string;
    orderId: string;
    eventType: 'created' | 'updated' | 'status_changed' | 'payment_processed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
    eventData: Record<string, any>;
    userId: string;
    createdAt: Date;
}

export interface OrderNotification {
    id: string;
    orderId: string;
    userId: string;
    type: 'order_confirmation' | 'payment_confirmation' | 'shipping_update' | 'delivery_confirmation' | 'order_cancelled' | 'refund_processed';
    title: string;
    message: string;
    isRead: boolean;
    metadata?: Record<string, any>;
    createdAt: Date;
    readAt?: Date;
}
