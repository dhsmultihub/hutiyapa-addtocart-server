import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
    Session,
    SessionType,
    SessionStatus,
    SessionContext,
    CreateSessionRequest,
    SessionResponse,
    SessionListResponse,
    SessionSearchFilters,
    SessionAnalytics,
    SessionValidationResult,
    SessionError,
    DeviceInfo,
    DeviceType
} from '../types/session.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(private readonly databaseService: DatabaseService) { }

    /**
     * Create a new session
     */
    async createSession(request: CreateSessionRequest): Promise<SessionResponse> {
        try {
            this.logger.log(`Creating session for user: ${request.userId || 'guest'}`);

            // Validate request
            const validation = await this.validateSessionRequest(request);
            if (!validation.isValid) {
                throw new BadRequestException(`Invalid session request: ${validation.errors.map(e => e.message).join(', ')}`);
            }

            const sessionToken = this.generateSessionToken();
            const sessionId = uuidv4();
            const now = new Date();
            const expiresAt = new Date(now.getTime() + (request.duration || 24 * 60) * 60 * 1000); // Default 24 hours

            const session: Session = {
                id: sessionId,
                sessionToken,
                userId: request.userId,
                type: request.sessionType || (request.userId ? SessionType.AUTHENTICATED : SessionType.GUEST),
                status: SessionStatus.ACTIVE,
                deviceInfo: request.deviceInfo,
                lastActivity: now,
                expiresAt,
                createdAt: now,
                updatedAt: now,
                metadata: request.metadata
            };

            // Save to database
            await this.databaseService.session.create({
                data: {
                    id: session.id,
                    sessionToken: session.sessionToken,
                    userId: session.userId,
                    type: session.type,
                    status: session.status,
                    deviceInfo: session.deviceInfo,
                    lastActivity: session.lastActivity,
                    expiresAt: session.expiresAt,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt,
                    metadata: session.metadata
                }
            });

            this.logger.log(`Session created: ${sessionId} (${session.type})`);
            return this.mapSessionToResponse(session);

        } catch (error) {
            this.logger.error('Session creation failed:', error.message);
            throw new BadRequestException(`Session creation failed: ${error.message}`);
        }
    }

    /**
     * Get session by ID
     */
    async getSessionById(sessionId: string): Promise<SessionResponse> {
        try {
            const session = await this.databaseService.session.findUnique({
                where: { id: sessionId }
            });

            if (!session) {
                throw new NotFoundException(`Session with ID ${sessionId} not found`);
            }

            return this.mapSessionToResponse(session as Session);

        } catch (error) {
            this.logger.error('Session retrieval failed:', error.message);
            throw error;
        }
    }

    /**
     * Get session by token
     */
    async getSessionByToken(sessionToken: string): Promise<SessionResponse | null> {
        try {
            const session = await this.databaseService.session.findUnique({
                where: { sessionToken }
            });

            if (!session) {
                return null;
            }

            // Check if session is expired
            if (session.expiresAt < new Date()) {
                await this.expireSession(session.id);
                return null;
            }

            return this.mapSessionToResponse(session as Session);

        } catch (error) {
            this.logger.error('Session retrieval by token failed:', error.message);
            return null;
        }
    }

    /**
     * Get session context for request
     */
    async getSessionContext(sessionToken: string): Promise<SessionContext | null> {
        try {
            const session = await this.getSessionByToken(sessionToken);

            if (!session) {
                return null;
            }

            return {
                sessionId: session.sessionId,
                sessionToken: session.sessionToken,
                userId: session.userId,
                deviceId: session.deviceInfo.deviceId,
                isAuthenticated: session.type === SessionType.AUTHENTICATED,
                lastActivity: session.lastActivity,
                expiresAt: session.expiresAt
            };

        } catch (error) {
            this.logger.error('Session context retrieval failed:', error.message);
            return null;
        }
    }

    /**
     * Update session activity
     */
    async updateSessionActivity(sessionId: string): Promise<void> {
        try {
            await this.databaseService.session.update({
                where: { id: sessionId },
                data: {
                    lastActivity: new Date(),
                    updatedAt: new Date()
                }
            });

        } catch (error) {
            this.logger.error('Session activity update failed:', error.message);
        }
    }

    /**
     * Extend session expiration
     */
    async extendSession(sessionId: string, durationMinutes: number = 60): Promise<SessionResponse> {
        try {
            const session = await this.databaseService.session.findUnique({
                where: { id: sessionId }
            });

            if (!session) {
                throw new NotFoundException(`Session with ID ${sessionId} not found`);
            }

            const newExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

            const updatedSession = await this.databaseService.session.update({
                where: { id: sessionId },
                data: {
                    expiresAt: newExpiresAt,
                    updatedAt: new Date()
                }
            });

            this.logger.log(`Session extended: ${sessionId} until ${newExpiresAt}`);
            return this.mapSessionToResponse(updatedSession as Session);

        } catch (error) {
            this.logger.error('Session extension failed:', error.message);
            throw new BadRequestException(`Session extension failed: ${error.message}`);
        }
    }

    /**
     * Expire session
     */
    async expireSession(sessionId: string): Promise<void> {
        try {
            await this.databaseService.session.update({
                where: { id: sessionId },
                data: {
                    status: SessionStatus.EXPIRED,
                    updatedAt: new Date()
                }
            });

            this.logger.log(`Session expired: ${sessionId}`);

        } catch (error) {
            this.logger.error('Session expiration failed:', error.message);
        }
    }

    /**
     * Terminate session
     */
    async terminateSession(sessionId: string): Promise<void> {
        try {
            await this.databaseService.session.update({
                where: { id: sessionId },
                data: {
                    status: SessionStatus.TERMINATED,
                    updatedAt: new Date()
                }
            });

            this.logger.log(`Session terminated: ${sessionId}`);

        } catch (error) {
            this.logger.error('Session termination failed:', error.message);
        }
    }

    /**
     * Get user sessions
     */
    async getUserSessions(userId: string, filters: SessionSearchFilters = {}): Promise<SessionListResponse> {
        try {
            const { page = 1, limit = 10, sortBy = 'lastActivity', sortOrder = 'desc' } = filters;
            const skip = (page - 1) * limit;

            const where: any = { userId };

            if (filters.type) {
                where.type = filters.type;
            }

            if (filters.status) {
                where.status = filters.status;
            }

            if (filters.deviceType) {
                where.deviceInfo = {
                    path: ['deviceType'],
                    equals: filters.deviceType
                };
            }

            if (filters.dateFrom || filters.dateTo) {
                where.lastActivity = {};
                if (filters.dateFrom) where.lastActivity.gte = filters.dateFrom;
                if (filters.dateTo) where.lastActivity.lte = filters.dateTo;
            }

            const [sessions, total] = await Promise.all([
                this.databaseService.session.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder }
                }),
                this.databaseService.session.count({ where })
            ]);

            return {
                sessions: sessions.map(session => this.mapSessionToResponse(session as Session)),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            this.logger.error('User sessions retrieval failed:', error.message);
            throw new BadRequestException(`User sessions retrieval failed: ${error.message}`);
        }
    }

    /**
     * Search sessions
     */
    async searchSessions(filters: SessionSearchFilters): Promise<SessionListResponse> {
        try {
            const { page = 1, limit = 10, sortBy = 'lastActivity', sortOrder = 'desc' } = filters;
            const skip = (page - 1) * limit;

            const where: any = {};

            if (filters.userId) {
                where.userId = filters.userId;
            }

            if (filters.type) {
                where.type = filters.type;
            }

            if (filters.status) {
                where.status = filters.status;
            }

            if (filters.deviceType) {
                where.deviceInfo = {
                    path: ['deviceType'],
                    equals: filters.deviceType
                };
            }

            if (filters.dateFrom || filters.dateTo) {
                where.lastActivity = {};
                if (filters.dateFrom) where.lastActivity.gte = filters.dateFrom;
                if (filters.dateTo) where.lastActivity.lte = filters.dateTo;
            }

            const [sessions, total] = await Promise.all([
                this.databaseService.session.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder }
                }),
                this.databaseService.session.count({ where })
            ]);

            return {
                sessions: sessions.map(session => this.mapSessionToResponse(session as Session)),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            };

        } catch (error) {
            this.logger.error('Session search failed:', error.message);
            throw new BadRequestException(`Session search failed: ${error.message}`);
        }
    }

    /**
     * Get session analytics
     */
    async getSessionAnalytics(dateFrom?: Date, dateTo?: Date): Promise<SessionAnalytics> {
        try {
            const where: any = {};

            if (dateFrom || dateTo) {
                where.createdAt = {};
                if (dateFrom) where.createdAt.gte = dateFrom;
                if (dateTo) where.createdAt.lte = dateTo;
            }

            const [
                totalSessions,
                activeSessions,
                sessionsByType,
                sessionsByDevice,
                averageDuration
            ] = await Promise.all([
                this.databaseService.session.count({ where }),
                this.databaseService.session.count({
                    where: { ...where, status: SessionStatus.ACTIVE }
                }),
                this.databaseService.session.groupBy({
                    by: ['type'],
                    where,
                    _count: { type: true }
                }),
                this.databaseService.session.groupBy({
                    by: ['deviceInfo'],
                    where,
                    _count: { deviceInfo: true }
                }),
                this.databaseService.session.aggregate({
                    where,
                    _avg: {
                        lastActivity: true
                    }
                })
            ]);

            return {
                totalSessions,
                activeSessions,
                sessionsByType: this.mapGroupByToRecord(sessionsByType, 'type'),
                sessionsByDevice: this.mapGroupByToRecord(sessionsByDevice, 'deviceInfo'),
                averageSessionDuration: averageDuration._avg.lastActivity || 0,
                cartRecoveryRate: 0, // Would be calculated from cart recovery data
                syncSuccessRate: 0, // Would be calculated from sync data
                topCountries: [], // Would be calculated from location data
                sessionTrends: [] // Would be calculated from time series data
            };

        } catch (error) {
            this.logger.error('Session analytics retrieval failed:', error.message);
            throw new BadRequestException(`Session analytics retrieval failed: ${error.message}`);
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions(): Promise<number> {
        try {
            const expiredSessions = await this.databaseService.session.findMany({
                where: {
                    expiresAt: { lt: new Date() },
                    status: SessionStatus.ACTIVE
                }
            });

            let cleanedCount = 0;
            for (const session of expiredSessions) {
                await this.expireSession(session.id);
                cleanedCount++;
            }

            this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
            return cleanedCount;

        } catch (error) {
            this.logger.error('Session cleanup failed:', error.message);
            return 0;
        }
    }

    /**
     * Migrate guest session to user session
     */
    async migrateGuestToUser(guestSessionId: string, userId: string): Promise<SessionResponse> {
        try {
            const guestSession = await this.databaseService.session.findUnique({
                where: { id: guestSessionId }
            });

            if (!guestSession) {
                throw new NotFoundException(`Guest session with ID ${guestSessionId} not found`);
            }

            if (guestSession.type !== SessionType.GUEST) {
                throw new BadRequestException('Session is not a guest session');
            }

            // Update session to authenticated
            const updatedSession = await this.databaseService.session.update({
                where: { id: guestSessionId },
                data: {
                    userId,
                    type: SessionType.AUTHENTICATED,
                    updatedAt: new Date()
                }
            });

            this.logger.log(`Guest session migrated to user: ${guestSessionId} -> ${userId}`);
            return this.mapSessionToResponse(updatedSession as Session);

        } catch (error) {
            this.logger.error('Guest session migration failed:', error.message);
            throw new BadRequestException(`Guest session migration failed: ${error.message}`);
        }
    }

    /**
     * Validate session request
     */
    private async validateSessionRequest(request: CreateSessionRequest): Promise<SessionValidationResult> {
        const errors: SessionError[] = [];
        const warnings: string[] = [];

        // Validate device info
        if (!request.deviceInfo) {
            errors.push({
                code: 'MISSING_DEVICE_INFO',
                message: 'Device information is required',
                field: 'deviceInfo'
            });
        } else {
            if (!request.deviceInfo.deviceId) {
                errors.push({
                    code: 'MISSING_DEVICE_ID',
                    message: 'Device ID is required',
                    field: 'deviceInfo.deviceId'
                });
            }

            if (!request.deviceInfo.userAgent) {
                errors.push({
                    code: 'MISSING_USER_AGENT',
                    message: 'User agent is required',
                    field: 'deviceInfo.userAgent'
                });
            }
        }

        // Validate user ID if provided
        if (request.userId) {
            // Check if user exists (would typically validate against user service)
            // For now, just check format
            if (!/^[a-f0-9-]{36}$/i.test(request.userId)) {
                errors.push({
                    code: 'INVALID_USER_ID',
                    message: 'Invalid user ID format',
                    field: 'userId',
                    value: request.userId
                });
            }
        }

        // Validate session type
        if (request.sessionType && !Object.values(SessionType).includes(request.sessionType)) {
            errors.push({
                code: 'INVALID_SESSION_TYPE',
                message: 'Invalid session type',
                field: 'sessionType',
                value: request.sessionType
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metadata: {
                validatedAt: new Date(),
                hasUserId: !!request.userId,
                sessionType: request.sessionType || (request.userId ? SessionType.AUTHENTICATED : SessionType.GUEST)
            }
        };
    }

    /**
     * Generate unique session token
     */
    private generateSessionToken(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 15);
        return `sess_${timestamp}_${random}`;
    }

    /**
     * Map session to response format
     */
    private mapSessionToResponse(session: Session): SessionResponse {
        return {
            sessionId: session.id,
            sessionToken: session.sessionToken,
            userId: session.userId,
            type: session.type,
            status: session.status,
            deviceInfo: session.deviceInfo,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt
        };
    }

    /**
     * Map group by result to record
     */
    private mapGroupByToRecord(groupByResult: any[], key: string): Record<string, number> {
        return groupByResult.reduce((acc, item) => {
            const value = item[key];
            acc[value] = item._count[key];
            return acc;
        }, {});
    }
}
