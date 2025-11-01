export enum EventType {
    CART_ITEM_ADDED = 'cart.item.added',
    CART_ITEM_REMOVED = 'cart.item.removed',
    CART_ITEM_UPDATED = 'cart.item.updated',
    CART_CLEARED = 'cart.cleared',
    CART_MERGED = 'cart.merged',
    CART_ABANDONED = 'cart.abandoned',
    CART_RECOVERED = 'cart.recovered',
    PRODUCT_PRICE_CHANGED = 'product.price.changed',
    PRODUCT_STOCK_UPDATED = 'product.stock.updated',
    PRODUCT_DISCONTINUED = 'product.discontinued',
    ORDER_CREATED = 'order.created',
    ORDER_STATUS_CHANGED = 'order.status.changed',
    PAYMENT_PROCESSED = 'payment.processed',
    SHIPPING_UPDATED = 'shipping.updated',
    NOTIFICATION_SENT = 'notification.sent',
    SESSION_EXPIRED = 'session.expired',
    DEVICE_SYNCED = 'device.synced'
}

export enum NotificationType {
    CART_REMINDER = 'cart_reminder',
    PRICE_DROP = 'price_drop',
    STOCK_ALERT = 'stock_alert',
    PROMOTION = 'promotion',
    ORDER_UPDATE = 'order_update',
    SHIPPING_UPDATE = 'shipping_update',
    PAYMENT_CONFIRMATION = 'payment_confirmation',
    CART_ABANDONMENT = 'cart_abandonment',
    PRODUCT_DISCONTINUED = 'product_discontinued',
    SYSTEM_ALERT = 'system_alert'
}

export enum NotificationChannel {
    EMAIL = 'email',
    PUSH = 'push',
    SMS = 'sms',
    IN_APP = 'in_app',
    WEBHOOK = 'webhook'
}

export enum NotificationPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    BOUNCED = 'bounced',
    UNSUBSCRIBED = 'unsubscribed'
}

export enum WebSocketEventType {
    CONNECT = 'connect',
    DISCONNECT = 'disconnect',
    JOIN_ROOM = 'join_room',
    LEAVE_ROOM = 'leave_room',
    CART_UPDATE = 'cart_update',
    NOTIFICATION = 'notification',
    ERROR = 'error',
    PING = 'ping',
    PONG = 'pong'
}

export interface BaseEvent {
    id: string;
    type: EventType;
    timestamp: Date;
    source: string;
    version: string;
    metadata?: Record<string, any>;
}

export interface CartEvent extends BaseEvent {
    cartId: string;
    sessionId: string;
    userId?: string;
    deviceId?: string;
    changes: CartChange[];
    totals: CartTotals;
    metadata?: Record<string, any>;
}

export interface CartChange {
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'added' | 'removed' | 'updated';
    timestamp: Date;
}

export interface CartTotals {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    itemCount: number;
    currency: string;
}

export interface ProductEvent extends BaseEvent {
    productId: string;
    variantId?: string;
    changes: ProductChange[];
    metadata?: Record<string, any>;
}

export interface ProductChange {
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'price' | 'stock' | 'availability' | 'discontinued';
    timestamp: Date;
}

export interface OrderEvent extends BaseEvent {
    orderId: string;
    orderNumber: string;
    userId: string;
    status: string;
    changes: OrderChange[];
    metadata?: Record<string, any>;
}

export interface OrderChange {
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'status' | 'payment' | 'shipping' | 'cancellation';
    timestamp: Date;
}

export interface NotificationEvent extends Omit<BaseEvent, 'type'> {
    notificationId: string;
    userId: string;
    type: NotificationType;
    eventType: EventType.NOTIFICATION_SENT;
    channel: NotificationChannel;
    status: NotificationStatus;
    content: NotificationContent;
    metadata?: Record<string, any>;
}

export interface NotificationContent {
    title: string;
    message: string;
    actionUrl?: string;
    imageUrl?: string;
    data?: Record<string, any>;
}

