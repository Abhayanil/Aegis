import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AppError,
  ValidationError,
  DocumentProcessingError,
  AIServiceError,
  GoogleCloudError,
  RateLimitError,
  NetworkError,
  ErrorCategory,
  ErrorSeverity,
  createErrorResponse,
  withRetry,
  CircuitBreaker,
  ServiceDegradationManager,
  classifyError,
  DEFAULT_RETRY_CONFIG
} from '../../src/utils/errors.js';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with all properties', () => {
      const error = new AppError(
        'Test error',
        400,
        'TEST_ERROR',
        { test: 'data' },
        true,
        ErrorCategory.VALIDATION,
        ErrorSeverity.LOW,
        false
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ test: 'data' });
      expect(error.isOperational).toBe(true);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.retryable).toBe(false);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use default values when not provided', () => {
      const error = new AppError('Test error');

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.retryable).toBe(false);
    });
  });

  describe('Specific Error Classes', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.retryable).toBe(false);
    });

    it('should create AIServiceError with correct properties', () => {
      const error = new AIServiceError('AI service unavailable');

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('AI_SERVICE_ERROR');
      expect(error.category).toBe(ErrorCategory.AI_SERVICE);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.retryable).toBe(true);
    });

    it('should create RateLimitError with correct properties', () => {
      const error = new RateLimitError('Rate limit exceeded');

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(error.retryable).toBe(true);
    });
  });
});

describe('Error Response Creation', () => {
  it('should create error response with all fields', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    const response = createErrorResponse(error, { partial: 'data' }, 'Custom action');

    expect(response.success).toBe(false);
    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBe('Invalid input');
    expect(response.error.details).toEqual({ field: 'email' });
    expect(response.error.retryable).toBe(false);
    expect(response.error.suggestedAction).toBe('Custom action');
    expect(response.error.category).toBe(ErrorCategory.VALIDATION);
    expect(response.error.severity).toBe(ErrorSeverity.LOW);
    expect(response.partialResults).toEqual({ partial: 'data' });
  });

  it('should generate suggested action when not provided', () => {
    const error = new AIServiceError('Service unavailable');
    const response = createErrorResponse(error);

    expect(response.error.suggestedAction).toBe('The AI service is temporarily unavailable. Please try again in a few minutes');
  });
});

describe('Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await withRetry(operation, {}, 'test-operation');
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new AIServiceError('Service unavailable'))
      .mockResolvedValue('success');
    
    const retryPromise = withRetry(operation, { maxAttempts: 2 }, 'test-operation');
    
    // Fast-forward through the delay
    await vi.advanceTimersByTimeAsync(1000);
    
    const result = await retryPromise;
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors', async () => {
    const operation = vi.fn().mockRejectedValue(new ValidationError('Invalid input'));
    
    await expect(withRetry(operation, {}, 'test-operation')).rejects.toThrow('Invalid input');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should respect max attempts', async () => {
    const operation = vi.fn().mockRejectedValue(new AIServiceError('Service unavailable'));
    
    const retryPromise = withRetry(operation, { maxAttempts: 3 }, 'test-operation');
    
    // Fast-forward through all retry delays
    await vi.advanceTimersByTimeAsync(10000);
    
    await expect(retryPromise).rejects.toThrow('Service unavailable');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(2, 1000); // 2 failures, 1 second recovery
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow operations when circuit is closed', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await circuitBreaker.execute(operation, 'test-service');
    
    expect(result).toBe('success');
    expect(circuitBreaker.getState().state).toBe('CLOSED');
  });

  it('should open circuit after failure threshold', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Service error'));
    
    // First failure
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow();
    expect(circuitBreaker.getState().state).toBe('CLOSED');
    
    // Second failure - should open circuit
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow();
    expect(circuitBreaker.getState().state).toBe('OPEN');
  });

  it('should reject requests when circuit is open', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Service error'));
    
    // Trigger circuit to open
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow();
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow();
    
    // Now circuit should be open and reject immediately
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('should transition to half-open after recovery timeout', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Service error'))
      .mockRejectedValueOnce(new Error('Service error'))
      .mockResolvedValue('success');
    
    // Open the circuit
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow();
    await expect(circuitBreaker.execute(operation, 'test-service')).rejects.toThrow();
    expect(circuitBreaker.getState().state).toBe('OPEN');
    
    // Fast-forward past recovery timeout
    vi.advanceTimersByTime(1500);
    
    // Should allow one request (half-open) and succeed
    const result = await circuitBreaker.execute(operation, 'test-service');
    expect(result).toBe('success');
    expect(circuitBreaker.getState().state).toBe('CLOSED');
  });
});

