import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkServiceHealth,
  getSystemHealth,
  getSystemMetrics,
  HealthMonitor,
  healthTracker
} from '../../src/utils/healthCheck.js';

// Mock Google Cloud utilities
vi.mock('../../src/utils/googleCloud.js', () => ({
  checkBigQueryHealth: vi.fn(),
  checkFirestoreHealth: vi.fn(),
  checkVisionHealth: vi.fn()
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  PerformanceMonitor: {
    startTimer: vi.fn(() => vi.fn())
  },
  AlertSystem: {
    recordServiceSuccess: vi.fn(),
    recordServiceFailure: vi.fn(),
    checkErrorRate: vi.fn()
  }
}));

import { 
  checkBigQueryHealth, 
  checkFirestoreHealth, 
  checkVisionHealth 
} from '../../src/utils/googleCloud.js';
import { logger, PerformanceMonitor, AlertSystem } from '../../src/utils/logger.js';

describe('Health Check Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkServiceHealth', () => {
    it('should return healthy status for successful health check', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      
      const result = await checkServiceHealth('test-service', mockHealthCheck);
      
      expect(result.service).toBe('test-service');
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.lastChecked).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should return unhealthy status for failed health check', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(false);
      
      const result = await checkServiceHealth('test-service', mockHealthCheck);
      
      expect(result.service).toBe('test-service');
      expect(result.status).toBe('unhealthy');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle health check exceptions', async () => {
      const mockHealthCheck = vi.fn().mockRejectedValue(new Error('Connection failed'));
      
      const result = await checkServiceHealth('test-service', mockHealthCheck);
      
      expect(result.service).toBe('test-service');
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Connection failed');
    });

    it('should timeout slow health checks', async () => {
      vi.useFakeTimers();
      
      const mockHealthCheck = vi.fn(() => new Promise(resolve => setTimeout(resolve, 15000)));
      
      const healthCheckPromise = checkServiceHealth('test-service', mockHealthCheck, 1000);
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(1500);
      
      const result = await healthCheckPromise;
      
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Health check timeout');
      
      vi.useRealTimers();
    });

    it('should record performance metrics', async () => {
      const mockEndTimer = vi.fn();
      (PerformanceMonitor.startTimer as any).mockReturnValue(mockEndTimer);
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      
      await checkServiceHealth('test-service', mockHealthCheck);
      
      expect(PerformanceMonitor.startTimer).toHaveBeenCalledWith('health_check_test-service');
      expect(mockEndTimer).toHaveBeenCalledWith(true);
    });

    it('should record service success/failure for alerting', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      
      await checkServiceHealth('test-service', mockHealthCheck);
      
      expect(AlertSystem.recordServiceSuccess).toHaveBeenCalledWith('test-service');
      
      // Test failure case
      mockHealthCheck.mockResolvedValue(false);
      await checkServiceHealth('test-service', mockHealthCheck);
      
      expect(AlertSystem.recordServiceFailure).toHaveBeenCalledWith('test-service');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', () => {
      const metrics = getSystemMetrics();
      
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(typeof metrics.memoryUsage.used).toBe('number');
      expect(typeof metrics.memoryUsage.total).toBe('number');
    });

    it('should handle CPU usage errors gracefully', () => {
      // Mock process.cpuUsage to throw an error
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = vi.fn(() => {
        throw new Error('CPU usage not available');
      });
      
      const metrics = getSystemMetrics();
      
      expect(metrics.cpuUsage).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('Failed to get CPU usage', { error: expect.any(Error) });
      
      // Restore original function
      process.cpuUsage = originalCpuUsage;
    });
  });

  describe('getSystemHealth', () => {
    beforeEach(() => {
      (checkBigQueryHealth as any).mockResolvedValue(true);
      (checkFirestoreHealth as any).mockResolvedValue(true);
      (checkVisionHealth as any).mockResolvedValue(true);
    });

    it('should return healthy status when all services are healthy', async () => {
      const systemHealth = await getSystemHealth();
      
      expect(systemHealth.overall).toBe('healthy');
      expect(systemHealth.services).toHaveLength(3);
      expect(systemHealth.services.every(s => s.status === 'healthy')).toBe(true);
      expect(systemHealth.systemMetrics).toBeDefined();
    });

    it('should return degraded status when some services are unhealthy', async () => {
      (checkVisionHealth as any).mockResolvedValue(false);
      
      const systemHealth = await getSystemHealth();
      
      expect(systemHealth.overall).toBe('degraded');
      expect(systemHealth.services.filter(s => s.status === 'healthy')).toHaveLength(2);
      expect(systemHealth.services.filter(s => s.status === 'unhealthy')).toHaveLength(1);
    });

    it('should return unhealthy status when majority of services are unhealthy', async () => {
      (checkBigQueryHealth as any).mockResolvedValue(false);
      (checkFirestoreHealth as any).mockResolvedValue(false);
      
      const systemHealth = await getSystemHealth();
      
      expect(systemHealth.overall).toBe('unhealthy');
      expect(systemHealth.services.filter(s => s.status === 'unhealthy')).toHaveLength(2);
    });

    it('should log system health summary', async () => {
      await getSystemHealth();
      
      expect(logger.info).toHaveBeenCalledWith('System health check completed', expect.objectContaining({
        category: 'system_health',
        overall: 'healthy'
      }));
    });

    it('should alert on unhealthy system', async () => {
      (checkBigQueryHealth as any).mockResolvedValue(false);
      (checkFirestoreHealth as any).mockResolvedValue(false);
      (checkVisionHealth as any).mockResolvedValue(false);
      
      await getSystemHealth();
      
      expect(logger.error).toHaveBeenCalledWith('System health is unhealthy', expect.objectContaining({
        category: 'alert',
        alertType: 'system_unhealthy'
      }));
    });
  });

  describe('HealthMonitor', () => {
    let healthMonitor: HealthMonitor;

    beforeEach(() => {
      healthMonitor = new HealthMonitor();
      (checkBigQueryHealth as any).mockResolvedValue(true);
      (checkFirestoreHealth as any).mockResolvedValue(true);
      (checkVisionHealth as any).mockResolvedValue(true);
    });

    afterEach(() => {
      healthMonitor.stop();
    });

    it('should start health monitoring', () => {
      expect(healthMonitor.isHealthMonitorRunning()).toBe(false);
      
      healthMonitor.start(1); // 1 minute interval
      
      expect(healthMonitor.isHealthMonitorRunning()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('Starting health monitor', expect.objectContaining({
        category: 'health_monitor',
        intervalMinutes: 1
      }));
    });

    it('should not start if already running', () => {
      healthMonitor.start(1);
      
      const warnSpy = vi.spyOn(logger, 'warn');
      healthMonitor.start(1); // Try to start again
      
      expect(warnSpy).toHaveBeenCalledWith('Health monitor is already running');
    });

    it('should stop health monitoring', () => {
      healthMonitor.start(1);
      expect(healthMonitor.isHealthMonitorRunning()).toBe(true);
      
      healthMonitor.stop();
      
      expect(healthMonitor.isHealthMonitorRunning()).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Health monitor stopped', expect.objectContaining({
        category: 'health_monitor'
      }));
    });

    it('should run periodic health checks', async () => {
      vi.useFakeTimers();
      
      healthMonitor.start(0.01); // Very short interval for testing
      
      // Fast-forward to trigger health check
      vi.advanceTimersByTime(1000);
      
      // Wait for async operations
      await vi.runAllTimersAsync();
      
      expect(AlertSystem.checkErrorRate).toHaveBeenCalledWith('document_processing');
      expect(AlertSystem.checkErrorRate).toHaveBeenCalledWith('ai_analysis');
      expect(AlertSystem.checkErrorRate).toHaveBeenCalledWith('deal_memo_generation');
      
      vi.useRealTimers();
    }, 10000);

    it('should handle health check errors gracefully', async () => {
      vi.useFakeTimers();
      
      (checkBigQueryHealth as any).mockRejectedValue(new Error('Health check failed'));
      
      healthMonitor.start(0.01); // Very short interval for testing
      
      // Fast-forward to trigger health check
      vi.advanceTimersByTime(1000);
      
      // Wait for async operations
      await vi.runAllTimersAsync();
      
      expect(logger.error).toHaveBeenCalledWith('Health monitor check failed', expect.objectContaining({
        category: 'health_monitor'
      }));
      
      vi.useRealTimers();
    }, 10000);
  });

  describe('healthTracker', () => {
    it('should track service uptime', async () => {
      const mockHealthCheck = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      
      // Record 3 health checks for a unique service name
      const serviceName = `test-service-${Date.now()}`;
      await checkServiceHealth(serviceName, mockHealthCheck);
      await checkServiceHealth(serviceName, mockHealthCheck);
      await checkServiceHealth(serviceName, mockHealthCheck);
      
      const uptime = healthTracker.getServiceUptime(serviceName);
      expect(uptime).toBeCloseTo(66.67, 1); // 2 out of 3 successful
    });

    it('should calculate average response time', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      
      const serviceName = `test-service-${Date.now()}`;
      await checkServiceHealth(serviceName, mockHealthCheck);
      await checkServiceHealth(serviceName, mockHealthCheck);
      
      const avgResponseTime = healthTracker.getAverageResponseTime(serviceName);
      expect(avgResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return service history', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      
      const serviceName = `test-service-${Date.now()}`;
      await checkServiceHealth(serviceName, mockHealthCheck);
      await checkServiceHealth(serviceName, mockHealthCheck);
      
      const history = healthTracker.getServiceHistory(serviceName);
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].service).toBe(serviceName);
    });

    it('should limit history size', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue(true);
      
      const serviceName = `test-service-${Date.now()}`;
      // Add more than 100 health checks
      for (let i = 0; i < 150; i++) {
        await checkServiceHealth(serviceName, mockHealthCheck);
      }
      
      const history = healthTracker.getServiceHistory(serviceName);
      expect(history).toHaveLength(100); // Should be limited to 100
    });
  });
});