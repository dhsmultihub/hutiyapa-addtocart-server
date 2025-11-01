import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CustomLoggerService as LoggerService } from './logger.service';
import { CorrelationContext } from '../types/monitoring.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
    private readonly logger = new Logger(CorrelationInterceptor.name);

    constructor(private readonly loggerService: LoggerService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Generate correlation ID if not present
        const correlationId = this.getOrCreateCorrelationId(request);

        // Set correlation ID in response headers
        response.setHeader('X-Correlation-ID', correlationId);

        // Create correlation context
        const correlationContext: CorrelationContext = {
            correlationId,
            userId: this.extractUserId(request),
            sessionId: this.extractSessionId(request),
            requestId: uuidv4(),
            service: 'addtocart-service',
            startTime: new Date(),
            metadata: {
                method: request.method,
                url: request.url,
                userAgent: request.get('User-Agent'),
                ipAddress: this.getClientIp(request)
            }
        };

        // Set correlation context in logger service
        this.loggerService.setCorrelationContext(correlationContext);

        const startTime = Date.now();
        const method = request.method;
        const url = request.url;

        return next.handle().pipe(
            tap((data) => {
                const duration = Date.now() - startTime;
                const statusCode = response.statusCode;

                // Log successful request
                this.loggerService.logApiRequest(
                    method,
                    url,
                    statusCode,
                    duration,
                    correlationContext.userId,
                    correlationContext.sessionId
                );

                // Log performance metrics
                this.loggerService.logPerformanceMetrics(
                    'addtocart-service',
                    url,
                    duration,
                    process.memoryUsage().heapUsed / 1024 / 1024, // MB
                    0 // CPU usage would be calculated separately
                );

                this.logger.debug(`Request completed: ${method} ${url} - ${statusCode} (${duration}ms)`);
            }),
            catchError((error) => {
                const duration = Date.now() - startTime;
                const statusCode = error.status || 500;

                // Log failed request
                this.loggerService.logApiError(
                    method,
                    url,
                    statusCode,
                    error,
                    correlationContext.userId,
                    correlationContext.sessionId
                );

                this.logger.error(`Request failed: ${method} ${url} - ${statusCode} (${duration}ms)`, error.stack);

                throw error;
            })
        );
    }

    /**
     * Get or create correlation ID
     */
    private getOrCreateCorrelationId(request: Request): string {
        // Check if correlation ID exists in headers
        const existingCorrelationId = request.get('X-Correlation-ID') ||
            request.get('X-Request-ID') ||
            request.get('X-Trace-ID');

        if (existingCorrelationId) {
            return existingCorrelationId;
        }

        // Generate new correlation ID
        return uuidv4();
    }

    /**
     * Extract user ID from request
     */
    private extractUserId(request: Request): string | undefined {
        // Check JWT token
        const authHeader = request.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                // In a real implementation, you would decode the JWT token
                // For now, we'll extract from a mock user header
                return request.get('X-User-ID');
            } catch (error) {
                this.logger.warn('Failed to extract user ID from token');
            }
        }

        // Check custom headers
        return request.get('X-User-ID');
    }

    /**
     * Extract session ID from request
     */
    private extractSessionId(request: Request): string | undefined {
        // Check session cookie
        const sessionCookie = request.cookies?.sessionId;
        if (sessionCookie) {
            return sessionCookie;
        }

        // Check custom headers
        return request.get('X-Session-ID');
    }

    /**
     * Get client IP address
     */
    private getClientIp(request: Request): string {
        return request.ip ||
            request.connection.remoteAddress ||
            request.socket.remoteAddress ||
            (request.connection as any)?.socket?.remoteAddress ||
            'unknown';
    }
}
