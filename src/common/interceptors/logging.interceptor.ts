import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';
    const requestId = request.headers['x-request-id'] as string || this.generateRequestId();
    
    // Add request ID to response headers
    response.setHeader('x-request-id', requestId);
    
    const startTime = Date.now();
    
    this.logger.log(
      `Incoming Request: ${method} ${url} - ${ip} - ${userAgent} - RequestID: ${requestId}`,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;
          
          this.logger.log(
            `Outgoing Response: ${method} ${url} - ${statusCode} - ${duration}ms - RequestID: ${requestId}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          
          this.logger.error(
            `Request Error: ${method} ${url} - ${error.message} - ${duration}ms - RequestID: ${requestId}`,
            error.stack,
          );
        },
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
