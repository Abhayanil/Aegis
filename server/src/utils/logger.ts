import winston from 'winston';
import { appConfig } from './config.js';

// Performance metrics interface
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Service interaction log interface
export interface ServiceInteractionLog {
  service: string;
  operation: string;
  requestId: string;
  duration: number;
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Custom log format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    return JSON.stringify({
      timestamp,
      level,
      service: service || 'aegis-backend',
      message,
      ...meta
    });
  })
);

// Create logger instance with enhanced configuration
export const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: appConfig.logging.format === 'json' ? structuredFormat : winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${service || 'aegis-backend'}] ${level}: ${message} ${metaStr}`;
    })
  ),
  defaultMeta: { service: 'aegis-backend' },
  transports: [
    new winston.transports.Console({
      format: appConfig.server.nodeEnv === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : structuredFormat
    }),
  ],
});

// Add file transports in production
if (appConfig.server.nodeEnv === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: structuredFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    format: structuredFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 10,
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/performance.log',
    level: 'info',
    format: structuredFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }));
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static metrics: Map<string, PerformanceMetrics[]> = new Map();
  
  static startTimer(operation: string): () => void {
    const startTime = Date.now();
    
    return (success: boolean = true, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      const metric: PerformanceMetrics = {
        operation,
        duration,
        success,
        timestamp: new Date(),
        metadata
      };
      
      // Store metric
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }
      this.metrics.get(operation)!.push(metric);
      
      // Keep only last 100 metrics per operation
      const operationMetrics = this.metrics.get(operation)!;
      if (operationMetrics.length > 100) {
        operationMetrics.splice(0, operationMetrics.length - 100);
      }
      
      // Log performance metric
      logger.info('Performance metric recorded', {
        category: 'performance',
        operation,
        duration,
        success,
        metadata
      });
      
      // Alert on slow operations (>30 seconds)
      if (duration > 30000) {
        logger.warn('Slow operation detected', {
          category: 'performance_alert',
          operation,
          duration,
          threshold: 30000,
          metadata
        });
      }
    };
  }
  
  static getMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.metrics.get(operation) || [];
    }
    
    const allMetrics: PerformanceMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }
  
  static getAveragePerformance(operation: string): number | null {
    const metrics = this.metrics.get(operation);
    if (!metrics || metrics.length === 0) return null;
    
    const successfulMetrics = metrics.filter(m => m.success);
    if (successfulMetrics.length === 0) return null;
    
    const totalDuration = successfulMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / successfulMetrics.length;
  }
  
  static clearMetrics(operation?: string): void {
    if (operation) {
      this.metrics.delete(operation);
    } else {
      this.metrics.clear();
    }
  }
}

// Service interaction logger
export function logServiceInteraction(log: ServiceInteractionLog): void {
  logger.info('Service interaction', {
    category: 'service_interaction',
    service: log.service,
    operation: log.operation,
    requestId: log.requestId,
    duration: log.duration,
    success: log.success,
    statusCode: log.statusCode,
    errorMessage: log.errorMessage,
    timestamp: log.timestamp,
    metadata: log.metadata
  });
  
  // Alert on service failures
  if (!log.success) {
    logger.error('Service interaction failed', {
      category: 'service_failure',
      service: log.service,
      operation: log.operation,
      requestId: log.requestId,
      statusCode: log.statusCode,
      errorMessage: log.errorMessage,
      metadata: log.metadata
    });
  }
}

// Request logging middleware helper
export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID to request object
    req.requestId = requestId;
    
    // Log request start
    logger.info('Request started', {
      category: 'request',
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date()
    });
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        category: 'request',
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        timestamp: new Date()
      });
      
      // Alert on slow requests (>10 seconds)
      if (duration > 10000) {
        logger.warn('Slow request detected', {
          category: 'performance_alert',
          requestId,
          method: req.method,
          url: req.url,
          duration,
          threshold: 10000
        });
      }
    });
    
    next();
  };
}

// Alert system for critical operations
export class AlertSystem {
  private static alertThresholds = {
    errorRate: 0.1, // 10% error rate
    responseTime: 30000, // 30 seconds
    serviceFailureCount: 5 // 5 consecutive failures
  };
  
  private static serviceFailureCounts: Map<string, number> = new Map();
  
  static resetState(): void {
    this.serviceFailureCounts.clear();
    this.alertThresholds = {
      errorRate: 0.1,
      responseTime: 30000,
      serviceFailureCount: 5
    };
  }
  
  static checkErrorRate(operation: string, windowMinutes: number = 5): void {
    const metrics = PerformanceMonitor.getMetrics(operation);
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    
    const recentMetrics = metrics.filter(m => m.timestamp.getTime() > cutoffTime);
    if (recentMetrics.length === 0) return;
    
    const errorCount = recentMetrics.filter(m => !m.success).length;
    const errorRate = errorCount / recentMetrics.length;
    
    if (errorRate > this.alertThresholds.errorRate) {
      logger.error('High error rate detected', {
        category: 'alert',
        alertType: 'high_error_rate',
        operation,
        errorRate,
        threshold: this.alertThresholds.errorRate,
        windowMinutes,
        totalRequests: recentMetrics.length,
        errorCount
      });
    }
  }
  
  static recordServiceFailure(serviceName: string): void {
    const currentCount = this.serviceFailureCounts.get(serviceName) || 0;
    const newCount = currentCount + 1;
    this.serviceFailureCounts.set(serviceName, newCount);
    
    if (newCount >= this.alertThresholds.serviceFailureCount) {
      logger.error('Service failure threshold exceeded', {
        category: 'alert',
        alertType: 'service_failure_threshold',
        service: serviceName,
        failureCount: newCount,
        threshold: this.alertThresholds.serviceFailureCount
      });
    }
  }
  
  static recordServiceSuccess(serviceName: string): void {
    this.serviceFailureCounts.set(serviceName, 0);
  }
  
  static setAlertThresholds(thresholds: Partial<typeof AlertSystem.alertThresholds>): void {
    Object.assign(this.alertThresholds, thresholds);
  }
}