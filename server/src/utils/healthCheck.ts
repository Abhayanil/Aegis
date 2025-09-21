// Health check utilities for monitoring service status
import { 
  checkBigQueryHealth, 
  checkFirestoreHealth, 
  checkVisionHealth 
} from './googleCloud.js';
import { logger, PerformanceMonitor, AlertSystem } from './logger.js';

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: Date;
  uptime?: number;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: HealthStatus[];
  systemMetrics: SystemMetrics;
}

export interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  cpuUsage?: NodeJS.CpuUsage;
  activeConnections?: number;
  requestsPerMinute?: number;
}

// Service health tracking
class ServiceHealthTracker {
  private serviceHistory: Map<string, HealthStatus[]> = new Map();
  private readonly maxHistorySize = 100;
  
  recordHealthCheck(status: HealthStatus): void {
    const serviceName = status.service;
    
    if (!this.serviceHistory.has(serviceName)) {
      this.serviceHistory.set(serviceName, []);
    }
    
    const history = this.serviceHistory.get(serviceName)!;
    history.push(status);
    
    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
    
    // Record service success/failure for alerting
    if (status.status === 'healthy') {
      AlertSystem.recordServiceSuccess(serviceName);
    } else {
      AlertSystem.recordServiceFailure(serviceName);
    }
  }
  
  getServiceUptime(serviceName: string, windowMinutes: number = 60): number {
    const history = this.serviceHistory.get(serviceName) || [];
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    
    const recentChecks = history.filter(h => h.lastChecked.getTime() > cutoffTime);
    if (recentChecks.length === 0) return 0;
    
    const healthyChecks = recentChecks.filter(h => h.status === 'healthy').length;
    return (healthyChecks / recentChecks.length) * 100;
  }
  
  getAverageResponseTime(serviceName: string, windowMinutes: number = 60): number | null {
    const history = this.serviceHistory.get(serviceName) || [];
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    
    const recentChecks = history.filter(h => 
      h.lastChecked.getTime() > cutoffTime && 
      h.responseTime !== undefined &&
      h.status === 'healthy'
    );
    
    if (recentChecks.length === 0) return null;
    
    const totalResponseTime = recentChecks.reduce((sum, h) => sum + (h.responseTime || 0), 0);
    return totalResponseTime / recentChecks.length;
  }
  
  getServiceHistory(serviceName: string): HealthStatus[] {
    return this.serviceHistory.get(serviceName) || [];
  }
}

const healthTracker = new ServiceHealthTracker();

export async function checkServiceHealth(
  serviceName: string,
  healthCheckFn: () => Promise<boolean>,
  timeout: number = 10000
): Promise<HealthStatus> {
  const startTime = Date.now();
  const endTimer = PerformanceMonitor.startTimer(`health_check_${serviceName}`);
  
  try {
    // Add timeout to health check
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeout);
    });
    
    const isHealthy = await Promise.race([healthCheckFn(), timeoutPromise]);
    const responseTime = Date.now() - startTime;
    
    const status: HealthStatus = {
      service: serviceName,
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      lastChecked: new Date(),
      uptime: healthTracker.getServiceUptime(serviceName),
    };
    
    endTimer(isHealthy);
    healthTracker.recordHealthCheck(status);
    
    logger.info('Health check completed', {
      category: 'health_check',
      service: serviceName,
      status: status.status,
      responseTime,
      uptime: status.uptime
    });
    
    return status;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    const status: HealthStatus = {
      service: serviceName,
      status: 'unhealthy',
      responseTime,
      error: errorMessage,
      lastChecked: new Date(),
      uptime: healthTracker.getServiceUptime(serviceName),
    };
    
    endTimer(false, { error: errorMessage });
    healthTracker.recordHealthCheck(status);
    
    logger.error('Health check failed', {
      category: 'health_check',
      service: serviceName,
      error: errorMessage,
      responseTime,
      uptime: status.uptime
    });
    
    return status;
  }
}

export function getSystemMetrics(): SystemMetrics {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  let cpuUsage: NodeJS.CpuUsage | undefined;
  try {
    cpuUsage = process.cpuUsage();
  } catch (error) {
    logger.warn('Failed to get CPU usage', { error });
  }
  
  return {
    memoryUsage,
    uptime,
    cpuUsage,
  };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const healthChecks = [
    checkServiceHealth('bigquery', checkBigQueryHealth),
    checkServiceHealth('firestore', checkFirestoreHealth),
    checkServiceHealth('vision', checkVisionHealth),
  ];

  const services = await Promise.all(healthChecks);
  
  // Determine overall system health
  const healthyCount = services.filter(s => s.status === 'healthy').length;
  const degradedCount = services.filter(s => s.status === 'degraded').length;
  const totalCount = services.length;
  
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (healthyCount === totalCount) {
    overall = 'healthy';
  } else if (healthyCount + degradedCount > totalCount / 2) {
    overall = 'degraded';
  } else {
    overall = 'unhealthy';
  }

  const systemHealth: SystemHealth = {
    overall,
    timestamp: new Date(),
    services,
    systemMetrics: getSystemMetrics(),
  };
  
  // Log system health summary
  logger.info('System health check completed', {
    category: 'system_health',
    overall,
    healthyServices: healthyCount,
    totalServices: totalCount,
    memoryUsage: systemHealth.systemMetrics.memoryUsage.used,
    uptime: systemHealth.systemMetrics.uptime
  });
  
  // Alert on unhealthy system
  if (overall === 'unhealthy') {
    logger.error('System health is unhealthy', {
      category: 'alert',
      alertType: 'system_unhealthy',
      healthyServices: healthyCount,
      totalServices: totalCount,
      unhealthyServices: services.filter(s => s.status === 'unhealthy').map(s => s.service)
    });
  }
  
  return systemHealth;
}

// Periodic health monitoring
export class HealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }
    
    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    logger.info('Starting health monitor', {
      category: 'health_monitor',
      intervalMinutes
    });
    
    // Run initial health check
    this.runHealthCheck();
    
    // Schedule periodic health checks
    this.intervalId = setInterval(() => {
      this.runHealthCheck();
    }, intervalMs);
  }
  
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    logger.info('Health monitor stopped', {
      category: 'health_monitor'
    });
  }
  
  private async runHealthCheck(): Promise<void> {
    try {
      const systemHealth = await getSystemHealth();
      
      // Check error rates for critical operations
      AlertSystem.checkErrorRate('document_processing');
      AlertSystem.checkErrorRate('ai_analysis');
      AlertSystem.checkErrorRate('deal_memo_generation');
      
    } catch (error) {
      logger.error('Health monitor check failed', {
        category: 'health_monitor',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  isHealthMonitorRunning(): boolean {
    return this.isRunning;
  }
}

// Export health tracker for external access
export { healthTracker };