export interface WebSocketMessage {
    type: WebSocketEventType;
    room?: string;
    data: any;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface WebSocketConnection {
    id: string;
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    rooms: string[];
    connectedAt: Date;
    lastActivity: Date;
    metadata?: Record<string, any>;
}

export interface NotificationPreferences {
    id: string;
    userId: string;
    channels: NotificationChannelPreferences;
    types: NotificationTypePreferences;
    frequency: NotificationFrequency;
    quietHours: QuietHours;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationChannelPreferences {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
    webhook: boolean;
}

export interface NotificationTypePreferences {
    cartReminder: boolean;
    priceDrop: boolean;
    stockAlert: boolean;
    promotion: boolean;
    orderUpdate: boolean;
    shippingUpdate: boolean;
    paymentConfirmation: boolean;
    cartAbandonment: boolean;
    productDiscontinued: boolean;
    systemAlert: boolean;
}

export interface NotificationFrequency {
    immediate: boolean;
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
    custom: {
        enabled: boolean;
        interval: number; // in hours
    };
}

export interface QuietHours {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
    days: number[]; // 0-6 (Sunday-Saturday)
}

export interface NotificationTemplate {
    id: string;
    type: NotificationType;
    channel: NotificationChannel;
    name: string;
    subject?: string;
    content: string;
    variables: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationDelivery {
    id: string;
    notificationId: string;
    userId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    sentAt?: Date;
    deliveredAt?: Date;
    failedAt?: Date;
    errorMessage?: string;
    metadata?: Record<string, any>;
}

export interface EventSubscription {
    id: string;
    userId: string;
    eventType: EventType;
    isActive: boolean;
    filters?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface WebSocketRoom {
    id: string;
    name: string;
    type: 'user' | 'session' | 'cart' | 'product' | 'order';
    members: string[];
    createdAt: Date;
    metadata?: Record<string, any>;
}

export interface NotificationAnalytics {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    byChannel: Record<NotificationChannel, number>;
    byType: Record<NotificationType, number>;
    byStatus: Record<NotificationStatus, number>;
    averageDeliveryTime: number;
    topUsers: Array<{
        userId: string;
        notificationCount: number;
    }>;
    trends: Array<{
        date: string;
        sent: number;
        delivered: number;
        failed: number;
    }>;
}

export interface EventAnalytics {
    totalEvents: number;
    byType: Record<EventType, number>;
    bySource: Record<string, number>;
    averageEventsPerHour: number;
    topEventTypes: Array<{
        type: EventType;
        count: number;
    }>;
    trends: Array<{
        date: string;
        eventCount: number;
        uniqueUsers: number;
    }>;
}

export interface WebSocketAnalytics {
    totalConnections: number;
    activeConnections: number;
    averageConnectionDuration: number;
    messagesPerConnection: number;
    byRoom: Record<string, number>;
    connectionTrends: Array<{
        date: string;
        connections: number;
        messages: number;
    }>;
}

export interface CreateNotificationRequest {
    userId: string;
    type: NotificationType;
    channel: NotificationChannel;
    priority: NotificationPriority;
    content: NotificationContent;
    scheduledAt?: Date;
    metadata?: Record<string, any>;
}

export interface NotificationResponse {
    id: string;
    userId: string;
    type: NotificationType;
    channel: NotificationChannel;
    status: NotificationStatus;
    content: NotificationContent;
    sentAt?: Date;
    deliveredAt?: Date;
    metadata?: Record<string, any>;
}

export interface NotificationListResponse {
    notifications: NotificationResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface NotificationSearchFilters {
    userId?: string;
    type?: NotificationType;
    channel?: NotificationChannel;
    status?: NotificationStatus;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'sentAt' | 'deliveredAt';
    sortOrder?: 'asc' | 'desc';
}

export interface EventSearchFilters {
    type?: EventType;
    source?: string;
    userId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'timestamp' | 'type' | 'source';
    sortOrder?: 'asc' | 'desc';
}

export interface WebSocketConnectionFilters {
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    room?: string;
    connectedAfter?: Date;
    connectedBefore?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'connectedAt' | 'lastActivity';
    sortOrder?: 'asc' | 'desc';
}

export interface NotificationError {
    code: string;
    message: string;
    field?: string;
    value?: any;
    metadata?: Record<string, any>;
}

export interface NotificationValidationResult {
    isValid: boolean;
    errors: NotificationError[];
    warnings: string[];
    metadata?: Record<string, any>;
}

export interface EventHandler {
    eventType: EventType;
    handler: (event: BaseEvent) => Promise<void>;
    priority: number;
    isActive: boolean;
}

export interface WebSocketEventHandler {
    eventType: WebSocketEventType;
    handler: (connection: WebSocketConnection, message: WebSocketMessage) => Promise<void>;
    priority: number;
    isActive: boolean;
}
