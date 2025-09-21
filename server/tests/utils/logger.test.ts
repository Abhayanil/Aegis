import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logger,
  PerformanceMonitor,
  logServiceInteraction,
  createRequestLogger,
  AlertSystem
} from '../../src/utils/logger.js';

// Mock winston
vi.mock('winston', () => ({
  default: {
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      add: vi.fn()
    })),
    format: {
      combine: vi.fn(),
      timestamp: vi.fn(),
      errors: vi.fn(),
      json: vi.fn(),
      printf: vi.fn(),
      colorize: vi.fn(),
      simple: vi.fn()
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn()
    }
  }
}));

// Mock config
vi.mock('../../src/utils/config.js', () => ({
  appConfig: {
    logging: {
      level: 'info',
      format: 'json'
    },
    server: {
      nodeEnv: 'test'
    }
  }
}));

describe('Logger Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    PerformanceMonitor.clearMetrics();
  });

  describe('PerformanceMonitor', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should record performance metrics', () => {
      const endTimer = PerformanceMonitor.startTimer('test-operation');
      
      // Simulate operation taking 1000ms
      vi.advanceTimersByTime(1000);
      endTimer(true, { test: 'metadata' });
      
      const metrics = PerformanceMonitor.getMetrics('test-operation');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].operation).toBe('test-operation');
      expect(metrics[0].duration).toBe(1000);
      expect(metrics[0].success).toBe(true);
      expect(metrics[0].metadata).toEqual({ test: 'metadata' });
    });

    it('should calculate average performance', () => {
      const endTimer1 = PerformanceMonitor.startTimer('test-operation');
      vi.advanceTimersByTime(1000);
      endTimer1(true);
      
      const endTimer2 = PerformanceMonitor.startTimer('test-operation');
      vi.advanceTimersByTime(2000);
      endTimer2(true);
      
      const average = PerformanceMonitor.getAveragePerformance('test-operation');
      expect(average).toBe(1500); // (1000 + 2000) / 2
    });

    it('should exclude failed operations from average calculation', () => {
      const endTimer1 = PerformanceMonitor.startTimer('test-operation');
      vi.advanceTimersByTime(1000);
      endTimer1(true);
      
      const endTimer2 = PerformanceMonitor.startTimer('test-operation');
      vi.advanceTimersByTime(5000);
      endTimer2(false); // Failed operation
      
      const average = PerformanceMonitor.getAveragePerformance('test-operation');
      expect(average).toBe(1000); // Only successful operation counted
    });

    it('should limit metrics history per operation', () => {
      // Add 150 metrics (more than the 100 limit)
      for (let i = 0; i < 150; i++) {
        const endTimer = PerformanceMonitor.startTimer('test-operation');
        vi.advanceTimersByTime(100);
        endTimer(true);
      }
      
      const metrics = PerformanceMonitor.getMetrics('test-operation');
      expect(metrics).toHaveLength(100); // Should be limited to 100
    });

    it('should clear metrics for specific operation', () => {
      const endTimer1 = PerformanceMonitor.startTimer('operation-1');
      endTimer1(true);
      
      const endTimer2 = PerformanceMonitor.startTimer('operation-2');
      endTimer2(true);
      
      PerformanceMonitor.clearMetrics('operation-1');
      
      expect(PerformanceMonitor.getMetrics('operation-1')).toHaveLength(0);
      expect(PerformanceMonitor.getMetrics('operation-2')).toHaveLength(1);
    });

    it('should clear all metrics', () => {
      const endTimer1 = PerformanceMonitor.startTimer('operation-1');
      endTimer1(true);
      
      const endTimer2 = PerformanceMonitor.startTimer('operation-2');
      endTimer2(true);
      
      PerformanceMonitor.clearMetrics();
      
      expect(PerformanceMonitor.getMetrics()).toHaveLength(0);
    });
  });

  describe('logServiceInteraction', () => {
    it('should log successful service interaction', () => {
      const logSpy = vi.spyOn(logger, 'info');
      
      logServiceInteraction({
        service: 'gemini',
        operation: 'analyze-document',
        requestId: 'req-123',
        duration: 1500,
        success: true,
        statusCode: 200,
        timestamp: new Date(),
        metadata: { documentType: 'pdf' }
      });
      
      expect(logSpy).toHaveBeenCalledWith('Service interaction', expect.objectContaining({
        category: 'service_interaction',
        service: 'gemini',
        operation: 'analyze-document',
        success: true
      }));
    });

    it('should log and alert on failed service interaction', () => {
      const infoSpy = vi.spyOn(logger, 'info');
      const errorSpy = vi.spyOn(logger, 'error');
      
      logServiceInteraction({
        service: 'bigquery',
        operation: 'query-benchmarks',
        requestId: 'req-456',
        duration: 5000,
        success: false,
        statusCode: 500,
        errorMessage: 'Query timeout',
        timestamp: new Date()
      });
      
      expect(infoSpy).toHaveBeenCalledWith('Service interaction', expect.any(Object));
      expect(errorSpy).toHaveBeenCalledWith('Service interaction failed', expect.objectContaining({
        category: 'service_failure',
        service: 'bigquery',
        errorMessage: 'Query timeout'
      }));
    });
  });

  describe('createRequestLogger', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        url: '/api/test',
        headers: {},
        get: vi.fn(),
        ip: '127.0.0.1'
      };

      mockRes = {
        on: vi.fn(),
        statusCode: 200
      };

      mockNext = vi.fn();
    });

    it('should add request ID and log request start', () => {
      const logSpy = vi.spyOn(logger, 'info');
      const middleware = createRequestLogger();
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockReq.requestId).toBeDefined();
      expect(logSpy).toHaveBeenCalledWith('Request started', expect.objectContaining({
        category: 'request',
        method: 'POST',
        url: '/api/test'
      }));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use provided request ID from headers', () => {
      mockReq.headers['x-request-id'] = 'custom-req-id';
      const middleware = createRequestLogger();
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockReq.requestId).toBe('custom-req-id');
    });

    it('should log request completion on finish event', () => {
      const logSpy = vi.spyOn(logger, 'info');
      const middleware = createRequestLogger();
      let finishCallback: Function;
      
      mockRes.on = vi.fn((event: string, callback: Function) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });
      
      middleware(mockReq, mockRes, mockNext);
      
      // Simulate response finish
      finishCallback!();
      
      expect(logSpy).toHaveBeenCalledWith('Request completed', expect.objectContaining({
        category: 'request',
        method: 'POST',
        statusCode: 200
      }));
    });
  });

  describe('AlertSystem', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      PerformanceMonitor.clearMetrics();
      AlertSystem.resetState();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should alert on high error rate', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      
      // Create metrics with high error rate (60% errors)
      for (let i = 0; i < 10; i++) {
        const endTimer = PerformanceMonitor.startTimer('test-operation');
        vi.advanceTimersByTime(100);
        endTimer(i < 6 ? false : true); // 6 failures, 4 successes
      }
      
      AlertSystem.checkErrorRate('test-operation', 5);
      
      expect(errorSpy).toHaveBeenCalledWith('High error rate detected', expect.objectContaining({
        category: 'alert',
        alertType: 'high_error_rate',
        operation: 'test-operation',
        errorRate: 0.6
      }));
    });

    it('should not alert on acceptable error rate', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      
      // Create metrics with low error rate (5% errors)
      for (let i = 0; i < 20; i++) {
        const endTimer = PerformanceMonitor.startTimer('test-operation');
        vi.advanceTimersByTime(100);
        endTimer(i < 1 ? false : true); // 1 failure, 19 successes
      }
      
      AlertSystem.checkErrorRate('test-operation', 5);
      
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should track service failure counts', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      
      // Record 5 consecutive failures (threshold)
      for (let i = 0; i < 5; i++) {
        AlertSystem.recordServiceFailure('test-service');
      }
      
      expect(errorSpy).toHaveBeenCalledWith('Service failure threshold exceeded', expect.objectContaining({
        category: 'alert',
        alertType: 'service_failure_threshold',
        service: 'test-service',
        failureCount: 5
      }));
    });

    it('should reset failure count on success', () => {
      const errorSpy = vi.spyOn(logger, 'error');
      
      // Record failures
      AlertSystem.recordServiceFailure('test-service');
      AlertSystem.recordServiceFailure('test-service');
      
      // Record success (should reset count)
      AlertSystem.recordServiceSuccess('test-service');
      
      // Record more failures (should not trigger alert immediately)
      AlertSystem.recordServiceFailure('test-service');
      AlertSystem.recordServiceFailure('test-service');
      
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should allow custom alert thresholds', () => {
      AlertSystem.setAlertThresholds({
        serviceFailureCount: 2
      });
      
      const errorSpy = vi.spyOn(logger, 'error');
      
      // Should trigger alert after 2 failures instead of default 5
      AlertSystem.recordServiceFailure('test-service');
      AlertSystem.recordServiceFailure('test-service');
      
      expect(errorSpy).toHaveBeenCalledWith('Service failure threshold exceeded', expect.objectContaining({
        failureCount: 2,
        threshold: 2
      }));
    });
  });
});