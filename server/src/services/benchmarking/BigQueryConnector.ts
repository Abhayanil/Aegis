// BigQuery connector for market data benchmarking
import { BigQuery, Dataset, Table, Job } from '@google-cloud/bigquery';
import { initializeBigQuery } from '../../utils/googleCloud.js';
import { logger } from '../../utils/logger.js';
import { appConfig } from '../../utils/config.js';
import { BenchmarkData, SectorClassification } from '../../models/BenchmarkData.js';
import { CompanyProfile } from '../../models/CompanyProfile.js';
import { MetricDistribution } from '../../types/interfaces.js';
import { FundingStage } from '../../types/enums.js';

export interface BigQueryConfig {
  datasetId: string;
  benchmarkTableId: string;
  companyTableId: string;
  maxResults: number;
  queryTimeoutMs: number;
}

export interface QueryOptions {
  sector?: string;
  stage?: FundingStage;
  geography?: string;
  minSampleSize?: number;
  maxAge?: number; // days
}

export class BigQueryConnector {
  private client: BigQuery;
  private config: BigQueryConfig;
  private connectionPool: Map<string, Job> = new Map();

  constructor(config?: Partial<BigQueryConfig>) {
    this.client = initializeBigQuery();
    this.config = {
      datasetId: appConfig.googleCloud.bigQuery?.datasetId || 'aegis_benchmarks',
      benchmarkTableId: appConfig.googleCloud.bigQuery?.benchmarkTableId || 'sector_benchmarks',
      companyTableId: appConfig.googleCloud.bigQuery?.companyTableId || 'company_data',
      maxResults: config?.maxResults || 1000,
      queryTimeoutMs: config?.queryTimeoutMs || 30000,
      ...config
    };
  }

  /**
   * Authenticate and test BigQuery connection
   */
  async authenticate(): Promise<boolean> {
    try {
      await this.client.getDatasets({ maxResults: 1 });
      logger.info('BigQuery authentication successful');
      return true;
    } catch (error) {
      logger.error('BigQuery authentication failed:', error);
      return false;
    }
  }

  /**
   * Get or create dataset for benchmark data
   */
  async getOrCreateDataset(): Promise<Dataset> {
    try {
      const [dataset] = await this.client.dataset(this.config.datasetId).get({ autoCreate: true });
      logger.info(`Dataset ${this.config.datasetId} ready`);
      return dataset;
    } catch (error) {
      logger.error(`Failed to get/create dataset ${this.config.datasetId}:`, error);
      throw error;
    }
  }

