// Metric comparison and percentile calculation service
import { InvestmentMetrics } from '../../models/InvestmentMetrics.js';
import { BenchmarkData, BenchmarkComparison } from '../../models/BenchmarkData.js';
import { MetricDistribution, PercentileRankings } from '../../types/interfaces.js';
import { logger } from '../../utils/logger.js';

export interface ComparisonOptions {
  includeInterpretation?: boolean;
  includeRecommendations?: boolean;
  significanceThreshold?: number; // Percentile difference to consider significant
  cacheResults?: boolean;
}

export interface MetricComparisonResult {
  comparisons: BenchmarkComparison[];
  percentileRankings: PercentileRankings;
  overallScore: number;
  performanceCategory: 'exceptional' | 'strong' | 'average' | 'below-average' | 'concerning';
  summary: string;
}

export interface CacheEntry {
  key: string;
  result: MetricComparisonResult;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
}

export class MetricComparator {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly defaultCacheTTL = 30 * 60 * 1000; // 30 minutes
  private readonly maxCacheSize = 1000;

  /**
   * Compare company metrics against sector benchmarks
   */
  async compareMetrics(
    companyMetrics: InvestmentMetrics,
    benchmarkData: BenchmarkData,
    options: ComparisonOptions = {}
  ): Promise<MetricComparisonResult> {
    const cacheKey = this.generateCacheKey(companyMetrics, benchmarkData, options);
    
    // Check cache first
    if (options.cacheResults !== false) {
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        logger.info('Returning cached metric comparison result');
        return cached;
      }
    }

