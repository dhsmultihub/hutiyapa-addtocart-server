export enum HealthStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    UNHEALTHY = 'unhealthy',
    UNKNOWN = 'unknown'
}

export enum AlertSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum AlertStatus {
    ACTIVE = 'active',
    RESOLVED = 'resolved',
    SUPPRESSED = 'suppressed',
    ACKNOWLEDGED = 'acknowledged'
}

export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    FATAL = 'fatal'
}

export enum MetricType {
    COUNTER = 'counter',
    GAUGE = 'gauge',
    HISTOGRAM = 'histogram',
    SUMMARY = 'summary'
}

export interface HealthCheck {
    name: string;
    status: HealthStatus;
    message?: string;
    duration: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface HealthCheckResult {
    status: HealthStatus;
    checks: HealthCheck[];
    timestamp: Date;
    duration: number;
    version: string;
    uptime: number;
    metadata?: Record<string, any>;
}

export interface DatabaseHealthCheck extends HealthCheck {
    connectionCount: number;
    activeConnections: number;
    queryTime: number;
    lastQueryTime: Date;
}

export interface RedisHealthCheck extends HealthCheck {
    connectionStatus: boolean;
    memoryUsage: number;
    keyCount: number;
    hitRate: number;
    latency: number;
}

export interface ExternalServiceHealthCheck extends HealthCheck {
    serviceName: string;
    endpoint: string;
    responseTime: number;
    statusCode: number;
    lastCheck: Date;
}

export interface SystemHealthCheck extends HealthCheck {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    loadAverage: number[];
    uptime: number;
}

export interface BusinessHealthCheck extends HealthCheck {
    metric: string;
    value: number;
    threshold: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    impact: 'low' | 'medium' | 'high';
}

export interface Metric {
    name: string;
    type: MetricType;
    value: number;
    labels: Record<string, string>;
    timestamp: Date;
    description?: string;
}

export interface CounterMetric extends Metric {
    type: MetricType.COUNTER;
    increment: number;
}

export interface GaugeMetric extends Metric {
    type: MetricType.GAUGE;
    setValue: number;
}

export interface HistogramMetric extends Metric {
    type: MetricType.HISTOGRAM;
    buckets: number[];
    count: number;
    sum: number;
}

export interface SummaryMetric extends Metric {
    type: MetricType.SUMMARY;
    quantiles: Record<number, number>;
    count: number;
    sum: number;
}

export interface Alert {
    id: string;
    name: string;
    description: string;
    severity: AlertSeverity;
    status: AlertStatus;
    source: string;
    metric: string;
    threshold: number;
    currentValue: number;
    triggeredAt: Date;
    resolvedAt?: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    metadata?: Record<string, any>;
}

export interface AlertRule {
    id: string;
    name: string;
    description: string;
    metric: string;
    condition: string;
    threshold: number;
    severity: AlertSeverity;
    enabled: boolean;
    cooldown: number; // in minutes
    escalation: AlertEscalation;
    notifications: AlertNotification[];
    createdAt: Date;
    updatedAt: Date;
}

export interface AlertEscalation {
    levels: Array<{
        level: number;
        delay: number; // in minutes
        recipients: string[];
        channels: string[];
    }>;
}

export interface AlertNotification {
    type: 'email' | 'slack' | 'webhook' | 'sms';
    endpoint: string;
    template: string;
    enabled: boolean;
}

export interface LogEntry {
    id: string;
    timestamp: Date;
    level: LogLevel;
    message: string;
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    service: string;
    method?: string;
    url?: string;
    statusCode?: number;
    duration?: number;
    metadata?: Record<string, any>;
    error?: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
    };
}

