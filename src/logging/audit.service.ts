import { Injectable, Logger } from '@nestjs/common';
import { AuditEntry } from '../types/monitoring.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);
    private auditEntries: AuditEntry[] = [];

    /**
     * Log audit entry
     */
    logAuditEntry(
        action: string,
        resource: string,
        resourceId: string,
        userId?: string,
        sessionId?: string,
        changes?: Record<string, any>,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        try {
            const auditEntry: AuditEntry = {
                id: uuidv4(),
                timestamp: new Date(),
                userId,
                sessionId,
                action,
                resource,
                resourceId,
                changes,
                metadata,
                ipAddress,
                userAgent
            };

            this.auditEntries.push(auditEntry);

            // Keep only last 50000 entries
            if (this.auditEntries.length > 50000) {
                this.auditEntries = this.auditEntries.slice(-50000);
            }

            this.logger.debug(`Audit entry logged: ${action} on ${resource}:${resourceId}`);

        } catch (error) {
            this.logger.error('Audit entry logging failed:', error.message);
        }
    }

    /**
     * Log user authentication
     */
    logUserAuthentication(
        userId: string,
        action: 'login' | 'logout' | 'token_refresh' | 'password_change',
        success: boolean,
        ipAddress?: string,
        userAgent?: string,
        metadata?: Record<string, any>
    ): void {
        this.logAuditEntry(
            `user_${action}`,
            'user',
            userId,
            userId,
            undefined,
            { success },
            {
                ...metadata,
                authentication: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log cart operations
     */
    logCartOperation(
        action: 'create' | 'update' | 'delete' | 'clear' | 'merge',
        cartId: string,
        userId?: string,
        sessionId?: string,
        changes?: Record<string, any>,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `cart_${action}`,
            'cart',
            cartId,
            userId,
            sessionId,
            changes,
            {
                ...metadata,
                cartOperation: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log cart item operations
     */
    logCartItemOperation(
        action: 'add' | 'update' | 'remove',
        cartId: string,
        itemId: string,
        productId: string,
        quantity: number,
        userId?: string,
        sessionId?: string,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `cart_item_${action}`,
            'cart_item',
            itemId,
            userId,
            sessionId,
            {
                cartId,
                productId,
                quantity,
                action
            },
            {
                ...metadata,
                cartItemOperation: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log order operations
     */
    logOrderOperation(
        action: 'create' | 'update' | 'cancel' | 'refund',
        orderId: string,
        userId?: string,
        sessionId?: string,
        changes?: Record<string, any>,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `order_${action}`,
            'order',
            orderId,
            userId,
            sessionId,
            changes,
            {
                ...metadata,
                orderOperation: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log payment operations
     */
    logPaymentOperation(
        action: 'process' | 'refund' | 'chargeback',
        paymentId: string,
        orderId: string,
        amount: number,
        currency: string,
        userId?: string,
        sessionId?: string,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `payment_${action}`,
            'payment',
            paymentId,
            userId,
            sessionId,
            {
                orderId,
                amount,
                currency,
                action
            },
            {
                ...metadata,
                paymentOperation: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log data access
     */
    logDataAccess(
        action: 'read' | 'export' | 'backup',
        resource: string,
        resourceId: string,
        userId?: string,
        sessionId?: string,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `data_${action}`,
            resource,
            resourceId,
            userId,
            sessionId,
            undefined,
            {
                ...metadata,
                dataAccess: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log configuration changes
     */
    logConfigurationChange(
        action: 'create' | 'update' | 'delete',
        configType: string,
        configId: string,
        userId?: string,
        sessionId?: string,
        changes?: Record<string, any>,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `config_${action}`,
            'configuration',
            configId,
            userId,
            sessionId,
            {
                configType,
                changes
            },
            {
                ...metadata,
                configurationChange: true
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Log security events
     */
    logSecurityEvent(
        event: 'unauthorized_access' | 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_token',
        userId?: string,
        sessionId?: string,
        metadata?: Record<string, any>,
        ipAddress?: string,
        userAgent?: string
    ): void {
        this.logAuditEntry(
            `security_${event}`,
            'security',
            'system',
            userId,
            sessionId,
            undefined,
            {
                ...metadata,
                securityEvent: true,
                severity: this.getSecurityEventSeverity(event)
            },
            ipAddress,
            userAgent
        );
    }

    /**
     * Get audit entries
     */
    getAuditEntries(
        userId?: string,
        resource?: string,
        action?: string,
        startDate?: Date,
        endDate?: Date,
        limit: number = 100
    ): AuditEntry[] {
        let filteredEntries = this.auditEntries;

        if (userId) {
            filteredEntries = filteredEntries.filter(entry => entry.userId === userId);
        }

        if (resource) {
            filteredEntries = filteredEntries.filter(entry => entry.resource === resource);
        }

        if (action) {
            filteredEntries = filteredEntries.filter(entry => entry.action === action);
        }

        if (startDate) {
            filteredEntries = filteredEntries.filter(entry => entry.timestamp >= startDate);
        }

        if (endDate) {
            filteredEntries = filteredEntries.filter(entry => entry.timestamp <= endDate);
        }

        return filteredEntries
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get audit entries by user
     */
    getAuditEntriesByUser(
        userId: string,
        limit: number = 100
    ): AuditEntry[] {
        return this.auditEntries
            .filter(entry => entry.userId === userId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get audit entries by resource
     */
    getAuditEntriesByResource(
        resource: string,
        resourceId: string,
        limit: number = 100
    ): AuditEntry[] {
        return this.auditEntries
            .filter(entry => entry.resource === resource && entry.resourceId === resourceId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get audit statistics
     */
    getAuditStatistics(): {
        totalEntries: number;
        byAction: Record<string, number>;
        byResource: Record<string, number>;
        byUser: Record<string, number>;
        securityEvents: number;
        dataAccessEvents: number;
        configurationChanges: number;
        averageEntriesPerDay: number;
    } {
        const totalEntries = this.auditEntries.length;

        const byAction = this.auditEntries.reduce((acc, entry) => {
            acc[entry.action] = (acc[entry.action] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byResource = this.auditEntries.reduce((acc, entry) => {
            acc[entry.resource] = (acc[entry.resource] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byUser = this.auditEntries.reduce((acc, entry) => {
            if (entry.userId) {
                acc[entry.userId] = (acc[entry.userId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const securityEvents = this.auditEntries.filter(entry =>
            entry.metadata?.securityEvent
        ).length;

        const dataAccessEvents = this.auditEntries.filter(entry =>
            entry.metadata?.dataAccess
        ).length;

        const configurationChanges = this.auditEntries.filter(entry =>
            entry.metadata?.configurationChange
        ).length;

        // Calculate average entries per day (last 30 days)
        const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentEntries = this.auditEntries.filter(entry => entry.timestamp > last30Days);
        const averageEntriesPerDay = recentEntries.length / 30;

        return {
            totalEntries,
            byAction,
            byResource,
            byUser,
            securityEvents,
            dataAccessEvents,
            configurationChanges,
            averageEntriesPerDay
        };
    }

    /**
     * Get audit trail for specific resource
     */
    getAuditTrail(resource: string, resourceId: string): AuditEntry[] {
        return this.auditEntries
            .filter(entry => entry.resource === resource && entry.resourceId === resourceId)
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    /**
     * Clear old audit entries
     */
    clearOldAuditEntries(maxAge: number = 90 * 24 * 60 * 60 * 1000): void {
        const cutoffTime = new Date(Date.now() - maxAge);
        const oldEntriesCount = this.auditEntries.length;

        this.auditEntries = this.auditEntries.filter(entry => entry.timestamp > cutoffTime);

        const removedCount = oldEntriesCount - this.auditEntries.length;
        this.logger.log(`Cleared ${removedCount} old audit entries`);
    }

    /**
     * Export audit entries
     */
    exportAuditEntries(
        format: 'json' | 'csv' = 'json',
        filters?: {
            userId?: string;
            resource?: string;
            action?: string;
            startDate?: Date;
            endDate?: Date;
        }
    ): string {
        const entries = this.getAuditEntries(
            filters?.userId,
            filters?.resource,
            filters?.action,
            filters?.startDate,
            filters?.endDate,
            10000 // Large limit for export
        );

        if (format === 'json') {
            return JSON.stringify(entries, null, 2);
        } else if (format === 'csv') {
            const headers = [
                'id', 'timestamp', 'userId', 'sessionId', 'action', 'resource',
                'resourceId', 'ipAddress', 'userAgent'
            ];
            const csvRows = [headers.join(',')];

            entries.forEach(entry => {
                const row = [
                    entry.id,
                    entry.timestamp.toISOString(),
                    entry.userId || '',
                    entry.sessionId || '',
                    entry.action,
                    entry.resource,
                    entry.resourceId,
                    entry.ipAddress || '',
                    entry.userAgent || ''
                ];
                csvRows.push(row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','));
            });

            return csvRows.join('\n');
        }

        return '';
    }

    /**
     * Get security event severity
     */
    private getSecurityEventSeverity(event: string): 'low' | 'medium' | 'high' | 'critical' {
        switch (event) {
            case 'unauthorized_access':
            case 'suspicious_activity':
                return 'high';
            case 'rate_limit_exceeded':
                return 'medium';
            case 'invalid_token':
                return 'low';
            default:
                return 'medium';
        }
    }
}