    try {
      const comparisons = await this.generateComparisons(companyMetrics, benchmarkData, options);
      const percentileRankings = this.calculatePercentileRankings(companyMetrics, benchmarkData);
      const overallScore = this.calculateOverallScore(percentileRankings);
      const performanceCategory = this.categorizePerformance(overallScore);
      const summary = this.generateSummary(comparisons, overallScore, performanceCategory);

      const result: MetricComparisonResult = {
        comparisons,
        percentileRankings,
        overallScore,
        performanceCategory,
        summary
      };

      // Cache the result
      if (options.cacheResults !== false) {
        this.cacheResult(cacheKey, result);
      }

      logger.info(`Metric comparison completed. Overall score: ${overallScore}, Category: ${performanceCategory}`);
      return result;

    } catch (error) {
      logger.error('Error in metric comparison:', error);
      throw error;
    }
  }

  /**
   * Calculate percentile rankings for all metrics
   */
  calculatePercentileRankings(
    companyMetrics: InvestmentMetrics,
    benchmarkData: BenchmarkData
  ): PercentileRankings {
    const rankings: PercentileRankings = {};

    // Revenue metrics
    if (companyMetrics.revenue.arr && benchmarkData.metrics.arr) {
      rankings.arr = this.calculatePercentile(
        companyMetrics.revenue.arr,
        benchmarkData.metrics.arr,
        'Annual Recurring Revenue'
      );
    }

    if (companyMetrics.revenue.growthRate && benchmarkData.metrics.growth_rate) {
      rankings.growth_rate = this.calculatePercentile(
        companyMetrics.revenue.growthRate,
        benchmarkData.metrics.growth_rate,
        'Revenue Growth Rate'
      );
    }

    if (companyMetrics.revenue.grossMargin && benchmarkData.metrics.gross_margin) {
      rankings.gross_margin = this.calculatePercentile(
        companyMetrics.revenue.grossMargin,
        benchmarkData.metrics.gross_margin,
        'Gross Margin'
      );
    }

    // Traction metrics
    if (companyMetrics.traction.customers && benchmarkData.metrics.customers) {
      rankings.customers = this.calculatePercentile(
        companyMetrics.traction.customers,
        benchmarkData.metrics.customers,
        'Customer Count'
      );
    }

    if (companyMetrics.traction.churnRate && benchmarkData.metrics.churn_rate) {
      // For churn rate, lower is better, so invert the percentile
      const percentile = this.calculatePercentile(
        companyMetrics.traction.churnRate,
        benchmarkData.metrics.churn_rate,
        'Churn Rate'
      );
      rankings.churn_rate = {
        ...percentile,
        percentile: 100 - percentile.percentile,
        interpretation: this.interpretChurnPercentile(100 - percentile.percentile)
      };
    }

    if (companyMetrics.traction.ltvCacRatio && benchmarkData.metrics.ltv_cac_ratio) {
      rankings.ltv_cac_ratio = this.calculatePercentile(
        companyMetrics.traction.ltvCacRatio,
        benchmarkData.metrics.ltv_cac_ratio,
        'LTV/CAC Ratio'
      );
    }

    // Team metrics
    if (companyMetrics.team.size && benchmarkData.metrics.team_size) {
      rankings.team_size = this.calculatePercentile(
        companyMetrics.team.size,
        benchmarkData.metrics.team_size,
        'Team Size'
      );
    }

    // Funding metrics
    if (companyMetrics.funding.totalRaised && benchmarkData.metrics.total_raised) {
      rankings.total_raised = this.calculatePercentile(
        companyMetrics.funding.totalRaised,
        benchmarkData.metrics.total_raised,
        'Total Funding Raised'
      );
    }

    return rankings;
  }

  /**
   * Calculate percentile for a single metric
   */
  private calculatePercentile(
    value: number,
    distribution: MetricDistribution,
    metricName: string
  ): { value: number; percentile: number; interpretation: string } {
    let percentile: number;

    // Calculate percentile based on distribution
    if (value <= distribution.min) {
      percentile = 0;
    } else if (value >= distribution.max) {
      percentile = 100;
    } else if (value <= distribution.p25) {
      percentile = 25 * (value - distribution.min) / (distribution.p25 - distribution.min);
    } else if (value <= distribution.median) {
      percentile = 25 + 25 * (value - distribution.p25) / (distribution.median - distribution.p25);
    } else if (value <= distribution.p75) {
      percentile = 50 + 25 * (value - distribution.median) / (distribution.p75 - distribution.median);
    } else if (value <= distribution.p90) {
      percentile = 75 + 15 * (value - distribution.p75) / (distribution.p90 - distribution.p75);
    } else {
      percentile = 90 + 10 * (value - distribution.p90) / (distribution.max - distribution.p90);
    }

    percentile = Math.max(0, Math.min(100, percentile));

    return {
      value,
      percentile: Math.round(percentile * 10) / 10, // Round to 1 decimal place
      interpretation: this.interpretPercentile(percentile, metricName)
    };
  }

  /**
   * Generate detailed comparisons for each metric
   */
  private async generateComparisons(
    companyMetrics: InvestmentMetrics,
    benchmarkData: BenchmarkData,
    options: ComparisonOptions
  ): Promise<BenchmarkComparison[]> {
    const comparisons: BenchmarkComparison[] = [];
    const percentileRankings = this.calculatePercentileRankings(companyMetrics, benchmarkData);

    // Generate comparisons for each available metric
    for (const [metricKey, ranking] of Object.entries(percentileRankings)) {
      const distribution = benchmarkData.metrics[metricKey];
      if (!distribution) continue;

      const comparison: BenchmarkComparison = {
        metric: metricKey,
        companyValue: ranking.value,
        sectorMedian: distribution.median,
        percentile: ranking.percentile,
        interpretation: ranking.interpretation,
        context: this.generateContext(metricKey, ranking, distribution, benchmarkData)
      };

      if (options.includeRecommendations) {
        comparison.recommendation = this.generateRecommendation(metricKey, ranking, options);
      }

      comparisons.push(comparison);
    }

    // Sort by significance (distance from median)
    comparisons.sort((a, b) => {
      const aSignificance = Math.abs(a.percentile - 50);
      const bSignificance = Math.abs(b.percentile - 50);
      return bSignificance - aSignificance;
    });

    return comparisons;
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(percentileRankings: PercentileRankings): number {
    const weights = {
      arr: 0.25,
      growth_rate: 0.20,
      gross_margin: 0.15,
      customers: 0.10,
      churn_rate: 0.10,
      ltv_cac_ratio: 0.10,
      team_size: 0.05,
      total_raised: 0.05
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [metric, ranking] of Object.entries(percentileRankings)) {
      const weight = weights[metric as keyof typeof weights] || 0.01;
      weightedSum += ranking.percentile * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
  }

  /**
   * Categorize performance based on overall score
   */
  private categorizePerformance(score: number): 'exceptional' | 'strong' | 'average' | 'below-average' | 'concerning' {
    if (score >= 90) return 'exceptional';
    if (score >= 75) return 'strong';
    if (score >= 40) return 'average';
    if (score >= 25) return 'below-average';
    return 'concerning';
  }

  /**
   * Generate performance summary
   */
  private generateSummary(
    comparisons: BenchmarkComparison[],
    overallScore: number,
    category: string
  ): string {
    const topPerformers = comparisons.filter(c => c.percentile >= 75).slice(0, 3);
    const concerns = comparisons.filter(c => c.percentile <= 25).slice(0, 3);

    let summary = `Overall performance is ${category} (${overallScore}th percentile). `;

    if (topPerformers.length > 0) {
      const metrics = topPerformers.map(c => c.metric.replace('_', ' ')).join(', ');
      summary += `Strong performance in ${metrics}. `;
    }

    if (concerns.length > 0) {
      const metrics = concerns.map(c => c.metric.replace('_', ' ')).join(', ');
      summary += `Areas for improvement: ${metrics}.`;
    }

    return summary.trim();
  }

  /**
   * Generate context for a metric comparison
   */
  private generateContext(
    metricKey: string,
    ranking: { value: number; percentile: number; interpretation: string },
    distribution: MetricDistribution,
    benchmarkData: BenchmarkData
  ): string {
    const sampleSize = distribution.sampleSize;
    const sector = benchmarkData.sector;
    const stage = benchmarkData.stage || 'all stages';

    return `Based on ${sampleSize} ${sector} companies at ${stage}. ` +
           `Sector range: ${this.formatValue(metricKey, distribution.min)} - ${this.formatValue(metricKey, distribution.max)}. ` +
           `Your value (${this.formatValue(metricKey, ranking.value)}) is at the ${ranking.percentile}th percentile.`;
  }

  /**
   * Generate recommendation for a metric
   */
  private generateRecommendation(
    metricKey: string,
    ranking: { value: number; percentile: number; interpretation: string },
    options: ComparisonOptions
  ): string {
    const threshold = options.significanceThreshold || 25;
    
    if (ranking.percentile >= 75) {
      return `Excellent ${metricKey.replace('_', ' ')} performance. Maintain current strategies and consider sharing best practices.`;
    } else if (ranking.percentile <= threshold) {
      return this.getImprovementRecommendation(metricKey, ranking.percentile);
    } else {
      return `${metricKey.replace('_', ' ')} is within normal range. Monitor trends and benchmark regularly.`;
    }
  }

  /**
   * Get improvement recommendations for underperforming metrics
   */
  private getImprovementRecommendation(metricKey: string, percentile: number): string {
    const recommendations = {
      arr: 'Focus on customer acquisition and expansion. Review pricing strategy and product-market fit.',
      growth_rate: 'Accelerate growth through improved sales processes, marketing efficiency, and product development.',
      gross_margin: 'Optimize cost structure, improve pricing, and focus on higher-margin products/services.',
      customers: 'Enhance customer acquisition strategies, improve conversion rates, and expand market reach.',
      churn_rate: 'Improve customer success programs, product stickiness, and address retention issues.',
      ltv_cac_ratio: 'Optimize customer acquisition costs and increase customer lifetime value through retention and expansion.',
      team_size: 'Consider strategic hiring in key areas while maintaining capital efficiency.',
      total_raised: 'Evaluate funding needs and market conditions for potential fundraising.'
    };

    const baseRecommendation = recommendations[metricKey as keyof typeof recommendations] || 
                              `Focus on improving ${metricKey.replace('_', ' ')} through targeted initiatives.`;
    
    const urgency = percentile <= 10 ? 'Urgent attention required. ' : 'Priority improvement area. ';
    return urgency + baseRecommendation;
  }

  /**
   * Interpret percentile ranking
   */
  private interpretPercentile(percentile: number, metricName: string): string {
    if (percentile >= 90) return `Exceptional ${metricName.toLowerCase()} - top 10% of sector`;
    if (percentile >= 75) return `Strong ${metricName.toLowerCase()} - top quartile`;
    if (percentile >= 50) return `Above average ${metricName.toLowerCase()}`;
    if (percentile >= 25) return `Below average ${metricName.toLowerCase()}`;
    return `Concerning ${metricName.toLowerCase()} - bottom quartile`;
  }

  /**
   * Special interpretation for churn rate (lower is better)
   */
  private interpretChurnPercentile(percentile: number): string {
    if (percentile >= 90) return 'Excellent customer retention - top 10% of sector';
    if (percentile >= 75) return 'Strong customer retention - top quartile';
    if (percentile >= 50) return 'Above average customer retention';
    if (percentile >= 25) return 'Below average customer retention';
    return 'Concerning customer retention - bottom quartile';
  }

  /**
   * Format values for display
   */
  private formatValue(metricKey: string, value: number): string {
    switch (metricKey) {
      case 'arr':
      case 'total_raised':
        return `$${(value / 1000000).toFixed(1)}M`;
      case 'growth_rate':
      case 'gross_margin':
      case 'churn_rate':
        return `${(value * 100).toFixed(1)}%`;
      case 'ltv_cac_ratio':
        return `${value.toFixed(1)}x`;
      case 'customers':
      case 'team_size':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  }

  /**
   * Cache management methods
   */
  private generateCacheKey(
    companyMetrics: InvestmentMetrics,
    benchmarkData: BenchmarkData,
    options: ComparisonOptions
  ): string {
    const metricsHash = this.hashObject({
      arr: companyMetrics.revenue.arr,
      growth: companyMetrics.revenue.growthRate,
      customers: companyMetrics.traction.customers,
      churn: companyMetrics.traction.churnRate
    });
    
    const benchmarkHash = this.hashObject({
      sector: benchmarkData.sector,
      stage: benchmarkData.stage,
      updated: benchmarkData.lastUpdated.getTime()
    });

    const optionsHash = this.hashObject(options);
    
    return `${metricsHash}_${benchmarkHash}_${optionsHash}`;
  }

  private hashObject(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64').slice(0, 16);
  }

  private getCachedResult(key: string): MetricComparisonResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  private cacheResult(key: string, result: MetricComparisonResult, ttl?: number): void {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      key,
      result,
      timestamp: new Date(),
      ttl: ttl || this.defaultCacheTTL
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Metric comparison cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}