  /**
   * Execute optimized query with connection pooling
   */
  async executeQuery(query: string, options?: { jobId?: string }): Promise<any[]> {
    try {
      const jobId = options?.jobId || `aegis_query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queryOptions = {
        query,
        jobId,
        location: 'US',
        maximumBytesBilled: '100000000', // 100MB limit
        timeoutMs: this.config.queryTimeoutMs,
        useLegacySql: false,
        useQueryCache: true
      };

      logger.info(`Executing BigQuery job: ${jobId}`);
      const [job] = await this.client.createQueryJob(queryOptions);
      
      // Store job in connection pool for potential cancellation
      this.connectionPool.set(jobId, job);

      const [rows] = await job.getQueryResults({
        maxResults: this.config.maxResults
      });

      // Clean up connection pool
      this.connectionPool.delete(jobId);

      logger.info(`Query completed successfully. Returned ${rows.length} rows`);
      return rows;
    } catch (error) {
      logger.error('BigQuery query execution failed:', error);
      throw error;
    }
  }

  /**
   * Get benchmark data for specific sector and stage
   */
  async getBenchmarkData(options: QueryOptions): Promise<BenchmarkData[]> {
    const whereConditions: string[] = [];
    const parameters: any[] = [];

    if (options.sector) {
      whereConditions.push('sector = ?');
      parameters.push(options.sector);
    }

    if (options.stage) {
      whereConditions.push('stage = ?');
      parameters.push(options.stage);
    }

    if (options.geography) {
      whereConditions.push('geography = ?');
      parameters.push(options.geography);
    }

    if (options.minSampleSize) {
      whereConditions.push('sample_size >= ?');
      parameters.push(options.minSampleSize);
    }

    if (options.maxAge) {
      whereConditions.push('DATE_DIFF(CURRENT_DATE(), last_updated, DAY) <= ?');
      parameters.push(options.maxAge);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        sector,
        sub_sector,
        stage,
        geography,
        sample_size,
        metrics_json,
        last_updated,
        data_source,
        methodology,
        confidence,
        time_range_start,
        time_range_end
      FROM \`${this.client.projectId}.${this.config.datasetId}.${this.config.benchmarkTableId}\`
      ${whereClause}
      ORDER BY last_updated DESC, confidence DESC
    `;

    try {
      const rows = await this.executeQuery(query);
      return rows.map(row => this.mapRowToBenchmarkData(row));
    } catch (error) {
      logger.error('Failed to fetch benchmark data:', error);
      throw error;
    }
  }

  /**
   * Get sector classification data for company profiling
   */
  async getSectorClassification(companyProfile: CompanyProfile): Promise<SectorClassification> {
    const query = `
      SELECT 
        sector,
        sub_sectors,
        confidence,
        reasoning
      FROM \`${this.client.projectId}.${this.config.datasetId}.sector_classification\`
      WHERE 
        LOWER(company_name) = LOWER(?)
        OR LOWER(description) LIKE LOWER(CONCAT('%', ?, '%'))
        OR keywords_array && SPLIT(LOWER(?), ' ')
      ORDER BY confidence DESC
      LIMIT 5
    `;

    try {
      const rows = await this.executeQuery(query);
      
      if (rows.length === 0) {
        // Fallback to keyword-based classification
        return this.classifyBySectorKeywords(companyProfile);
      }

      const topResult = rows[0];
      return {
        primarySector: topResult.sector,
        secondarySectors: topResult.sub_sectors || [],
        confidence: topResult.confidence || 0.5,
        reasoning: topResult.reasoning || 'Based on company profile matching'
      };
    } catch (error) {
      logger.error('Failed to get sector classification:', error);
      // Return fallback classification
      return this.classifyBySectorKeywords(companyProfile);
    }
  }

  /**
   * Get aggregated metrics for sector comparison
   */
  async getAggregatedMetrics(sector: string, stage?: FundingStage): Promise<Record<string, MetricDistribution>> {
    const stageCondition = stage ? 'AND stage = ?' : '';
    const parameters = stage ? [sector, stage] : [sector];

    const query = `
      SELECT 
        metric_name,
        MIN(value) as min_value,
        MAX(value) as max_value,
        APPROX_QUANTILES(value, 100)[OFFSET(50)] as median,
        APPROX_QUANTILES(value, 100)[OFFSET(25)] as p25,
        APPROX_QUANTILES(value, 100)[OFFSET(75)] as p75,
        APPROX_QUANTILES(value, 100)[OFFSET(90)] as p90,
        AVG(value) as mean,
        STDDEV(value) as std_dev,
        COUNT(*) as sample_size
      FROM \`${this.client.projectId}.${this.config.datasetId}.company_metrics\`
      WHERE sector = ? ${stageCondition}
        AND value IS NOT NULL
        AND value > 0
      GROUP BY metric_name
      HAVING sample_size >= 10
    `;

    try {
      const rows = await this.executeQuery(query);
      const metrics: Record<string, MetricDistribution> = {};

      for (const row of rows) {
        metrics[row.metric_name] = {
          min: row.min_value,
          max: row.max_value,
          median: row.median,
          p25: row.p25,
          p75: row.p75,
          p90: row.p90,
          mean: row.mean,
          stdDev: row.std_dev,
          sampleSize: row.sample_size
        };
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get aggregated metrics:', error);
      throw error;
    }
  }

  /**
   * Cancel running query by job ID
   */
  async cancelQuery(jobId: string): Promise<boolean> {
    try {
      const job = this.connectionPool.get(jobId);
      if (job) {
        await job.cancel();
        this.connectionPool.delete(jobId);
        logger.info(`Query ${jobId} cancelled successfully`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to cancel query ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get connection pool status
   */
  getConnectionPoolStatus(): { activeConnections: number; jobIds: string[] } {
    return {
      activeConnections: this.connectionPool.size,
      jobIds: Array.from(this.connectionPool.keys())
    };
  }

  /**
   * Clean up connection pool
   */
  async cleanup(): Promise<void> {
    const jobIds = Array.from(this.connectionPool.keys());
    await Promise.all(jobIds.map(jobId => this.cancelQuery(jobId)));
    this.connectionPool.clear();
    logger.info('BigQuery connection pool cleaned up');
  }

  /**
   * Map BigQuery row to BenchmarkData interface
   */
  private mapRowToBenchmarkData(row: any): BenchmarkData {
    return {
      id: `${row.sector}_${row.stage}_${row.geography}`,
      sector: row.sector,
      subSector: row.sub_sector,
      stage: row.stage as FundingStage,
      geography: row.geography,
      sampleSize: row.sample_size,
      metrics: JSON.parse(row.metrics_json),
      lastUpdated: new Date(row.last_updated),
      dataSource: row.data_source,
      methodology: row.methodology,
      confidence: row.confidence,
      timeRange: {
        startDate: new Date(row.time_range_start),
        endDate: new Date(row.time_range_end)
      },
      createdAt: new Date(row.last_updated),
      updatedAt: new Date(row.last_updated)
    };
  }

  /**
   * Fallback sector classification using keywords
   */
  private classifyBySectorKeywords(companyProfile: CompanyProfile): SectorClassification {
    const sectorKeywords = {
      'fintech': ['finance', 'banking', 'payment', 'lending', 'crypto', 'blockchain'],
      'healthtech': ['health', 'medical', 'healthcare', 'biotech', 'pharma'],
      'edtech': ['education', 'learning', 'school', 'university', 'training'],
      'enterprise-software': ['enterprise', 'b2b', 'saas', 'software', 'platform'],
      'consumer': ['consumer', 'b2c', 'marketplace', 'social', 'mobile'],
      'deeptech': ['ai', 'ml', 'artificial intelligence', 'robotics', 'iot']
    };

    const text = `${companyProfile.oneLiner} ${companyProfile.description || ''}`.toLowerCase();
    
    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return {
          primarySector: sector,
          secondarySectors: [],
          confidence: 0.6,
          reasoning: 'Classified based on company description keywords'
        };
      }
    }

    return {
      primarySector: 'other',
      secondarySectors: [],
      confidence: 0.3,
      reasoning: 'Unable to classify based on available information'
    };
  }
}