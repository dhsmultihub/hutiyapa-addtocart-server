import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface UserPayload {
    id: string;
    email: string;
    roles: string[];
    iat?: number;
    exp?: number;
}

export interface AuthServiceResponse {
    user: UserPayload;
    isValid: boolean;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly authServiceUrl: string;

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        private httpService: HttpService,
    ) {
        this.authServiceUrl = this.configService.get('AUTH_SERVICE_URL', 'http://localhost:3002');
    }

    /**
     * Validate JWT token and extract user information
     */
    async validateToken(token: string): Promise<AuthServiceResponse> {
        try {
            // First, verify the token locally
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });

            // Then validate with Auth service for additional security
            const isValid = await this.validateWithAuthService(token);

            if (!isValid) {
                throw new UnauthorizedException('Token validation failed');
            }

            return {
                user: payload,
                isValid: true,
            };
        } catch (error) {
            this.logger.error('Token validation failed:', error.message);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    /**
     * Validate token with external Auth service
     */
    private async validateWithAuthService(token: string): Promise<boolean> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.authServiceUrl}/api/v1/auth/validate`, {
                    token,
                }, {
                    timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            return response.data?.valid === true;
        } catch (error) {
            this.logger.warn('Auth service validation failed, using local validation:', error.message);
            // Fallback to local validation if Auth service is unavailable
            return true;
        }
    }

    /**
     * Get user information from Auth service
     */
    async getUserInfo(userId: string): Promise<UserPayload | null> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.authServiceUrl}/api/v1/users/${userId}`, {
                    timeout: 5000,
                })
            );

            return response.data;
        } catch (error) {
            this.logger.error('Failed to fetch user info:', error.message);
            return null;
        }
    }

    /**
     * Check user permissions
     */
    async checkPermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.authServiceUrl}/api/v1/auth/permissions`, {
                    userId,
                    permissions: requiredPermissions,
                }, {
                    timeout: 5000,
                })
            );

            return response.data?.hasPermissions === true;
        } catch (error) {
            this.logger.error('Permission check failed:', error.message);
            return false;
        }
    }

    /**
     * Generate session token for guest users
     */
    generateGuestSessionToken(): string {
        const payload = {
            type: 'guest',
            sessionId: this.generateSessionId(),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
        };

        return this.jwtService.sign(payload);
    }

    /**
     * Extract user ID from token
     */
    extractUserId(token: string): string | null {
        try {
            const payload = this.jwtService.decode(token) as UserPayload;
            return payload?.id || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if user is admin
     */
    isAdmin(user: UserPayload): boolean {
        return user.roles?.includes('admin') || user.roles?.includes('super_admin');
    }

    /**
     * Check if user is guest
     */
    isGuest(user: UserPayload): boolean {
        return user.roles?.includes('guest') || !user.id;
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Log authentication events for audit
     */
    logAuthEvent(event: string, userId: string, details?: any): void {
        this.logger.log(`Auth Event: ${event}`, {
            userId,
            timestamp: new Date().toISOString(),
            details,
        });
    }
}
