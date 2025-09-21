import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  asyncHandler,
  requestTimeout,
  rateLimitErrorHandler
} from '../../src/utils/errorHandler.js';
import {
  AppError,
  ValidationError,
  AIServiceError,
  ErrorSeverity
} from '../../src/utils/errors.js';
import { logger } from '../../src/utils/logger.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      url: '/api/test',
      headers: { 'content-type': 'application/json' },
      body: { test: 'data' },
      params: { id: '123' },
      query: { filter: 'active' }
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      headersSent: false
    };

    mockNext = vi.fn();

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'email' },
          retryable: false,
          suggestedAction: 'Please check your input data and try again',
          category: 'VALIDATION',
          severity: 'LOW',
          timestamp: expect.any(Date)
        }
      });
    });

    it('should log errors based on severity', () => {
      const criticalError = new AppError(
        'Critical error',
        500,
        'CRITICAL_ERROR',
        {},
        false,
        'CONFIGURATION' as any,
        ErrorSeverity.CRITICAL
      );

      errorHandler(criticalError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Critical error occurred', expect.objectContaining({
        error: expect.objectContaining({
          message: 'Critical error',
          severity: 'CRITICAL'
        }),
        request: expect.objectContaining({
          method: 'POST',
          url: '/api/test'
        })
      }));
    });

    it('should log high severity errors as errors', () => {
      const highError = new AIServiceError('Service unavailable');

      errorHandler(highError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith('High severity error occurred', expect.any(Object));
    });

    it('should classify unknown errors', () => {
      const unknownError = new Error('Unknown error');

      errorHandler(unknownError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'UNKNOWN_ERROR',
          category: 'INTERNAL'
        })
      }));
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncOperation = vi.fn().mockResolvedValue('success');
      const wrappedHandler = asyncHandler(asyncOperation);

      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncOperation).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const error = new ValidationError('Async error');
      const asyncOperation = vi.fn().mockRejectedValue(error);
      const wrappedHandler = asyncHandler(asyncOperation);

      // The wrapped handler should not throw, but should call next with the error
      wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Wait for the promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('requestTimeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not timeout for fast responses', () => {
      const middleware = requestTimeout(5000);
      
      // Mock response events
      const eventListeners: { [key: string]: Function } = {};
      mockResponse.on = vi.fn((event: string, callback: Function) => {
        eventListeners[event] = callback;
      });

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finishing quickly
      eventListeners.finish();

      // Fast-forward time
      vi.advanceTimersByTime(6000);

      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should timeout slow responses', () => {
      const middleware = requestTimeout(1000);
      
      mockResponse.on = vi.fn();
      mockResponse.headersSent = false;

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Fast-forward past timeout
      vi.advanceTimersByTime(1500);

      expect(mockResponse.status).toHaveBeenCalledWith(408);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout'
        })
      }));
    });

    it('should not timeout if headers already sent', () => {
      const middleware = requestTimeout(1000);
      
      mockResponse.on = vi.fn();
      mockResponse.headersSent = true;

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Fast-forward past timeout
      vi.advanceTimersByTime(1500);

      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitErrorHandler', () => {
    it('should create rate limit error response', () => {
      mockRequest.ip = '192.168.1.1';
      mockRequest.get = vi.fn().mockReturnValue('Mozilla/5.0');

      rateLimitErrorHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          details: {
            ip: '192.168.1.1',
            userAgent: 'Mozilla/5.0'
          },
          retryable: true,
          suggestedAction: 'Rate limit exceeded. Please wait before making another request',
          category: 'RATE_LIMIT',
          severity: 'MEDIUM',
          timestamp: expect.any(Date)
        }
      });
    });
  });
});