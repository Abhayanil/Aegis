import { Request, Response, NextFunction } from 'express';
import { AppError, createErrorResponse, classifyError, ErrorSeverity } from './errors.js';
import { logger } from './logger.js';

// Express error handling middleware
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const appError = classifyError(error);
  
  // Log error based on severity
  const logContext = {
    error: {
      message: appError.message,
      code: appError.code,
      category: appError.category,
      severity: appError.severity,
      stack: appError.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    },
    timestamp: appError.timestamp,
  };
  
  switch (appError.severity) {
    case ErrorSeverity.CRITICAL:
      logger.error('Critical error occurred', logContext);
      break;
    case ErrorSeverity.HIGH:
      logger.error('High severity error occurred', logContext);
      break;
    case ErrorSeverity.MEDIUM:
      logger.warn('Medium severity error occurred', logContext);
      break;
    case ErrorSeverity.LOW:
      logger.info('Low severity error occurred', logContext);
      break;
  }
  
  // Create error response
  const errorResponse = createErrorResponse(appError);
  
  // Send response
  res.status(appError.statusCode).json(errorResponse);
}

// Async error wrapper for route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global unhandled error handlers
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: {
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date(),
    });
    
    // Graceful shutdown
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason: String(reason),
      promise: promise.toString(),
      timestamp: new Date(),
    });
    
    // Graceful shutdown
    process.exit(1);
  });
  
  // Handle SIGTERM for graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });
  
  // Handle SIGINT for graceful shutdown
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

// Request timeout middleware
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const timeoutError = new AppError(
          'Request timeout',
          408,
          'REQUEST_TIMEOUT',
          { timeoutMs },
          true,
          'NETWORK' as any,
          ErrorSeverity.MEDIUM,
          true
        );
        
        const errorResponse = createErrorResponse(timeoutError);
        res.status(408).json(errorResponse);
      }
    }, timeoutMs);
    
    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
}

// Rate limiting error handler
export function rateLimitErrorHandler(req: Request, res: Response) {
  const rateLimitError = new AppError(
    'Too many requests, please try again later',
    429,
    'RATE_LIMIT_EXCEEDED',
    {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    true,
    'RATE_LIMIT' as any,
    ErrorSeverity.MEDIUM,
    true
  );
  
  const errorResponse = createErrorResponse(rateLimitError);
  res.status(429).json(errorResponse);
}