// Unit tests for MetricComparator
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricComparator } from '../../../src/services/benchmarking/MetricComparator.js';
import { InvestmentMetrics } from '../../../src/models/InvestmentMetrics.js';
import { BenchmarkData } from '../../../src/models/BenchmarkData.js';
import { FundingStage } from '../../../src/types/enums.js';

describe('MetricComparator', () => {
  let comparator: MetricComparator;
  let sampleCompanyMetrics: InvestmentMetrics;
  let sampleBenchmarkData: BenchmarkData;

  beforeEach(() => {
    comparator = new MetricComparator();

    sampleCompanyMetrics = {
      id: 'test-metrics-1',
      revenue: {
        arr: 2000000, // $2M ARR
        growthRate: 1.5, // 150% growth
        grossMargin: 0.8 // 80% gross margin
      },
      traction: {
        customers: 150,
        churnRate: 0.05, // 5% monthly churn
        ltvCacRatio: 4.5
      },
      team: {
        size: 25,
        foundersCount: 2,
        keyHires: []
      },
      funding: {
        totalRaised: 5000000 // $5M total raised
      },
      extractionTimestamp: new Date(),
      sourceDocuments: ['test-doc'],
      confidence: 0.9,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    sampleBenchmarkData = {
      id: 'test-benchmark-1',
      sector: 'fintech',
      stage: FundingStage.SERIES_A,
      sampleSize: 100,
      metrics: {
        arr: {
          min: 500000,
          max: 10000000,
          median: 1500000,
          p25: 1000000,
          p75: 3000000,
          p90: 5000000,
          mean: 2000000,
          stdDev: 1500000,
          sampleSize: 100
        },
        growth_rate: {
          min: 0.2,
          max: 3.0,
          median: 1.0,
          p25: 0.6,
          p75: 1.8,
          p90: 2.5,
          mean: 1.2,
          stdDev: 0.6,
          sampleSize: 95
        },
        gross_margin: {
          min: 0.3,
          max: 0.95,
          median: 0.7,
          p25: 0.6,
          p75: 0.8,
          p90: 0.9,
          mean: 0.72,
          stdDev: 0.15,
          sampleSize: 90
        },
        customers: {
          min: 10,
          max: 1000,
          median: 100,
          p25: 50,
          p75: 200,
          p90: 400,
          mean: 150,
          stdDev: 120,
          sampleSize: 85
        },
        churn_rate: {
          min: 0.01,
          max: 0.15,
          median: 0.08,
          p25: 0.05,
          p75: 0.12,
          p90: 0.14,
          mean: 0.08,
          stdDev: 0.04,
          sampleSize: 80
        },
        ltv_cac_ratio: {
          min: 1.0,
          max: 8.0,
          median: 3.5,
          p25: 2.5,
          p75: 5.0,
          p90: 6.5,
          mean: 3.8,
          stdDev: 1.5,
          sampleSize: 75
        },
        team_size: {
          min: 5,
          max: 100,
          median: 20,
          p25: 12,
          p75: 35,
          p90: 60,
          mean: 25,
          stdDev: 18,
          sampleSize: 100
        },
        total_raised: {
          min: 1000000,
          max: 50000000,
          median: 8000000,
          p25: 3000000,
          p75: 15000000,
          p90: 25000000,
          mean: 10000000,
          stdDev: 8000000,
          sampleSize: 100
        }
      },
      lastUpdated: new Date(),
      dataSource: 'test_source',
      methodology: 'test_methodology',
      confidence: 0.9,
      timeRange: {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('Percentile Calculations', () => {
    it('should calculate percentiles correctly for all metrics', () => {
      const rankings = comparator.calculatePercentileRankings(sampleCompanyMetrics, sampleBenchmarkData);

      expect(rankings).toHaveProperty('arr');
      expect(rankings).toHaveProperty('growth_rate');
      expect(rankings).toHaveProperty('gross_margin');
      expect(rankings).toHaveProperty('customers');
      expect(rankings).toHaveProperty('churn_rate');
      expect(rankings).toHaveProperty('ltv_cac_ratio');
      expect(rankings).toHaveProperty('team_size');
      expect(rankings).toHaveProperty('total_raised');

      // ARR: $2M vs median $1.5M should be above median
      expect(rankings.arr.percentile).toBeGreaterThan(50);
      expect(rankings.arr.value).toBe(2000000);

      // Growth rate: 150% vs median 100% should be above median
      expect(rankings.growth_rate.percentile).toBeGreaterThan(50);
      expect(rankings.growth_rate.value).toBe(1.5);

      // Churn rate: 5% vs median 8% should be good (inverted percentile)
      expect(rankings.churn_rate.percentile).toBeGreaterThan(50);
      expect(rankings.churn_rate.value).toBe(0.05);
    });

    it('should handle edge cases in percentile calculation', () => {
      // Test with values at distribution boundaries
      const edgeMetrics = {
        ...sampleCompanyMetrics,
        revenue: {
          ...sampleCompanyMetrics.revenue,
          arr: 500000 // Minimum value
        }
      };

      const rankings = comparator.calculatePercentileRankings(edgeMetrics, sampleBenchmarkData);
      expect(rankings.arr.percentile).toBe(0);

      // Test with maximum value
      const maxMetrics = {
        ...sampleCompanyMetrics,
        revenue: {
          ...sampleCompanyMetrics.revenue,
          arr: 10000000 // Maximum value
        }
      };

      const maxRankings = comparator.calculatePercentileRankings(maxMetrics, sampleBenchmarkData);
      expect(maxRankings.arr.percentile).toBe(100);
    });

    it('should provide meaningful interpretations', () => {
      const rankings = comparator.calculatePercentileRankings(sampleCompanyMetrics, sampleBenchmarkData);

      expect(rankings.arr.interpretation).toContain('annual recurring revenue');
      expect(rankings.growth_rate.interpretation).toContain('revenue growth rate');
      expect(rankings.churn_rate.interpretation).toContain('retention');
    });
  });

  describe('Metric Comparisons', () => {
    it('should generate comprehensive metric comparisons', async () => {
      const result = await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { includeRecommendations: true }
      );

      expect(result.comparisons).toHaveLength(8);
      expect(result.percentileRankings).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.performanceCategory).toBeDefined();
      expect(result.summary).toBeDefined();

      // Check that comparisons include required fields
      const firstComparison = result.comparisons[0];
      expect(firstComparison).toHaveProperty('metric');
      expect(firstComparison).toHaveProperty('companyValue');
      expect(firstComparison).toHaveProperty('sectorMedian');
      expect(firstComparison).toHaveProperty('percentile');
      expect(firstComparison).toHaveProperty('interpretation');
      expect(firstComparison).toHaveProperty('context');
      expect(firstComparison).toHaveProperty('recommendation');
    });

    it('should sort comparisons by significance', async () => {
      const result = await comparator.compareMetrics(sampleCompanyMetrics, sampleBenchmarkData);

      // Comparisons should be sorted by distance from median (50th percentile)
      for (let i = 0; i < result.comparisons.length - 1; i++) {
        const currentSignificance = Math.abs(result.comparisons[i].percentile - 50);
        const nextSignificance = Math.abs(result.comparisons[i + 1].percentile - 50);
        expect(currentSignificance).toBeGreaterThanOrEqual(nextSignificance);
      }
    });

    it('should calculate overall score correctly', async () => {
      const result = await comparator.compareMetrics(sampleCompanyMetrics, sampleBenchmarkData);

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);

      // Score should be weighted average of percentiles
      const expectedRange = [30, 80]; // Rough expected range based on sample data
      expect(result.overallScore).toBeGreaterThan(expectedRange[0]);
      expect(result.overallScore).toBeLessThan(expectedRange[1]);
    });

    it('should categorize performance correctly', async () => {
      const result = await comparator.compareMetrics(sampleCompanyMetrics, sampleBenchmarkData);

      const validCategories = ['exceptional', 'strong', 'average', 'below-average', 'concerning'];
      expect(validCategories).toContain(result.performanceCategory);

      // Based on sample data, should be average or better
      expect(['average', 'strong', 'exceptional']).toContain(result.performanceCategory);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations when requested', async () => {
      const result = await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { includeRecommendations: true }
      );

      result.comparisons.forEach(comparison => {
        expect(comparison.recommendation).toBeDefined();
        expect(comparison.recommendation!.length).toBeGreaterThan(0);
      });
    });

    it('should not provide recommendations when not requested', async () => {
      const result = await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { includeRecommendations: false }
      );

      result.comparisons.forEach(comparison => {
        expect(comparison.recommendation).toBeUndefined();
      });
    });

    it('should provide different recommendations based on performance', async () => {
      // Test with poor performing metrics
      const poorMetrics = {
        ...sampleCompanyMetrics,
        revenue: {
          ...sampleCompanyMetrics.revenue,
          arr: 600000, // Below median
          growthRate: 0.3 // Low growth
        }
      };

      const result = await comparator.compareMetrics(
        poorMetrics,
        sampleBenchmarkData,
        { includeRecommendations: true, significanceThreshold: 40 }
      );

      const arrComparison = result.comparisons.find(c => c.metric === 'arr');
      const growthComparison = result.comparisons.find(c => c.metric === 'growth_rate');

      expect(arrComparison?.recommendation).toContain('Focus on');
      expect(growthComparison?.recommendation).toContain('Accelerate');
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const result1 = await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { cacheResults: true }
      );

      const result2 = await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { cacheResults: true }
      );

      // Results should be identical (cached)
      expect(result1.overallScore).toBe(result2.overallScore);
      expect(result1.performanceCategory).toBe(result2.performanceCategory);
    });

    it('should not cache when disabled', async () => {
      await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { cacheResults: false }
      );

      const stats = comparator.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear cache when requested', async () => {
      await comparator.compareMetrics(
        sampleCompanyMetrics,
        sampleBenchmarkData,
        { cacheResults: true }
      );

      let stats = comparator.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      comparator.clearCache();
      stats = comparator.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Context Generation', () => {
    it('should generate meaningful context for comparisons', async () => {
      const result = await comparator.compareMetrics(sampleCompanyMetrics, sampleBenchmarkData);

      result.comparisons.forEach(comparison => {
        expect(comparison.context).toContain('fintech');
        expect(comparison.context).toContain('series-a');
        expect(comparison.context).toContain('percentile');
        // Each metric has different sample sizes, so check for any number
        expect(comparison.context).toMatch(/\d+/);
      });
    });

    it('should format values appropriately in context', async () => {
      const result = await comparator.compareMetrics(sampleCompanyMetrics, sampleBenchmarkData);

      const arrComparison = result.comparisons.find(c => c.metric === 'arr');
      expect(arrComparison?.context).toContain('$2.0M');

      const growthComparison = result.comparisons.find(c => c.metric === 'growth_rate');
      expect(growthComparison?.context).toContain('150.0%');
    });
  });

  describe('Summary Generation', () => {
    it('should generate comprehensive performance summary', async () => {
      const result = await comparator.compareMetrics(sampleCompanyMetrics, sampleBenchmarkData);

      expect(result.summary).toContain(result.performanceCategory);
      expect(result.summary).toContain(result.overallScore.toString());
      expect(result.summary.length).toBeGreaterThan(50);
    });

    it('should highlight top performers and concerns', async () => {
      // Create metrics with clear strengths and weaknesses
      const mixedMetrics = {
        ...sampleCompanyMetrics,
        revenue: {
          ...sampleCompanyMetrics.revenue,
          arr: 8000000, // Very high
          growthRate: 0.3 // Very low
        }
      };

      const result = await comparator.compareMetrics(mixedMetrics, sampleBenchmarkData);

      expect(result.summary).toContain('Strong performance');
      expect(result.summary).toContain('Areas for improvement');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metrics gracefully', async () => {
      const incompleteMetrics = {
        ...sampleCompanyMetrics,
        revenue: {
          // Missing ARR
          growthRate: 1.5
        }
      };

      const result = await comparator.compareMetrics(incompleteMetrics, sampleBenchmarkData);

      expect(result.comparisons.length).toBeLessThan(8);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should handle missing benchmark data gracefully', async () => {
      const incompleteBenchmarks = {
        ...sampleBenchmarkData,
        metrics: {
          arr: sampleBenchmarkData.metrics.arr
          // Missing other metrics
        }
      };

      const result = await comparator.compareMetrics(sampleCompanyMetrics, incompleteBenchmarks);

      expect(result.comparisons.length).toBe(1);
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });
});