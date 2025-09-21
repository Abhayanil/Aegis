import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  requestMonitoring,
  healthCheckEndpoint,
  readinessCheckEndpoint,
  livenessCheckEndpoint,
  metricsEndpoint,
  serviceStatusEndpoint
} from '../../src/utils/monitoring.js';

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  },
  PerformanceMonitor: {
    startTimer: vi.fn(() => vi.fn()),
    getMetrics: vi.fn(() => []),
    getAveragePerformance: vi.fn(() => 1000)
  },
  logServiceInteraction: vi.fn()
}));

vi.mock('../../src/utils/healthCheck.js', () => ({
  getSystemHealth: vi.fn(),
  healthTracker: {
    getServiceHistory: vi.fn(() => []),
    getServiceUptime: vi.fn(() => 95.5),
    getAverageResponseTime: vi.fn(() => 250)
  }
}));

import { logger, PerformanceMonitor, logServiceInteraction } from '../../src/utils/logger.js';
import { getSystemHealth, healthTracker } from '../../src/utils/healthCheck.js';

describe('Monitoring Utilities', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRequest = {
      method: 'POST',
      url: '/api/test',
      path: '/api/test',
      route: { path: '/api/test' },
      headers: {},
      get: vi.fn(),
      ip: '127.0.0.1'
    };

    mockResponse = {
      on: vi.fn(),
      get: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      statusCode: 200
    };

    mockNext = vi.fn();
  });

  describe('requestMonitoring', () => {
    it('should add request ID and start time to request', () => {
      const middleware = requestMonitoring();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect((mockRequest as any).requestId).toBeDefined();
      expect((mockRequest as any).startTime).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use provided request ID from headers', () => {
      mockRequest.headers = { 'x-request-id': 'custom-req-id' };
      const middleware = requestMonitoring();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect((mockRequest as any).requestId).toBe('custom-req-id');
    });

    it('should start performance timer', () => {
      const middleware = requestMonitoring();
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(PerformanceMonitor.startTimer).toHaveBeenCalledWith('request_POST_/api/test');
    });
  });

  describe('healthCheckEndpoint', () => {
    it('should return healthy system status', async () => {
      const mockSystemHealth = {
        overall: 'healthy' as const,
        timestamp: new Date(),
        services: [],
        systemMetrics: {} as any
      };
      
      (getSystemHealth as any).mockResolvedValue(mockSystemHealth);
      
      await healthCheckEndpoint(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSystemHealth
      });
    });

    it('should handle health check errors', async () => {
      (getSystemHealth as any).mockRejectedValue(new Error('Health check failed'));
      
      await healthCheckEndpoint(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'HEALTH_CHECK_FAILED'
        })
      });
    });
  });

  describe('livenessCheckEndpoint', () => {
    it('should return alive status', () => {
      livenessCheckEndpoint(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        alive: true,
        timestamp: expect.any(Date),
        uptime: expect.any(Number)
      });
    });
  });

  describe('metricsEndpoint', () => {
    it('should return performance metrics', () => {
      const mockMetrics = [
        { operation: 'test-op-1', success: true, duration: 1000, timestamp: new Date(), metadata: {} },
        { operation: 'test-op-2', success: true, duration: 500, timestamp: new Date(), metadata: {} }
      ];
      
      (PerformanceMonitor.getMetrics as any)
        .mockReturnValueOnce(mockMetrics)
        .mockReturnValueOnce([mockMetrics[0]])
        .mockReturnValueOnce([mockMetrics[1]]);
      
      (PerformanceMonitor.getAveragePerformance as any)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(500);
      
      metricsEndpoint(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          timestamp: expect.any(Date),
          systemMetrics: expect.any(Object),
          operationMetrics: expect.any(Array)
        })
      });
    });
  });

  describe('serviceStatusEndpoint', () => {
    beforeEach(() => {
      mockRequest.params = { service: 'test-service' };
    });

    it('should return service status', () => {
      const mockHistory = [
        { service: 'test-service', status: 'healthy' as const, lastChecked: new Date() }
      ];
      
      (healthTracker.getServiceHistory as any).mockReturnValue(mockHistory);
      
      serviceStatusEndpoint(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          service: 'test-service',
          currentStatus: mockHistory[0],
          uptime: 95.5,
          averageResponseTime: 250,
          recentHistory: mockHistory
        }
      });
    });

    it('should return 400 for missing service name', () => {
      mockRequest.params = {};
      
      serviceStatusEndpoint(mockRequest as Request, mockResponse as Response);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: expect.objectContaining({
          code: 'MISSING_SERVICE_NAME'
        })
      });
    });
  });
});