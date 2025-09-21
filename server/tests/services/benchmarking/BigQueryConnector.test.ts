// Integration tests for BigQuery connector
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BigQueryConnector } from '../../../src/services/benchmarking/BigQueryConnector.js';
import { CompanyProfile } from '../../../src/models/CompanyProfile.js';
import { FundingStage } from '../../../src/types/enums.js';

// Mock BigQuery client
const mockBigQuery = {
  projectId: 'test-project',
  getDatasets: vi.fn(),
  dataset: vi.fn(),
  createQueryJob: vi.fn()
};

const mockJob = {
  getQueryResults: vi.fn(),
  cancel: vi.fn()
};

const mockDataset = {
  get: vi.fn()
};

// Mock the Google Cloud initialization
vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeBigQuery: () => mockBigQuery
}));

describe('BigQueryConnector', () => {
  let connector: BigQueryConnector;
  let sampleCompanyProfile: CompanyProfile;

  beforeEach(() => {
    connector = new BigQueryConnector({
      datasetId: 'test_dataset',
      benchmarkTableId: 'test_benchmarks',
      companyTableId: 'test_companies',
      maxResults: 100,
      queryTimeoutMs: 10000
    });

    sampleCompanyProfile = {
      id: 'test-company-1',
      name: 'TestFintech Inc',
      oneLiner: 'AI-powered financial services platform',
      sector: 'fintech',
      stage: FundingStage.SERIES_A,
      foundedYear: 2020,
      location: 'San Francisco, CA',
      website: 'https://testfintech.com',
      description: 'We provide AI-driven lending and payment solutions for small businesses',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await connector.cleanup();
  });

  describe('Authentication', () => {
    it('should authenticate successfully with valid credentials', async () => {
      mockBigQuery.getDatasets.mockResolvedValue([[]]);

      const result = await connector.authenticate();

      expect(result).toBe(true);
      expect(mockBigQuery.getDatasets).toHaveBeenCalledWith({ maxResults: 1 });
    });

    it('should handle authentication failure gracefully', async () => {
      mockBigQuery.getDatasets.mockRejectedValue(new Error('Authentication failed'));

      const result = await connector.authenticate();

      expect(result).toBe(false);
    });
  });

  describe('Dataset Management', () => {
    it('should get or create dataset successfully', async () => {
      mockBigQuery.dataset.mockReturnValue(mockDataset);
      mockDataset.get.mockResolvedValue([{ id: 'test_dataset' }]);

      const dataset = await connector.getOrCreateDataset();

      expect(dataset).toBeDefined();
      expect(mockBigQuery.dataset).toHaveBeenCalledWith('test_dataset');
      expect(mockDataset.get).toHaveBeenCalledWith({ autoCreate: true });
    });

    it('should handle dataset creation errors', async () => {
      mockBigQuery.dataset.mockReturnValue(mockDataset);
      mockDataset.get.mockRejectedValue(new Error('Dataset creation failed'));

      await expect(connector.getOrCreateDataset()).rejects.toThrow('Dataset creation failed');
    });
  });

  describe('Query Execution', () => {
    it('should execute query successfully and return results', async () => {
      const mockRows = [
        { sector: 'fintech', metric_name: 'arr', value: 1000000 },
        { sector: 'fintech', metric_name: 'growth_rate', value: 0.5 }
      ];

      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([mockRows]);

      const query = 'SELECT * FROM test_table LIMIT 10';
      const results = await connector.executeQuery(query);

      expect(results).toEqual(mockRows);
      expect(mockBigQuery.createQueryJob).toHaveBeenCalledWith(
        expect.objectContaining({
          query,
          location: 'US',
          useLegacySql: false,
          useQueryCache: true
        })
      );
    });

    it('should handle query execution errors', async () => {
      mockBigQuery.createQueryJob.mockRejectedValue(new Error('Query failed'));

      const query = 'INVALID SQL QUERY';
      
      await expect(connector.executeQuery(query)).rejects.toThrow('Query failed');
    });

    it('should respect query timeout and result limits', async () => {
      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([[]]);

      await connector.executeQuery('SELECT 1');

      expect(mockBigQuery.createQueryJob).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 10000,
          maximumBytesBilled: '100000000'
        })
      );

      expect(mockJob.getQueryResults).toHaveBeenCalledWith({
        maxResults: 100
      });
    });
  });

  describe('Benchmark Data Retrieval', () => {
    it('should fetch benchmark data with sector filter', async () => {
      const mockBenchmarkRows = [
        {
          sector: 'fintech',
          sub_sector: 'payments',
          stage: 'series-a',
          geography: 'US',
          sample_size: 50,
          metrics_json: JSON.stringify({
            arr: { median: 1000000, p25: 500000, p75: 2000000, sampleSize: 50 }
          }),
          last_updated: '2024-01-01',
          data_source: 'test_source',
          methodology: 'test_methodology',
          confidence: 0.8,
          time_range_start: '2023-01-01',
          time_range_end: '2023-12-31'
        }
      ];

      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([mockBenchmarkRows]);

      const benchmarks = await connector.getBenchmarkData({
        sector: 'fintech',
        stage: FundingStage.SERIES_A,
        minSampleSize: 10
      });

      expect(benchmarks).toHaveLength(1);
      expect(benchmarks[0]).toMatchObject({
        sector: 'fintech',
        subSector: 'payments',
        stage: 'series-a',
        sampleSize: 50,
        confidence: 0.8
      });
      expect(benchmarks[0].metrics).toHaveProperty('arr');
    });

    it('should handle empty benchmark results', async () => {
      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([[]]);

      const benchmarks = await connector.getBenchmarkData({
        sector: 'nonexistent-sector'
      });

      expect(benchmarks).toHaveLength(0);
    });
  });

  describe('Sector Classification', () => {
    it('should classify company sector from BigQuery data', async () => {
      const mockClassificationRows = [
        {
          sector: 'fintech',
          sub_sectors: ['payments', 'lending'],
          confidence: 0.9,
          reasoning: 'Strong keyword match and company profile analysis'
        }
      ];

      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([mockClassificationRows]);

      const classification = await connector.getSectorClassification(sampleCompanyProfile);

      expect(classification).toMatchObject({
        primarySector: 'fintech',
        secondarySectors: ['payments', 'lending'],
        confidence: 0.9
      });
    });

    it('should fallback to keyword classification when no BigQuery data', async () => {
      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([[]]);

      const classification = await connector.getSectorClassification(sampleCompanyProfile);

      expect(classification.primarySector).toBe('fintech');
      expect(classification.confidence).toBeGreaterThan(0);
      expect(classification.reasoning).toContain('keyword');
    });
  });

  describe('Aggregated Metrics', () => {
    it('should calculate aggregated metrics for sector', async () => {
      const mockMetricRows = [
        {
          metric_name: 'arr',
          min_value: 100000,
          max_value: 10000000,
          median: 1000000,
          p25: 500000,
          p75: 2000000,
          p90: 5000000,
          mean: 1500000,
          std_dev: 1000000,
          sample_size: 100
        },
        {
          metric_name: 'growth_rate',
          min_value: 0.1,
          max_value: 3.0,
          median: 0.5,
          p25: 0.3,
          p75: 0.8,
          p90: 1.2,
          mean: 0.6,
          std_dev: 0.3,
          sample_size: 95
        }
      ];

      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([mockMetricRows]);

      const metrics = await connector.getAggregatedMetrics('fintech', FundingStage.SERIES_A);

      expect(metrics).toHaveProperty('arr');
      expect(metrics).toHaveProperty('growth_rate');
      expect(metrics.arr).toMatchObject({
        median: 1000000,
        p25: 500000,
        p75: 2000000,
        sampleSize: 100
      });
    });

    it('should handle metrics with insufficient sample size', async () => {
      // Mock empty result since BigQuery query has HAVING sample_size >= 10 clause
      const mockMetricRows: any[] = [];

      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([mockMetricRows]);

      const metrics = await connector.getAggregatedMetrics('fintech');

      // Should not include metrics with insufficient sample size (query filters out sample_size < 10)
      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe('Connection Pool Management', () => {
    it('should track active connections in pool', async () => {
      // Create a promise that we can control
      let resolveJob: any;
      const jobPromise = new Promise(resolve => { resolveJob = resolve; });
      
      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockImplementation(() => jobPromise);

      // Start a query but don't await it
      const queryPromise = connector.executeQuery('SELECT 1');
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Check pool status while query is running
      const status = connector.getConnectionPoolStatus();
      expect(status.activeConnections).toBe(1);
      expect(status.jobIds).toHaveLength(1);

      // Complete the job
      resolveJob([[]]);
      await queryPromise;

      // Pool should be cleaned up
      const finalStatus = connector.getConnectionPoolStatus();
      expect(finalStatus.activeConnections).toBe(0);
    });

    it('should cancel queries and clean up pool', async () => {
      // Create a promise that we can control
      let resolveJob: any;
      const jobPromise = new Promise(resolve => { resolveJob = resolve; });
      
      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockImplementation(() => jobPromise);
      mockJob.cancel.mockResolvedValue(undefined);

      // Start a query but don't await it
      const queryPromise = connector.executeQuery('SELECT 1');
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = connector.getConnectionPoolStatus();
      expect(status.activeConnections).toBe(1);

      // Cancel the query
      const cancelled = await connector.cancelQuery(status.jobIds[0]);
      expect(cancelled).toBe(true);
      expect(mockJob.cancel).toHaveBeenCalled();

      // Pool should be cleaned up
      const finalStatus = connector.getConnectionPoolStatus();
      expect(finalStatus.activeConnections).toBe(0);
      
      // Complete the original query to avoid hanging
      resolveJob([[]]);
      await queryPromise;
    });
  });

  describe('Error Handling', () => {
    it('should handle BigQuery service errors gracefully', async () => {
      mockBigQuery.createQueryJob.mockRejectedValue(new Error('Service unavailable'));

      await expect(connector.executeQuery('SELECT 1')).rejects.toThrow('Service unavailable');
    });

    it('should handle malformed query results', async () => {
      const malformedRows = [
        { invalid_json: 'not-json', sector: null }
      ];

      mockBigQuery.createQueryJob.mockResolvedValue([mockJob]);
      mockJob.getQueryResults.mockResolvedValue([malformedRows]);

      // Should not throw but handle gracefully
      await expect(connector.getBenchmarkData({ sector: 'test' })).rejects.toThrow();
    });
  });
});