export enum CacheLevel {
    L1_MEMORY = 'l1_memory',
    L2_REDIS = 'l2_redis',
    L3_DATABASE = 'l3_database'
}

export enum CacheStrategy {
    WRITE_THROUGH = 'write_through',
    WRITE_BACK = 'write_back',
    WRITE_AROUND = 'write_around',
    READ_THROUGH = 'read_through',
    CACHE_ASIDE = 'cache_aside'
}

export enum CacheEvictionPolicy {
    LRU = 'lru',
    LFU = 'lfu',
    FIFO = 'fifo',
    TTL = 'ttl',
    RANDOM = 'random'
}

export enum CacheKeyType {
    CART = 'cart',
    PRODUCT = 'product',
    PRICING = 'pricing',
    SESSION = 'session',
    USER = 'user',
    ORDER = 'order',
    NOTIFICATION = 'notification',
    ANALYTICS = 'analytics'
}

export interface CacheConfig {
    level: CacheLevel;
    strategy: CacheStrategy;
    evictionPolicy: CacheEvictionPolicy;
    ttl: number; // in seconds
    maxSize: number;
    compression: boolean;
    encryption: boolean;
}

export interface CacheEntry<T = any> {
    key: string;
    value: T;
    ttl: number;
    createdAt: Date;
    accessedAt: Date;
    accessCount: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
    metadata?: Record<string, any>;
}

export interface CacheMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    missRate: number;
    evictions: number;
    insertions: number;
    updates: number;
    deletions: number;
    totalSize: number;
    averageAccessTime: number;
    averageInsertionTime: number;
    memoryUsage: number;
    cpuUsage: number;
}

export interface CacheStats {
    totalKeys: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
    averageTtl: number;
    oldestEntry: Date;
    newestEntry: Date;
    byType: Record<CacheKeyType, number>;
    byLevel: Record<CacheLevel, number>;
    topKeys: Array<{
        key: string;
        accessCount: number;
        size: number;
    }>;
}

export interface CacheOperation {
    id: string;
    type: 'get' | 'set' | 'delete' | 'update' | 'evict';
    key: string;
    level: CacheLevel;
    success: boolean;
    duration: number;
    timestamp: Date;
    error?: string;
    metadata?: Record<string, any>;
}

export interface CacheInvalidationRule {
    id: string;
    pattern: string;
    triggers: string[];
    conditions: Record<string, any>;
    action: 'invalidate' | 'update' | 'refresh';
    priority: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CacheWarmingConfig {
    id: string;
    name: string;
    keys: string[];
    strategy: 'immediate' | 'scheduled' | 'on_demand';
    schedule?: string; // cron expression
    priority: number;
    isActive: boolean;
    lastRun?: Date;
    nextRun?: Date;
    metadata?: Record<string, any>;
}

export interface CachePerformanceMetrics {
    responseTime: {
        p50: number;
        p95: number;
        p99: number;
        average: number;
        max: number;
    };
    throughput: {
        requestsPerSecond: number;
        operationsPerSecond: number;
        dataTransferRate: number;
    };
    resourceUsage: {
        memory: number;
        cpu: number;
        disk: number;
        network: number;
    };
    errorRate: {
        total: number;
        byType: Record<string, number>;
        byLevel: Record<CacheLevel, number>;
    };
    availability: {
        uptime: number;
        downtime: number;
        incidents: number;
    };
}

export interface DatabaseOptimizationConfig {
    connectionPool: {
        min: number;
        max: number;
        idle: number;
        acquire: number;
    };
    queryOptimization: {
        enableQueryCache: boolean;
        enableQueryLogging: boolean;
        slowQueryThreshold: number;
        maxQueryTime: number;
    };
    indexing: {
        autoCreate: boolean;
        autoUpdate: boolean;
        backgroundIndexing: boolean;
    };
    batchOperations: {
        enableBatching: boolean;
        batchSize: number;
        batchTimeout: number;
    };
}

export interface CDNConfig {
    provider: 'cloudflare' | 'aws_cloudfront' | 'azure_cdn' | 'google_cloud_cdn';
    endpoints: string[];
    cacheControl: {
        maxAge: number;
        sMaxAge: number;
        public: boolean;
        private: boolean;
        noCache: boolean;
        noStore: boolean;
    };
    compression: {
        enabled: boolean;
        algorithms: string[];
        minSize: number;
    };
    optimization: {
        imageOptimization: boolean;
        lazyLoading: boolean;
        preloading: boolean;
        minification: boolean;
    };
}

export interface PerformanceMetrics {
    timestamp: Date;
    responseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
    databaseConnections: number;
    cacheHitRate: number;
    queueSize: number;
    activeConnections: number;
}

export interface PerformanceAlert {
    id: string;
    type: 'response_time' | 'error_rate' | 'memory_usage' | 'cpu_usage' | 'cache_hit_rate';
    threshold: number;
    currentValue: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    metadata?: Record<string, any>;
}

export interface OptimizationReport {
    id: string;
    timestamp: Date;
    duration: number;
    optimizations: Optimization[];
    performanceGains: PerformanceGain[];
    recommendations: Recommendation[];
    metrics: PerformanceMetrics;
    metadata?: Record<string, any>;
}

export interface Optimization {
    type: 'query' | 'index' | 'cache' | 'connection' | 'batch';
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    appliedAt?: Date;
    results?: Record<string, any>;
}

export interface PerformanceGain {
    metric: string;
    before: number;
    after: number;
    improvement: number;
    percentage: number;
    description: string;
}

export interface Recommendation {
    type: 'performance' | 'scalability' | 'reliability' | 'security';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    impact: string;
    effort: string;
    timeline: string;
    resources: string[];
}

export interface CacheKey {
    type: CacheKeyType;
    id: string;
    version?: string;
    namespace?: string;
    tags?: string[];
}

export interface CacheTag {
    name: string;
    keys: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CacheNamespace {
    name: string;
    config: CacheConfig;
    keys: string[];
    metrics: CacheMetrics;
    createdAt: Date;
    updatedAt: Date;
}

export interface CacheCluster {
    id: string;
    name: string;
    nodes: CacheNode[];
    config: CacheConfig;
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: CacheMetrics;
    createdAt: Date;
    updatedAt: Date;
}

export interface CacheNode {
    id: string;
    host: string;
    port: number;
    role: 'master' | 'slave' | 'sentinel';
    status: 'online' | 'offline' | 'syncing';
    metrics: CacheMetrics;
    lastSeen: Date;
}

export interface CacheOperationResult<T = any> {
    success: boolean;
    value?: T;
    error?: string;
    duration: number;
    fromCache: boolean;
    cacheLevel: CacheLevel;
    metadata?: Record<string, any>;
}

export interface CacheBulkOperation {
    operations: Array<{
        type: 'get' | 'set' | 'delete' | 'update';
        key: string;
        value?: any;
        ttl?: number;
    }>;
    results: CacheOperationResult[];
    totalDuration: number;
    successCount: number;
    errorCount: number;
}

export interface CacheHealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
        name: string;
        status: 'pass' | 'fail' | 'warn';
        message: string;
        duration: number;
    }>;
    metrics: CacheMetrics;
    timestamp: Date;
}

export interface CacheAnalytics {
    period: {
        start: Date;
        end: Date;
    };
    metrics: CacheMetrics;
    trends: Array<{
        timestamp: Date;
        metrics: CacheMetrics;
    }>;
    topKeys: Array<{
        key: string;
        accessCount: number;
        size: number;
        hitRate: number;
    }>;
    performance: CachePerformanceMetrics;
    recommendations: Recommendation[];
}
