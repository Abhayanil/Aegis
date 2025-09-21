// Custom error classes for the application

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  DOCUMENT_PROCESSING = 'DOCUMENT_PROCESSING',
  AI_SERVICE = 'AI_SERVICE',
  GOOGLE_CLOUD = 'GOOGLE_CLOUD',
  CONFIGURATION = 'CONFIGURATION',
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL = 'INTERNAL'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string | undefined;
  public readonly details: Record<string, any> | undefined;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: Record<string, any>,
    isOperational: boolean = true,
    category: ErrorCategory = ErrorCategory.INTERNAL,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryable: boolean = false
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    this.category = category;
    this.severity = severity;
    this.retryable = retryable;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message, 
      400, 
      'VALIDATION_ERROR', 
      details, 
      true, 
      ErrorCategory.VALIDATION, 
      ErrorSeverity.LOW, 
      false
    );
  }
}

export class DocumentProcessingError extends AppError {
  constructor(message: string, details?: Record<string, any>, retryable: boolean = false) {
    super(
      message, 
      422, 
      'DOCUMENT_PROCESSING_ERROR', 
      details, 
      true, 
      ErrorCategory.DOCUMENT_PROCESSING, 
      ErrorSeverity.MEDIUM, 
      retryable
    );
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, details?: Record<string, any>, retryable: boolean = true) {
    super(
      message, 
      503, 
      'AI_SERVICE_ERROR', 
      details, 
      true, 
      ErrorCategory.AI_SERVICE, 
      ErrorSeverity.HIGH, 
      retryable
    );
  }
}

export class GoogleCloudError extends AppError {
  constructor(message: string, details?: Record<string, any>, retryable: boolean = true) {
    super(
      message, 
      503, 
      'GOOGLE_CLOUD_ERROR', 
      details, 
      true, 
      ErrorCategory.GOOGLE_CLOUD, 
      ErrorSeverity.HIGH, 
      retryable
    );
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message, 
      500, 
      'CONFIGURATION_ERROR', 
      details, 
      false, 
      ErrorCategory.CONFIGURATION, 
      ErrorSeverity.CRITICAL, 
      false
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message, 
      429, 
      'RATE_LIMIT_ERROR', 
      details, 
      true, 
      ErrorCategory.RATE_LIMIT, 
      ErrorSeverity.MEDIUM, 
      true
    );
  }
}

export class NetworkError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message, 
      503, 
      'NETWORK_ERROR', 
      details, 
      true, 
      ErrorCategory.NETWORK, 
      ErrorSeverity.HIGH, 
      true
    );
  }
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, any> | undefined;
    retryable: boolean;
    suggestedAction: string | undefined;
    category: ErrorCategory;
    severity: ErrorSeverity;
    timestamp: Date;
  };
  partialResults?: any;
}

// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCategory[];
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCategory.AI_SERVICE,
    ErrorCategory.GOOGLE_CLOUD,
    ErrorCategory.NETWORK,
    ErrorCategory.RATE_LIMIT
  ]
};

// Helper function to create error responses
export function createErrorResponse(
  error: AppError,
  partialResults?: any,
  suggestedAction?: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.details,
      retryable: error.retryable,
      suggestedAction: suggestedAction || getSuggestedAction(error),
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp,
    },
    partialResults,
  };
}

// Get suggested action based on error type
function getSuggestedAction(error: AppError): string {
  switch (error.category) {
    case ErrorCategory.VALIDATION:
      return 'Please check your input data and try again';
    case ErrorCategory.DOCUMENT_PROCESSING:
      return 'Try uploading a different document format or check file integrity';
    case ErrorCategory.AI_SERVICE:
      return 'The AI service is temporarily unavailable. Please try again in a few minutes';
    case ErrorCategory.GOOGLE_CLOUD:
      return 'Google Cloud services are experiencing issues. Please try again later';
    case ErrorCategory.RATE_LIMIT:
      return 'Rate limit exceeded. Please wait before making another request';
    case ErrorCategory.NETWORK:
      return 'Network connectivity issue. Please check your connection and try again';
    case ErrorCategory.CONFIGURATION:
      return 'System configuration error. Please contact support';
    default:
      return 'An unexpected error occurred. Please try again or contact support';
  }
}

// Retry utility with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName: string = 'operation'
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (error instanceof AppError) {
        if (!error.retryable || !retryConfig.retryableErrors.includes(error.category)) {
          throw error;
        }
      }
      
      // Don't retry on last attempt
      if (attempt === retryConfig.maxAttempts) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelay
      );
      
      console.log(`Retry attempt ${attempt}/${retryConfig.maxAttempts} for ${operationName} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Circuit breaker for external services
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeout: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>, serviceName: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new AppError(
          `Circuit breaker is OPEN for ${serviceName}`,
          503,
          'CIRCUIT_BREAKER_OPEN',
          { serviceName, state: this.state },
          true,
          ErrorCategory.INTERNAL,
          ErrorSeverity.HIGH,
          true
        );
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Service degradation manager
export class ServiceDegradationManager {
  private serviceStates: Map<string, boolean> = new Map();
  
  setServiceAvailable(serviceName: string, available: boolean): void {
    this.serviceStates.set(serviceName, available);
  }
  
  isServiceAvailable(serviceName: string): boolean {
    return this.serviceStates.get(serviceName) ?? true;
  }
  
  getAvailableServices(): string[] {
    return Array.from(this.serviceStates.entries())
      .filter(([_, available]) => available)
      .map(([service, _]) => service);
  }
  
  getUnavailableServices(): string[] {
    return Array.from(this.serviceStates.entries())
      .filter(([_, available]) => !available)
      .map(([service, _]) => service);
  }
  
  canProceedWithDegradation(requiredServices: string[]): boolean {
    const availableServices = this.getAvailableServices();
    const criticalServices = requiredServices.filter(service => 
      ['gemini', 'bigquery'].includes(service.toLowerCase())
    );
    
    return criticalServices.every(service => availableServices.includes(service));
  }
}

// Global service degradation manager instance
export const serviceDegradationManager = new ServiceDegradationManager();

// Error classification utility
export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    // Classify based on error message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('rate limit') || message.includes('quota')) {
      return new RateLimitError(error.message, { originalError: error.name });
    }
    
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return new NetworkError(error.message, { originalError: error.name });
    }
    
    if (message.includes('authentication') || message.includes('unauthorized')) {
      return new AppError(
        error.message,
        401,
        'AUTHENTICATION_ERROR',
        { originalError: error.name },
        true,
        ErrorCategory.AUTHENTICATION,
        ErrorSeverity.HIGH,
        false
      );
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return new ValidationError(error.message, { originalError: error.name });
    }
  }
  
  // Default classification for unknown errors
  return new AppError(
    'An unexpected error occurred',
    500,
    'UNKNOWN_ERROR',
    { originalError: String(error) },
    true,
    ErrorCategory.INTERNAL,
    ErrorSeverity.MEDIUM,
    false
  );
}