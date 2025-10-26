import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import {
    LogEntry,
    LogLevel as CustomLogLevel,
    CorrelationContext
} from '../types/monitoring.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggerService implements LoggerService {
    private readonly context = 'LoggerService';
    private logs: LogEntry[] = [];
    private correlationContext: CorrelationContext | null = null;

    /**
     * Set correlation context
     */
    setCorrelationContext(context: CorrelationContext): void {
        this.correlationContext = context;
    }

    /**
     * Clear correlation context
     */
    clearCorrelationContext(): void {
        this.correlationContext = null;
    }

    /**
     * Get correlation context
     */
    getCorrelationContext(): CorrelationContext | null {
        return this.correlationContext;
    }

    /**
     * Log message
     */
    log(message: string, context?: string): void {
        this.createLogEntry(CustomLogLevel.INFO, message, context);
    }

    /**
     * Log error
     */
    error(message: string, trace?: string, context?: string): void {
        this.createLogEntry(CustomLogLevel.ERROR, message, context, {
            name: 'Error',
            message: trace || message,
            stack: trace
        });
    }

    /**
     * Log warning
     */
    warn(message: string, context?: string): void {
        this.createLogEntry(CustomLogLevel.WARN, message, context);
    }

    /**
     * Log debug
     */
    debug(message: string, context?: string): void {
        this.createLogEntry(CustomLogLevel.DEBUG, message, context);
    }

    /**
     * Log verbose
     */
    verbose(message: string, context?: string): void {
        this.createLogEntry(CustomLogLevel.DEBUG, message, context);
    }

    /**
     * Log fatal
     */
    fatal(message: string, context?: string): void {
        this.createLogEntry(CustomLogLevel.FATAL, message, context);
    }

    /**
     * Log with custom level
     */
    logWithLevel(level: CustomLogLevel, message: string, context?: string, metadata?: Record<string, any>): void {
        this.createLogEntry(level, message, context, undefined, metadata);
    }

    /**
     * Log API request
     */
    logApiRequest(
        method: string,
        url: string,
        statusCode: number,
        duration: number,
        userId?: string,
        sessionId?: string
    ): void {
        this.createLogEntry(CustomLogLevel.INFO, `API Request: ${method} ${url}`, 'API', undefined, {
            method,
            url,
            statusCode,
            duration,
            userId,
            sessionId
        });
    }

    /**
     * Log API error
     */
    logApiError(
        method: string,
        url: string,
        statusCode: number,
        error: Error,
        userId?: string,
        sessionId?: string
    ): void {
        this.createLogEntry(CustomLogLevel.ERROR, `API Error: ${method} ${url}`, 'API', {
            name: error.name,
            message: error.message,
            stack: error.stack
        }, {
            method,
            url,
            statusCode,
            userId,
            sessionId
        });
    }

    /**
     * Log database operation
     */
    logDatabaseOperation(
        operation: string,
        table: string,
        duration: number,
        success: boolean,
        error?: Error
    ): void {
        const level = success ? CustomLogLevel.INFO : CustomLogLevel.ERROR;
        const message = `Database ${operation} on ${table}`;

        this.createLogEntry(level, message, 'Database', error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : undefined, {
            operation,
            table,
            duration,
            success
        });
    }

    /**
     * Log cache operation
     */
    logCacheOperation(
        operation: string,
        key: string,
        hit: boolean,
        duration: number,
        error?: Error
    ): void {
        const level = error ? CustomLogLevel.ERROR : CustomLogLevel.DEBUG;
        const message = `Cache ${operation} for key: ${key}`;

        this.createLogEntry(level, message, 'Cache', error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : undefined, {
            operation,
            key,
            hit,
            duration
        });
    }

    /**
     * Log business operation
     */
    logBusinessOperation(
        operation: string,
        resource: string,
        resourceId: string,
        userId?: string,
        sessionId?: string,
        metadata?: Record<string, any>
    ): void {
        this.createLogEntry(CustomLogLevel.INFO, `Business ${operation}: ${resource}`, 'Business', undefined, {
            operation,
            resource,
            resourceId,
            userId,
            sessionId,
            ...metadata
        });
    }

    /**
     * Log performance metrics
     */
    logPerformanceMetrics(
        service: string,
        endpoint: string,
        responseTime: number,
        memoryUsage: number,
        cpuUsage: number
    ): void {
        this.createLogEntry(CustomLogLevel.INFO, `Performance metrics for ${service}`, 'Performance', undefined, {
            service,
            endpoint,
            responseTime,
            memoryUsage,
            cpuUsage
        });
    }

    /**
     * Log security event
     */
    logSecurityEvent(
        event: string,
        userId?: string,
        ipAddress?: string,
        userAgent?: string,
        metadata?: Record<string, any>
    ): void {
        this.createLogEntry(CustomLogLevel.WARN, `Security event: ${event}`, 'Security', undefined, {
            event,
            userId,
            ipAddress,
            userAgent,
            ...metadata
        });
    }

    /**
     * Get logs
     */
    getLogs(
        level?: CustomLogLevel,
        service?: string,
        userId?: string,
        sessionId?: string,
        limit: number = 100
    ): LogEntry[] {
        let filteredLogs = this.logs;

        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }

        if (service) {
            filteredLogs = filteredLogs.filter(log => log.service === service);
        }

        if (userId) {
            filteredLogs = filteredLogs.filter(log => log.userId === userId);
        }

        if (sessionId) {
            filteredLogs = filteredLogs.filter(log => log.sessionId === sessionId);
        }

        return filteredLogs
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get logs by correlation ID
     */
    getLogsByCorrelationId(correlationId: string): LogEntry[] {
        return this.logs
            .filter(log => log.correlationId === correlationId)
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    /**
     * Get log statistics
     */
    getLogStatistics(): {
        totalLogs: number;
        byLevel: Record<CustomLogLevel, number>;
        byService: Record<string, number>;
        byUser: Record<string, number>;
        errorRate: number;
        averageLogsPerHour: number;
    } {
        const totalLogs = this.logs.length;

        const byLevel = this.logs.reduce((acc, log) => {
            acc[log.level] = (acc[log.level] || 0) + 1;
            return acc;
        }, {} as Record<CustomLogLevel, number>);

        const byService = this.logs.reduce((acc, log) => {
            acc[log.service] = (acc[log.service] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byUser = this.logs.reduce((acc, log) => {
            if (log.userId) {
                acc[log.userId] = (acc[log.userId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const errorLogs = this.logs.filter(log => log.level === CustomLogLevel.ERROR).length;
        const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;

        // Calculate average logs per hour (last 24 hours)
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLogs = this.logs.filter(log => log.timestamp > last24Hours);
        const averageLogsPerHour = recentLogs.length / 24;

        return {
            totalLogs,
            byLevel,
            byService,
            byUser,
            errorRate,
            averageLogsPerHour
        };
    }

    /**
     * Clear old logs
     */
    clearOldLogs(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
        const cutoffTime = new Date(Date.now() - maxAge);
        const oldLogsCount = this.logs.length;

        this.logs = this.logs.filter(log => log.timestamp > cutoffTime);

        const removedCount = oldLogsCount - this.logs.length;
        this.log('info', `Cleared ${removedCount} old logs`);
    }

    /**
     * Export logs
     */
    exportLogs(
        format: 'json' | 'csv' = 'json',
        filters?: {
            level?: CustomLogLevel;
            service?: string;
            userId?: string;
            sessionId?: string;
            startDate?: Date;
            endDate?: Date;
        }
    ): string {
        let filteredLogs = this.logs;

        if (filters) {
            if (filters.level) {
                filteredLogs = filteredLogs.filter(log => log.level === filters.level);
            }
            if (filters.service) {
                filteredLogs = filteredLogs.filter(log => log.service === filters.service);
            }
            if (filters.userId) {
                filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
            }
            if (filters.sessionId) {
                filteredLogs = filteredLogs.filter(log => log.sessionId === filters.sessionId);
            }
            if (filters.startDate) {
                filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
            }
            if (filters.endDate) {
                filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
            }
        }

        if (format === 'json') {
            return JSON.stringify(filteredLogs, null, 2);
        } else if (format === 'csv') {
            const headers = ['id', 'timestamp', 'level', 'message', 'service', 'userId', 'sessionId', 'correlationId'];
            const csvRows = [headers.join(',')];

            filteredLogs.forEach(log => {
                const row = [
                    log.id,
                    log.timestamp.toISOString(),
                    log.level,
                    `"${log.message.replace(/"/g, '""')}"`,
                    log.service,
                    log.userId || '',
                    log.sessionId || '',
                    log.correlationId || ''
                ];
                csvRows.push(row.join(','));
            });

            return csvRows.join('\n');
        }

        return '';
    }

    /**
     * Create log entry
     */
    private createLogEntry(
        level: CustomLogLevel,
        message: string,
        service: string = this.context,
        error?: {
            name: string;
            message: string;
            stack?: string;
            code?: string;
        },
        metadata?: Record<string, any>
    ): void {
        const logEntry: LogEntry = {
            id: uuidv4(),
            timestamp: new Date(),
            level,
            message,
            correlationId: this.correlationContext?.correlationId,
            userId: this.correlationContext?.userId,
            sessionId: this.correlationContext?.sessionId,
            service,
            metadata: {
                ...this.correlationContext?.metadata,
                ...metadata
            }
        };

        if (error) {
            logEntry.error = error;
        }

        this.logs.push(logEntry);

        // Keep only last 10000 entries
        if (this.logs.length > 10000) {
            this.logs = this.logs.slice(-10000);
        }

        // Also log to console for development
        if (process.env.NODE_ENV === 'development') {
            const consoleMessage = `[${level.toUpperCase()}] ${service}: ${message}`;
            switch (level) {
                case CustomLogLevel.ERROR:
                case CustomLogLevel.FATAL:
                    console.error(consoleMessage, error);
                    break;
                case CustomLogLevel.WARN:
                    console.warn(consoleMessage);
                    break;
                case CustomLogLevel.DEBUG:
                    console.debug(consoleMessage);
                    break;
                default:
                    console.log(consoleMessage);
            }
        }
    }
}
