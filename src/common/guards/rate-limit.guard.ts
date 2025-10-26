import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
    private store: RateLimitStore = {};
    private readonly windowMs: number;
    private readonly maxRequests: number;

    constructor(
        private configService: ConfigService,
        private reflector: Reflector
    ) {
        this.windowMs = this.configService.get('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000); // 15 minutes
        this.maxRequests = this.configService.get('RATE_LIMIT_MAX_REQUESTS', 100);
    }

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const clientId = this.getClientId(request);
        const now = Date.now();

        // Clean up expired entries
        this.cleanupExpiredEntries(now);

        // Get or create rate limit entry
        const entry = this.store[clientId] || { count: 0, resetTime: now + this.windowMs };

        // Check if window has expired
        if (now >= entry.resetTime) {
            entry.count = 0;
            entry.resetTime = now + this.windowMs;
        }

        // Increment request count
        entry.count++;
        this.store[clientId] = entry;

        // Check if limit exceeded
        if (entry.count > this.maxRequests) {
            const resetTime = Math.ceil((entry.resetTime - now) / 1000);
            throw new HttpException(
                `Rate limit exceeded. Try again in ${resetTime} seconds.`,
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        return true;
    }

    private getClientId(request: any): string {
        // Use user ID if authenticated, otherwise use IP
        const user = request.user;
        if (user?.id) {
            return `user:${user.id}`;
        }

        return `ip:${request.ip || request.connection.remoteAddress}`;
    }

    private cleanupExpiredEntries(now: number): void {
        Object.keys(this.store).forEach(key => {
            if (now >= this.store[key].resetTime) {
                delete this.store[key];
            }
        });
    }
}