describe('Service Degradation Manager', () => {
  let manager: ServiceDegradationManager;

  beforeEach(() => {
    manager = new ServiceDegradationManager();
  });

  it('should track service availability', () => {
    manager.setServiceAvailable('gemini', true);
    manager.setServiceAvailable('bigquery', false);

    expect(manager.isServiceAvailable('gemini')).toBe(true);
    expect(manager.isServiceAvailable('bigquery')).toBe(false);
    expect(manager.isServiceAvailable('unknown')).toBe(true); // Default to available
  });

  it('should return available and unavailable services', () => {
    manager.setServiceAvailable('gemini', true);
    manager.setServiceAvailable('bigquery', false);
    manager.setServiceAvailable('vision', true);

    expect(manager.getAvailableServices()).toEqual(['gemini', 'vision']);
    expect(manager.getUnavailableServices()).toEqual(['bigquery']);
  });

  it('should check if can proceed with degradation', () => {
    manager.setServiceAvailable('gemini', true);
    manager.setServiceAvailable('bigquery', true);
    manager.setServiceAvailable('vision', false);

    expect(manager.canProceedWithDegradation(['gemini', 'bigquery'])).toBe(true);
    expect(manager.canProceedWithDegradation(['gemini', 'vision'])).toBe(true); // vision not critical
    
    manager.setServiceAvailable('gemini', false);
    expect(manager.canProceedWithDegradation(['gemini', 'bigquery'])).toBe(false); // gemini is critical
  });
});

describe('Error Classification', () => {
  it('should classify AppError as-is', () => {
    const originalError = new ValidationError('Invalid input');
    const classified = classifyError(originalError);

    expect(classified).toBe(originalError);
  });

  it('should classify rate limit errors', () => {
    const error = new Error('Rate limit exceeded');
    const classified = classifyError(error);

    expect(classified).toBeInstanceOf(AppError);
    expect(classified.category).toBe(ErrorCategory.RATE_LIMIT);
  });

  it('should classify network errors', () => {
    const error = new Error('Connection timeout');
    const classified = classifyError(error);

    expect(classified).toBeInstanceOf(AppError);
    expect(classified.category).toBe(ErrorCategory.NETWORK);
  });

  it('should classify authentication errors', () => {
    const error = new Error('Unauthorized access');
    const classified = classifyError(error);

    expect(classified.statusCode).toBe(401);
    expect(classified.category).toBe(ErrorCategory.AUTHENTICATION);
  });

  it('should classify validation errors', () => {
    const error = new Error('Invalid data format');
    const classified = classifyError(error);

    expect(classified).toBeInstanceOf(AppError);
    expect(classified.category).toBe(ErrorCategory.VALIDATION);
  });

  it('should classify unknown errors as internal', () => {
    const error = new Error('Unknown error');
    const classified = classifyError(error);

    expect(classified.category).toBe(ErrorCategory.INTERNAL);
    expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
  });

  it('should handle non-Error objects', () => {
    const classified = classifyError('string error');

    expect(classified.category).toBe(ErrorCategory.INTERNAL);
    expect(classified.message).toBe('An unexpected error occurred');
  });
});