import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CartServiceError } from '../../types/cart.types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let errorCode: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        errorCode = 'HTTP_EXCEPTION';
      } else {
        message = (exceptionResponse as any).message || exception.message;
        errorCode = (exceptionResponse as any).errorCode || 'HTTP_EXCEPTION';
      }
    } else if (exception instanceof CartServiceError) {
      status = this.getHttpStatusFromCartError(exception.code);
      message = exception.message;
      errorCode = exception.code;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      errorCode = 'INTERNAL_SERVER_ERROR';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      errorCode = 'UNKNOWN_ERROR';
    }

    // Log the error
    this.logger.error(
      `Exception caught: ${errorCode} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Prepare error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: {
        code: errorCode,
        message: message,
      },
    };

    // Add request ID if available
    if (request.headers['x-request-id']) {
      (errorResponse as any).requestId = request.headers['x-request-id'];
    }

    response.status(status).json(errorResponse);
  }

  private getHttpStatusFromCartError(errorCode: string): number {
    const statusMap: Record<string, number> = {
      'CART_NOT_FOUND': HttpStatus.NOT_FOUND,
      'ITEM_NOT_FOUND': HttpStatus.NOT_FOUND,
      'INVALID_QUANTITY': HttpStatus.BAD_REQUEST,
      'INSUFFICIENT_STOCK': HttpStatus.BAD_REQUEST,
      'DB_CONNECTION_FAILED': HttpStatus.SERVICE_UNAVAILABLE,
      'TRANSACTION_FAILED': HttpStatus.INTERNAL_SERVER_ERROR,
      'VALIDATION_ERROR': HttpStatus.BAD_REQUEST,
      'AUTHENTICATION_FAILED': HttpStatus.UNAUTHORIZED,
      'AUTHORIZATION_FAILED': HttpStatus.FORBIDDEN,
    };

    return statusMap[errorCode] || HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
