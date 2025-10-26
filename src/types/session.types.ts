export enum SessionType {
    GUEST = 'guest',
    AUTHENTICATED = 'authenticated',
    TEMPORARY = 'temporary'
}

export enum SessionStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    SUSPENDED = 'suspended',
    TERMINATED = 'terminated'
}

export enum DeviceType {
    WEB = 'web',
    MOBILE = 'mobile',
    TABLET = 'tablet',
    DESKTOP = 'desktop',
    UNKNOWN = 'unknown'
}

export enum SyncStatus {
    SYNCED = 'synced',
    PENDING = 'pending',
    CONFLICT = 'conflict',
    ERROR = 'error'
}

export interface Session {
    id: string;
    sessionToken: string;
    userId?: string;
    type: SessionType;
    status: SessionStatus;
    deviceInfo: DeviceInfo;
    lastActivity: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, any>;
}

export interface DeviceInfo {
    deviceId: string;
    deviceType: DeviceType;
    userAgent: string;
    ipAddress: string;
    location?: LocationInfo;
    capabilities: DeviceCapabilities;
}

export interface LocationInfo {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}

export interface DeviceCapabilities {
    supportsWebSocket: boolean;
    supportsNotifications: boolean;
    supportsGeolocation: boolean;
    supportsOfflineMode: boolean;
    maxCartItems: number;
    maxSessionDuration: number; // in minutes
}

export interface SessionContext {
    sessionId: string;
    sessionToken: string;
    userId?: string;
    deviceId: string;
    isAuthenticated: boolean;
    lastActivity: Date;
    expiresAt: Date;
}

export interface CartSnapshot {
    id: string;
    sessionId: string;
    cartId: string;
    userId?: string;
    snapshotData: CartData;
    version: number;
    createdAt: Date;
    expiresAt: Date;
    metadata?: Record<string, any>;
}

export interface CartData {
    items: CartItemData[];
    totals: CartTotalsData;
    metadata: Record<string, any>;
    lastModified: Date;
}

export interface CartItemData {
    id: string;
    productId: string;
    variantId?: string;
    quantity: number;
    price: number;
    originalPrice?: number;
    addedAt: Date;
    metadata?: Record<string, any>;
}

export interface CartTotalsData {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    itemCount: number;
    currency: string;
}

export interface SessionSync {
    id: string;
    sessionId: string;
    deviceId: string;
    syncStatus: SyncStatus;
    lastSyncAt: Date;
    conflictResolution?: ConflictResolution;
    metadata?: Record<string, any>;
}

export interface ConflictResolution {
    strategy: 'latest_wins' | 'merge' | 'user_choice' | 'manual';
    resolvedAt: Date;
    resolvedBy: string;
    changes: ConflictChange[];
}

export interface ConflictChange {
    field: string;
    oldValue: any;
    newValue: any;
    resolution: 'accepted' | 'rejected' | 'merged';
}

export interface SessionMigration {
    id: string;
    fromSessionId: string;
    toSessionId: string;
    userId?: string;
    migrationType: 'guest_to_user' | 'user_to_user' | 'device_transfer';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    migratedAt?: Date;
    metadata?: Record<string, any>;
}

export interface CartBackup {
    id: string;
    sessionId: string;
    cartId: string;
    userId?: string;
    backupData: CartData;
    backupType: 'automatic' | 'manual' | 'scheduled';
    createdAt: Date;
    expiresAt: Date;
    metadata?: Record<string, any>;
}

export interface SessionAnalytics {
    totalSessions: number;
    activeSessions: number;
    sessionsByType: Record<SessionType, number>;
    sessionsByDevice: Record<DeviceType, number>;
    averageSessionDuration: number;
    cartRecoveryRate: number;
    syncSuccessRate: number;
    topCountries: Array<{
        country: string;
        sessionCount: number;
    }>;
    sessionTrends: Array<{
        date: string;
        sessionCount: number;
        activeUsers: number;
    }>;
}

export interface CreateSessionRequest {
    userId?: string;
    deviceInfo: DeviceInfo;
    sessionType?: SessionType;
    duration?: number; // in minutes
    metadata?: Record<string, any>;
}

export interface SessionResponse {
    sessionId: string;
    sessionToken: string;
    userId?: string;
    type: SessionType;
    status: SessionStatus;
    deviceInfo: DeviceInfo;
    lastActivity: Date;
    expiresAt: Date;
    createdAt: Date;
}

export interface SessionListResponse {
    sessions: SessionResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface SessionSearchFilters {
    userId?: string;
    type?: SessionType;
    status?: SessionStatus;
    deviceType?: DeviceType;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'lastActivity' | 'expiresAt';
    sortOrder?: 'asc' | 'desc';
}

export interface CartSyncRequest {
    sessionId: string;
    deviceId: string;
    cartData: CartData;
    version: number;
    lastSyncAt: Date;
}

export interface CartSyncResponse {
    success: boolean;
    syncStatus: SyncStatus;
    conflicts?: ConflictChange[];
    resolvedCart?: CartData;
    errorMessage?: string;
    metadata?: Record<string, any>;
}

export interface SessionCleanupJob {
    id: string;
    jobType: 'expired_sessions' | 'orphaned_carts' | 'old_backups';
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    processedCount: number;
    errorCount: number;
    metadata?: Record<string, any>;
}

export interface CartBackupJob {
    id: string;
    sessionId: string;
    cartId: string;
    backupType: 'automatic' | 'manual' | 'scheduled';
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: Date;
    completedAt?: Date;
    backupSize: number;
    metadata?: Record<string, any>;
}

export interface SessionNotification {
    id: string;
    sessionId: string;
    userId?: string;
    type: 'session_expiring' | 'cart_updated' | 'device_sync' | 'session_migrated';
    title: string;
    message: string;
    isRead: boolean;
    metadata?: Record<string, any>;
    createdAt: Date;
    readAt?: Date;
}

export interface SessionError {
    code: string;
    message: string;
    field?: string;
    value?: any;
    metadata?: Record<string, any>;
}

export interface SessionValidationResult {
    isValid: boolean;
    errors: SessionError[];
    warnings: string[];
    metadata?: Record<string, any>;
}
