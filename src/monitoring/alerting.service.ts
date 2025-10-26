import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    Alert,
    AlertRule,
    AlertSeverity,
    AlertStatus,
    AlertEscalation,
    AlertNotification
} from '../types/monitoring.types';
import { MetricsService } from './metrics.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AlertingService {
    private readonly logger = new Logger(AlertingService.name);
    private alerts: Alert[] = [];
    private alertRules: AlertRule[] = [];
    private alertHistory: Array<{
        alertId: string;
        action: 'created' | 'resolved' | 'acknowledged' | 'escalated';
        timestamp: Date;
        userId?: string;
        message: string;
    }> = [];

    constructor(private readonly metricsService: MetricsService) {
        this.initializeDefaultRules();
    }

    /**
     * Create alert rule
     */
    createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
        const newRule: AlertRule = {
            id: uuidv4(),
            ...rule,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.alertRules.push(newRule);
        this.logger.log(`Alert rule created: ${newRule.name}`);
        return newRule;
    }

    /**
     * Update alert rule
     */
    updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
        const rule = this.alertRules.find(r => r.id === ruleId);
        if (!rule) {
            return false;
        }

        Object.assign(rule, updates, { updatedAt: new Date() });
        this.logger.log(`Alert rule updated: ${rule.name}`);
        return true;
    }

    /**
     * Delete alert rule
     */
    deleteAlertRule(ruleId: string): boolean {
        const index = this.alertRules.findIndex(r => r.id === ruleId);
        if (index === -1) {
            return false;
        }

        this.alertRules.splice(index, 1);
        this.logger.log(`Alert rule deleted: ${ruleId}`);
        return true;
    }

    /**
     * Get all alert rules
     */
    getAlertRules(): AlertRule[] {
        return [...this.alertRules];
    }

    /**
     * Get alert rule by ID
     */
    getAlertRule(ruleId: string): AlertRule | undefined {
        return this.alertRules.find(r => r.id === ruleId);
    }

    /**
     * Get all alerts
     */
    getAlerts(limit: number = 100): Alert[] {
        return this.alerts
            .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
            .slice(0, limit);
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(): Alert[] {
        return this.alerts.filter(alert => alert.status === AlertStatus.ACTIVE);
    }

    /**
     * Get alerts by severity
     */
    getAlertsBySeverity(severity: AlertSeverity): Alert[] {
        return this.alerts.filter(alert => alert.severity === severity);
    }

    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string, userId: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            return false;
        }

        alert.status = AlertStatus.ACKNOWLEDGED;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = userId;

        this.alertHistory.push({
            alertId,
            action: 'acknowledged',
            timestamp: new Date(),
            userId,
            message: `Alert acknowledged by ${userId}`
        });

        this.logger.log(`Alert acknowledged: ${alertId} by ${userId}`);
        return true;
    }

    /**
     * Resolve alert
     */
    resolveAlert(alertId: string, userId?: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            return false;
        }

        alert.status = AlertStatus.RESOLVED;
        alert.resolvedAt = new Date();

        this.alertHistory.push({
            alertId,
            action: 'resolved',
            timestamp: new Date(),
            userId,
            message: `Alert resolved${userId ? ` by ${userId}` : ''}`
        });

        this.logger.log(`Alert resolved: ${alertId}`);
        return true;
    }

    /**
     * Suppress alert
     */
    suppressAlert(alertId: string, userId: string, reason: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert) {
            return false;
        }

        alert.status = AlertStatus.SUPPRESSED;
        alert.metadata = {
            ...alert.metadata,
            suppressedBy: userId,
            suppressedAt: new Date(),
            suppressReason: reason
        };

        this.alertHistory.push({
            alertId,
            action: 'acknowledged',
            timestamp: new Date(),
            userId,
            message: `Alert suppressed by ${userId}: ${reason}`
        });

        this.logger.log(`Alert suppressed: ${alertId} by ${userId}`);
        return true;
    }

    /**
     * Get alert history
     */
    getAlertHistory(alertId?: string, limit: number = 100): Array<{
        alertId: string;
        action: 'created' | 'resolved' | 'acknowledged' | 'escalated';
        timestamp: Date;
        userId?: string;
        message: string;
    }> {
        let history = this.alertHistory;

        if (alertId) {
            history = history.filter(h => h.alertId === alertId);
        }

        return history
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get alert statistics
     */
    getAlertStatistics(): {
        totalAlerts: number;
        activeAlerts: number;
        resolvedAlerts: number;
        acknowledgedAlerts: number;
        suppressedAlerts: number;
        bySeverity: Record<AlertSeverity, number>;
        bySource: Record<string, number>;
        averageResolutionTime: number;
        escalationRate: number;
    } {
        const totalAlerts = this.alerts.length;
        const activeAlerts = this.alerts.filter(a => a.status === AlertStatus.ACTIVE).length;
        const resolvedAlerts = this.alerts.filter(a => a.status === AlertStatus.RESOLVED).length;
        const acknowledgedAlerts = this.alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED).length;
        const suppressedAlerts = this.alerts.filter(a => a.status === AlertStatus.SUPPRESSED).length;

        const bySeverity = this.alerts.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
        }, {} as Record<AlertSeverity, number>);

        const bySource = this.alerts.reduce((acc, alert) => {
            acc[alert.source] = (acc[alert.source] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const resolvedAlertsWithTime = this.alerts.filter(a =>
            a.status === AlertStatus.RESOLVED && a.resolvedAt && a.triggeredAt
        );

        const averageResolutionTime = resolvedAlertsWithTime.length > 0 ?
            resolvedAlertsWithTime.reduce((sum, alert) =>
                sum + (alert.resolvedAt!.getTime() - alert.triggeredAt.getTime()), 0
            ) / resolvedAlertsWithTime.length : 0;

        const escalationRate = this.alertHistory.filter(h => h.action === 'escalated').length /
            Math.max(totalAlerts, 1) * 100;

        return {
            totalAlerts,
            activeAlerts,
            resolvedAlerts,
            acknowledgedAlerts,
            suppressedAlerts,
            bySeverity,
            bySource,
            averageResolutionTime,
            escalationRate
        };
    }

    /**
     * Run alert evaluation (scheduled)
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async evaluateAlerts(): Promise<void> {
        try {
            this.logger.debug('Evaluating alert rules');

            for (const rule of this.alertRules) {
                if (!rule.enabled) continue;

                try {
                    await this.evaluateAlertRule(rule);
                } catch (error) {
                    this.logger.error(`Alert rule evaluation failed for ${rule.name}:`, error.message);
                }
            }

        } catch (error) {
            this.logger.error('Alert evaluation failed:', error.message);
        }
    }

    /**
     * Evaluate specific alert rule
     */
    private async evaluateAlertRule(rule: AlertRule): Promise<void> {
        try {
            // Get current metric value
            const currentValue = await this.getMetricValue(rule.metric);

            // Check if condition is met
            const conditionMet = this.evaluateCondition(rule.condition, currentValue, rule.threshold);

            if (conditionMet) {
                // Check if alert already exists and is active
                const existingAlert = this.alerts.find(a =>
                    a.source === rule.name &&
                    a.status === AlertStatus.ACTIVE &&
                    (Date.now() - a.triggeredAt.getTime()) < rule.cooldown * 60 * 1000
                );

                if (!existingAlert) {
                    await this.createAlert(rule, currentValue);
                }
            } else {
                // Resolve any existing alerts for this rule
                const existingAlerts = this.alerts.filter(a =>
                    a.source === rule.name &&
                    a.status === AlertStatus.ACTIVE
                );

                for (const alert of existingAlerts) {
                    await this.resolveAlert(alert.id);
                }
            }

        } catch (error) {
            this.logger.error(`Alert rule evaluation failed for ${rule.name}:`, error.message);
        }
    }

    /**
     * Create alert from rule
     */
    private async createAlert(rule: AlertRule, currentValue: number): Promise<void> {
        try {
            const alert: Alert = {
                id: uuidv4(),
                name: rule.name,
                description: rule.description,
                severity: rule.severity,
                status: AlertStatus.ACTIVE,
                source: rule.name,
                metric: rule.metric,
                threshold: rule.threshold,
                currentValue,
                triggeredAt: new Date(),
                metadata: {
                    ruleId: rule.id,
                    condition: rule.condition,
                    cooldown: rule.cooldown
                }
            };

            this.alerts.push(alert);

            this.alertHistory.push({
                alertId: alert.id,
                action: 'created',
                timestamp: new Date(),
                message: `Alert created: ${alert.name}`
            });

            // Send notifications
            await this.sendAlertNotifications(alert, rule);

            this.logger.warn(`Alert created: ${alert.name} (${alert.severity})`);

        } catch (error) {
            this.logger.error(`Alert creation failed for rule ${rule.name}:`, error.message);
        }
    }

    /**
     * Send alert notifications
     */
    private async sendAlertNotifications(alert: Alert, rule: AlertRule): Promise<void> {
        try {
            for (const notification of rule.notifications) {
                if (!notification.enabled) continue;

                await this.sendNotification(alert, notification);
            }

        } catch (error) {
            this.logger.error(`Alert notification failed for ${alert.id}:`, error.message);
        }
    }

    /**
     * Send notification
     */
    private async sendNotification(alert: Alert, notification: AlertNotification): Promise<void> {
        try {
            const message = this.formatNotificationMessage(alert, notification.template);

            switch (notification.type) {
                case 'email':
                    await this.sendEmailNotification(notification.endpoint, message);
                    break;
                case 'slack':
                    await this.sendSlackNotification(notification.endpoint, message);
                    break;
                case 'webhook':
                    await this.sendWebhookNotification(notification.endpoint, alert);
                    break;
                case 'sms':
                    await this.sendSmsNotification(notification.endpoint, message);
                    break;
                default:
                    this.logger.warn(`Unknown notification type: ${notification.type}`);
            }

        } catch (error) {
            this.logger.error(`Notification sending failed for ${alert.id}:`, error.message);
        }
    }

    /**
     * Get metric value
     */
    private async getMetricValue(metricName: string): Promise<number> {
        try {
            const metrics = this.metricsService.getMetricsByName(metricName);
            if (metrics.length === 0) {
                return 0;
            }

            // Get the latest metric value
            const latestMetric = metrics.sort((a, b) =>
                b.timestamp.getTime() - a.timestamp.getTime()
            )[0];

            return latestMetric.value;

        } catch (error) {
            this.logger.error(`Metric value retrieval failed for ${metricName}:`, error.message);
            return 0;
        }
    }

    /**
     * Evaluate condition
     */
    private evaluateCondition(condition: string, currentValue: number, threshold: number): boolean {
        switch (condition) {
            case 'greater_than':
                return currentValue > threshold;
            case 'less_than':
                return currentValue < threshold;
            case 'equals':
                return currentValue === threshold;
            case 'not_equals':
                return currentValue !== threshold;
            case 'greater_than_or_equal':
                return currentValue >= threshold;
            case 'less_than_or_equal':
                return currentValue <= threshold;
            default:
                this.logger.warn(`Unknown condition: ${condition}`);
                return false;
        }
    }

    /**
     * Format notification message
     */
    private formatNotificationMessage(alert: Alert, template: string): string {
        return template
            .replace('{alert_name}', alert.name)
            .replace('{alert_description}', alert.description)
            .replace('{severity}', alert.severity)
            .replace('{current_value}', alert.currentValue.toString())
            .replace('{threshold}', alert.threshold.toString())
            .replace('{triggered_at}', alert.triggeredAt.toISOString())
            .replace('{source}', alert.source);
    }

    /**
     * Send email notification
     */
    private async sendEmailNotification(endpoint: string, message: string): Promise<void> {
        // This would typically send email via email service
        this.logger.log(`Email notification sent to ${endpoint}: ${message}`);
    }

    /**
     * Send Slack notification
     */
    private async sendSlackNotification(endpoint: string, message: string): Promise<void> {
        // This would typically send to Slack webhook
        this.logger.log(`Slack notification sent to ${endpoint}: ${message}`);
    }

    /**
     * Send webhook notification
     */
    private async sendWebhookNotification(endpoint: string, alert: Alert): Promise<void> {
        // This would typically send HTTP POST to webhook
        this.logger.log(`Webhook notification sent to ${endpoint}: ${alert.name}`);
    }

    /**
     * Send SMS notification
     */
    private async sendSmsNotification(endpoint: string, message: string): Promise<void> {
        // This would typically send SMS via SMS service
        this.logger.log(`SMS notification sent to ${endpoint}: ${message}`);
    }

    /**
     * Initialize default alert rules
     */
    private initializeDefaultRules(): void {
        // High error rate alert
        this.createAlertRule({
            name: 'high_error_rate',
            description: 'High error rate detected',
            metric: 'error_rate',
            condition: 'greater_than',
            threshold: 5,
            severity: AlertSeverity.HIGH,
            enabled: true,
            cooldown: 5,
            escalation: {
                levels: [
                    {
                        level: 1,
                        delay: 0,
                        recipients: ['admin@example.com'],
                        channels: ['email']
                    },
                    {
                        level: 2,
                        delay: 15,
                        recipients: ['oncall@example.com'],
                        channels: ['email', 'slack']
                    }
                ]
            },
            notifications: [
                {
                    type: 'email',
                    endpoint: 'admin@example.com',
                    template: 'Alert: {alert_name} - {alert_description}. Current value: {current_value}%, Threshold: {threshold}%',
                    enabled: true
                },
                {
                    type: 'slack',
                    endpoint: 'https://hooks.slack.com/services/...',
                    template: '🚨 {alert_name}: {alert_description}',
                    enabled: true
                }
            ]
        });

        // High response time alert
        this.createAlertRule({
            name: 'high_response_time',
            description: 'High response time detected',
            metric: 'response_time',
            condition: 'greater_than',
            threshold: 2000,
            severity: AlertSeverity.MEDIUM,
            enabled: true,
            cooldown: 10,
            escalation: {
                levels: [
                    {
                        level: 1,
                        delay: 0,
                        recipients: ['admin@example.com'],
                        channels: ['email']
                    }
                ]
            },
            notifications: [
                {
                    type: 'email',
                    endpoint: 'admin@example.com',
                    template: 'Alert: {alert_name} - {alert_description}. Current value: {current_value}ms, Threshold: {threshold}ms',
                    enabled: true
                }
            ]
        });

        // High memory usage alert
        this.createAlertRule({
            name: 'high_memory_usage',
            description: 'High memory usage detected',
            metric: 'memory_usage',
            condition: 'greater_than',
            threshold: 80,
            severity: AlertSeverity.HIGH,
            enabled: true,
            cooldown: 5,
            escalation: {
                levels: [
                    {
                        level: 1,
                        delay: 0,
                        recipients: ['admin@example.com'],
                        channels: ['email']
                    }
                ]
            },
            notifications: [
                {
                    type: 'email',
                    endpoint: 'admin@example.com',
                    template: 'Alert: {alert_name} - {alert_description}. Current value: {current_value}%, Threshold: {threshold}%',
                    enabled: true
                }
            ]
        });

        // Low cache hit rate alert
        this.createAlertRule({
            name: 'low_cache_hit_rate',
            description: 'Low cache hit rate detected',
            metric: 'cache_hit_rate',
            condition: 'less_than',
            threshold: 70,
            severity: AlertSeverity.MEDIUM,
            enabled: true,
            cooldown: 15,
            escalation: {
                levels: [
                    {
                        level: 1,
                        delay: 0,
                        recipients: ['admin@example.com'],
                        channels: ['email']
                    }
                ]
            },
            notifications: [
                {
                    type: 'email',
                    endpoint: 'admin@example.com',
                    template: 'Alert: {alert_name} - {alert_description}. Current value: {current_value}%, Threshold: {threshold}%',
                    enabled: true
                }
            ]
        });
    }
}