export interface AuditEntry {
    id: string;
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    action: string;
    resource: string;
    resourceId: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

export interface CorrelationContext {
    correlationId: string;
    userId?: string;
    sessionId?: string;
    requestId: string;
    service: string;
    startTime: Date;
    metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
    timestamp: Date;
    service: string;
    endpoint: string;
    method: string;
    statusCode: number;
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

export interface BusinessMetrics {
    timestamp: Date;
    totalCarts: number;
    activeCarts: number;
    cartAbandonmentRate: number;
    averageCartValue: number;
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
    averageOrderValue: number;
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalProducts: number;
    activeProducts: number;
    outOfStockProducts: number;
}

export interface MonitoringConfig {
    healthChecks: {
        enabled: boolean;
        interval: number; // in seconds
        timeout: number; // in milliseconds
        retries: number;
    };
    metrics: {
        enabled: boolean;
        interval: number; // in seconds
        retention: number; // in days
        export: {
            prometheus: boolean;
            custom: boolean;
        };
    };
    logging: {
        enabled: boolean;
        level: LogLevel;
        format: 'json' | 'text';
        correlation: boolean;
        audit: boolean;
    };
    alerting: {
        enabled: boolean;
        channels: string[];
        escalation: boolean;
        cooldown: number; // in minutes
    };
}

export interface MonitoringDashboard {
    id: string;
    name: string;
    description: string;
    widgets: DashboardWidget[];
    layout: DashboardLayout;
    filters: DashboardFilter[];
    refreshInterval: number; // in seconds
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface DashboardWidget {
    id: string;
    type: 'chart' | 'metric' | 'table' | 'alert';
    title: string;
    query: string;
    config: Record<string, any>;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface DashboardLayout {
    columns: number;
    rows: number;
    gap: number;
}

export interface DashboardFilter {
    name: string;
    type: 'time' | 'service' | 'user' | 'custom';
    value: any;
    options?: any[];
}

export interface MonitoringReport {
    id: string;
    name: string;
    type: 'health' | 'performance' | 'business' | 'security';
    period: {
        start: Date;
        end: Date;
    };
    metrics: Record<string, any>;
    insights: string[];
    recommendations: string[];
    generatedAt: Date;
    generatedBy: string;
}

export interface CapacityPlanning {
    current: {
        cpu: number;
        memory: number;
        storage: number;
        network: number;
    };
    projected: {
        cpu: number;
        memory: number;
        storage: number;
        network: number;
    };
    recommendations: Array<{
        resource: string;
        action: 'scale_up' | 'scale_down' | 'optimize';
        priority: 'low' | 'medium' | 'high';
        description: string;
        impact: string;
    }>;
}

export interface ErrorTracking {
    id: string;
    error: {
        name: string;
        message: string;
        stack: string;
        code?: string;
    };
    context: {
        userId?: string;
        sessionId?: string;
        correlationId?: string;
        service: string;
        endpoint: string;
        method: string;
        timestamp: Date;
    };
    frequency: number;
    firstSeen: Date;
    lastSeen: Date;
    resolved: boolean;
    resolvedAt?: Date;
    metadata?: Record<string, any>;
}

export interface TracingSpan {
    id: string;
    traceId: string;
    parentId?: string;
    name: string;
    service: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'started' | 'completed' | 'error';
    tags: Record<string, string>;
    logs: Array<{
        timestamp: Date;
        message: string;
        level: LogLevel;
        metadata?: Record<string, any>;
    }>;
}

export interface DistributedTrace {
    id: string;
    service: string;
    operation: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    status: 'success' | 'error' | 'timeout';
    spans: TracingSpan[];
    metadata?: Record<string, any>;
}

export interface MonitoringAlert {
    id: string;
    name: string;
    description: string;
    severity: AlertSeverity;
    status: AlertStatus;
    source: string;
    metric: string;
    threshold: number;
    currentValue: number;
    triggeredAt: Date;
    resolvedAt?: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    metadata?: Record<string, any>;
}

export interface MonitoringStats {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
    activeAlerts: number;
    totalAlerts: number;
    resolvedAlerts: number;
    healthScore: number;
    performanceScore: number;
    businessScore: number;
}

export interface MonitoringTrend {
    timestamp: Date;
    requests: number;
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
    activeUsers: number;
    businessMetrics: BusinessMetrics;
}

export interface MonitoringIntegration {
    type: 'prometheus' | 'grafana' | 'datadog' | 'newrelic' | 'custom';
    config: Record<string, any>;
    enabled: boolean;
    lastSync?: Date;
    status: 'connected' | 'disconnected' | 'error';
}

export interface MonitoringQuery {
    id: string;
    name: string;
    query: string;
    type: 'promql' | 'sql' | 'custom';
    parameters: Record<string, any>;
    cache: boolean;
    cacheTtl: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface MonitoringUser {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'viewer' | 'editor';
    permissions: string[];
    preferences: Record<string, any>;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
}
