import { Request, Response, NextFunction } from 'express';
import { logger, PerformanceMonitor, logServiceInteraction } from './logger.js';
import { getSystemHealth, healthTracker } from './healthCheck.js';

// Request monitoring middleware
export function requestMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string || 
                     `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add request ID and start time to request
    (req as any).requestId = requestId;
    (req as any).startTime = startTime;
    
    // Start performance timer
    const endTimer = PerformanceMonitor.startTimer(`request_${req.method}_${req.route?.path || req.path}`);
    
    // Log request details
    logger.info('Request received', {
      category: 'request',
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      ip: req.ip,
      timestamp: new Date()
    });
    
    // Monitor response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      // End performance timer
      endTimer(success, {
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length'),
        requestId
      });
      
      // Log response details
      logger.info('Request completed', {
        category: 'request_completed',
        requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        success,
        responseSize: res.get('Content-Length'),
        timestamp: new Date()
      });
      
      // Log service interaction
      logServiceInteraction({
        service: 'aegis-api',
        operation: `${req.method} ${req.path}`,
        requestId,
        duration,
        success,
        statusCode: res.statusCode,
        timestamp: new Date(),
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });
    });
    
    // Monitor for request errors
    res.on('error', (error) => {
      const duration = Date.now() - startTime;
      
      endTimer(false, {
        error: error.message,
        requestId
      });
      
      logger.error('Request error', {
        category: 'request_error',
        requestId,
        method: req.method,
        url: req.url,
        error: error.message,
        duration,
        timestamp: new Date()
      });
    });
    
    next();
  };
}

// API endpoint monitoring decorator
export function monitorEndpoint(operationName: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const [req, res] = args;
      const requestId = (req as any).requestId || 'unknown';
      const endTimer = PerformanceMonitor.startTimer(operationName);
      
      try {
        logger.info('Endpoint operation started', {
          category: 'endpoint',
          operation: operationName,
          requestId,
          timestamp: new Date()
        });
        
        const result = await originalMethod.apply(this, args);
        
        endTimer(true, { requestId });
        
        logger.info('Endpoint operation completed', {
          category: 'endpoint',
          operation: operationName,
          requestId,
          success: true,
          timestamp: new Date()
        });
        
        return result;
      } catch (error) {
        endTimer(false, { 
          error: error instanceof Error ? error.message : String(error),
          requestId 
        });
        
        logger.error('Endpoint operation failed', {
          category: 'endpoint',
          operation: operationName,
          requestId,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Health check endpoints
export async function healthCheckEndpoint(req: Request, res: Response) {
  try {
    const systemHealth = await getSystemHealth();
    
    const statusCode = systemHealth.overall === 'healthy' ? 200 : 
                      systemHealth.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    logger.error('Health check endpoint failed', {
      category: 'health_check',
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Failed to retrieve system health',
        timestamp: new Date()
      }
    });
  }
}

// Readiness check endpoint (for Kubernetes/container orchestration)
export async function readinessCheckEndpoint(req: Request, res: Response) {
  try {
    const systemHealth = await getSystemHealth();
    const criticalServices = ['bigquery', 'firestore'];
    
    const criticalServicesHealthy = systemHealth.services
      .filter(s => criticalServices.includes(s.service))
      .every(s => s.status === 'healthy');
    
    if (criticalServicesHealthy) {
      res.status(200).json({
        success: true,
        ready: true,
        timestamp: new Date()
      });
    } else {
      res.status(503).json({
        success: false,
        ready: false,
        reason: 'Critical services are not healthy',
        timestamp: new Date()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      ready: false,
      reason: 'Failed to check readiness',
      timestamp: new Date()
    });
  }
}

// Liveness check endpoint (for Kubernetes/container orchestration)
export function livenessCheckEndpoint(req: Request, res: Response) {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    success: true,
    alive: true,
    timestamp: new Date(),
    uptime: process.uptime()
  });
}

// Metrics endpoint
export function metricsEndpoint(req: Request, res: Response) {
  try {
    const allMetrics = PerformanceMonitor.getMetrics();
    const operations = [...new Set(allMetrics.map(m => m.operation))];
    
    const metricsData = operations.map(operation => {
      const operationMetrics = PerformanceMonitor.getMetrics(operation);
      const avgPerformance = PerformanceMonitor.getAveragePerformance(operation);
      const successRate = operationMetrics.length > 0 ? 
        operationMetrics.filter(m => m.success).length / operationMetrics.length : 0;
      
      return {
        operation,
        totalRequests: operationMetrics.length,
        successRate,
        averageResponseTime: avgPerformance,
        recentMetrics: operationMetrics.slice(-10) // Last 10 metrics
      };
    });
    
    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        systemMetrics: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          cpuUsage: process.cpuUsage()
        },
        operationMetrics: metricsData
      }
    });
  } catch (error) {
    logger.error('Metrics endpoint failed', {
      category: 'metrics',
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_FAILED',
        message: 'Failed to retrieve metrics',
        timestamp: new Date()
      }
    });
  }
}

// Service status endpoint
export function serviceStatusEndpoint(req: Request, res: Response) {
  try {
    const serviceName = req.params.service;
    
    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SERVICE_NAME',
          message: 'Service name is required'
        }
      });
    }
    
    const serviceHistory = healthTracker.getServiceHistory(serviceName);
    const uptime = healthTracker.getServiceUptime(serviceName);
    const avgResponseTime = healthTracker.getAverageResponseTime(serviceName);
    
    if (serviceHistory.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: `No health data found for service: ${serviceName}`
        }
      });
    }
    
    const latestStatus = serviceHistory[serviceHistory.length - 1];
    
    res.json({
      success: true,
      data: {
        service: serviceName,
        currentStatus: latestStatus,
        uptime,
        averageResponseTime: avgResponseTime,
        recentHistory: serviceHistory.slice(-20) // Last 20 checks
      }
    });
  } catch (error) {
    logger.error('Service status endpoint failed', {
      category: 'service_status',
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_STATUS_FAILED',
        message: 'Failed to retrieve service status',
        timestamp: new Date()
      }
    });
  }
}