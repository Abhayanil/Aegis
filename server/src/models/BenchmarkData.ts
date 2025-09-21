// Benchmark data model
import { MetricDistribution, BaseEntity, PercentileRankings } from '../types/interfaces.js';
import { FundingStage } from '../types/enums.js';

export interface BenchmarkData extends BaseEntity {
  sector: string;
  subSector?: string;
  stage?: FundingStage;
  geography?: string;
  sampleSize: number;
  metrics: Record<string, MetricDistribution>;
  lastUpdated: Date;
  dataSource: string;
  methodology: string;
  confidence: number;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface BenchmarkDataInput {
  sector: string;
  subSector?: string;
  stage?: FundingStage;
  geography?: string;
  sampleSize: number;
  metrics: Record<string, MetricDistribution>;
  dataSource: string;
  methodology: string;
  confidence: number;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
}

export interface BenchmarkComparison {
  metric: string;
  companyValue: number;
  sectorMedian: number;
  percentile: number;
  interpretation: string;
  context: string;
  recommendation?: string;
}

export interface SectorBenchmarks {
  sector: string;
  stage: FundingStage;
  companyMetrics: Record<string, number>;
  benchmarkData: BenchmarkData;
  comparisons: BenchmarkComparison[];
  overallPerformance: {
    score: number;
    ranking: 'top-decile' | 'top-quartile' | 'above-median' | 'below-median' | 'bottom-quartile' | 'bottom-decile';
    summary: string;
  };
  generatedAt: Date;
}