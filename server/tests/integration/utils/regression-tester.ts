/**
 * Regression Test Runner
 * 
 * This utility class manages regression testing for deal memo analysis accuracy.
 * It tracks performance over time and detects degradation in analysis quality.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RegressionTestResult {
  testCase: string;
  currentScore: number;
  expectedScore: number;
  regression: boolean;
  timestamp: Date;
  metadata: {
    version: string;
    environment: string;
    configuration: any;
  };
}

export interface RegressionAnalysis {
  hasRegression: boolean;
  overallTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  significantRegressions: RegressionTestResult[];
  performanceMetrics: {
    averageScore: number;
    scoreVariance: number;
    regressionCount: number;
    improvementCount: number;
  };
  recommendations: string[];
}

export interface TrendAnalysis {
  dataPoints: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  confidence: number;
  trendLine: {
    slope: number;
    intercept: number;
    rSquared: number;
  };
  declineRate?: number;
  improvementRate?: number;
  projectedScore?: number;
}

export interface HistoricalDataPoint {
  timestamp: Date;
  overallScore: number;
  testResults: RegressionTestResult[];
  systemMetrics: {
    processingTime: number;
    memoryUsage: number;
    errorRate: number;
  };
}

export class RegressionTestRunner {
  private dataPath: string;
  private configPath: string;
  private regressionThreshold: number;

  constructor(options: {
    dataPath?: string;
    regressionThreshold?: number;
  } = {}) {
    this.dataPath = options.dataPath || path.join(__dirname, '../data/regression-data.json');
    this.configPath = path.join(__dirname, '../config/regression-config.json');
    this.regressionThreshold = options.regressionThreshold || 0.1; // 10% threshold
  }

  /**
   * Analyze current results against baseline
   */
  async analyzeResults(
    currentResults: RegressionTestResult[],
    baselineResults: RegressionTestResult[]
  ): Promise<RegressionAnalysis> {
    const significantRegressions = this.identifyRegressions(currentResults, baselineResults);
    const performanceMetrics = this.calculatePerformanceMetrics(currentResults, baselineResults);
    const overallTrend = this.determineOverallTrend(currentResults, baselineResults);
    const recommendations = this.generateRecommendations(significantRegressions, performanceMetrics);

    return {
      hasRegression: significantRegressions.length > 0,
      overallTrend,
      significantRegressions,
      performanceMetrics,
      recommendations,
    };
  }

  /**
   * Get historical performance data
   */
  async getHistoricalData(): Promise<HistoricalDataPoint[]> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8');
      const historicalData = JSON.parse(data);
      
      return historicalData.map((point: any) => ({
        ...point,
        timestamp: new Date(point.timestamp),
      }));
    } catch (error) {
      console.warn('No historical data found, starting fresh');
      return [];
    }
  }

  /**
   * Run current analysis and return results
   */
  async runCurrentAnalysis(): Promise<HistoricalDataPoint> {
    // This would typically run the full test suite and collect results
    // For now, we'll return a mock result
    const testResults = await this.executeRegressionTests();
    const systemMetrics = await this.collectSystemMetrics();
    const overallScore = this.calculateOverallScore(testResults);

    return {
      timestamp: new Date(),
      overallScore,
      testResults,
      systemMetrics,
    };
  }

  /**
   * Analyze trends over time
   */
  async analyzeTrends(
    historicalData: HistoricalDataPoint[],
    currentData: HistoricalDataPoint
  ): Promise<TrendAnalysis> {
    const allData = [...historicalData, currentData];
    
    if (allData.length < 3) {
      return {
        dataPoints: allData.length,
        trend: 'STABLE',
        confidence: 0.0,
        trendLine: { slope: 0, intercept: 0, rSquared: 0 },
      };
    }

    const trendLine = this.calculateTrendLine(allData);
    const trend = this.determineTrend(trendLine.slope);
    const confidence = this.calculateTrendConfidence(trendLine.rSquared, allData.length);

    const analysis: TrendAnalysis = {
      dataPoints: allData.length,
      trend,
      confidence,
      trendLine,
    };

    if (trend === 'DECLINING') {
      analysis.declineRate = Math.abs(trendLine.slope);
    } else if (trend === 'IMPROVING') {
      analysis.improvementRate = trendLine.slope;
    }

    // Project future score based on trend
    if (confidence > 0.7) {
      const futureTimestamp = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
      analysis.projectedScore = trendLine.slope * futureTimestamp + trendLine.intercept;
    }

    return analysis;
  }

  /**
   * Store current results for future regression testing
   */
  async storeResults(results: HistoricalDataPoint): Promise<void> {
    try {
      const historicalData = await this.getHistoricalData();
      historicalData.push(results);

      // Keep only last 100 data points to manage file size
      const trimmedData = historicalData.slice(-100);

      await this.ensureDataDirectory();
      await fs.writeFile(this.dataPath, JSON.stringify(trimmedData, null, 2));
      
      console.log(`Stored regression test results: ${results.overallScore.toFixed(3)}`);
    } catch (error) {
      console.error('Failed to store regression test results:', error);
    }
  }

  /**
   * Generate regression test report
   */
  async generateReport(analysis: RegressionAnalysis): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        hasRegression: analysis.hasRegression,
        overallTrend: analysis.overallTrend,
        regressionCount: analysis.significantRegressions.length,
        averageScore: analysis.performanceMetrics.averageScore,
      },
      regressions: analysis.significantRegressions.map(r => ({
        testCase: r.testCase,
        currentScore: r.currentScore,
        expectedScore: r.expectedScore,
        degradation: ((r.expectedScore - r.currentScore) / r.expectedScore * 100).toFixed(1) + '%',
      })),
      recommendations: analysis.recommendations,
      performanceMetrics: analysis.performanceMetrics,
    };

    const reportPath = path.join(__dirname, '../reports/regression-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }

  /**
   * Compare with previous version
   */
  async compareWithPreviousVersion(
    currentVersion: string,
    previousVersion: string
  ): Promise<{
    improvement: number;
    degradation: number;
    changedTests: string[];
    recommendation: 'DEPLOY' | 'INVESTIGATE' | 'ROLLBACK';
  }> {
    const currentData = await this.getVersionData(currentVersion);
    const previousData = await this.getVersionData(previousVersion);

    if (!currentData || !previousData) {
      throw new Error('Version data not found for comparison');
    }

    const comparison = this.compareVersions(currentData, previousData);
    const recommendation = this.getDeploymentRecommendation(comparison);

    return {
      ...comparison,
      recommendation,
    };
  }

  // Private helper methods

  private identifyRegressions(
    currentResults: RegressionTestResult[],
    baselineResults: RegressionTestResult[]
  ): RegressionTestResult[] {
    const regressions: RegressionTestResult[] = [];
    const baselineMap = new Map(baselineResults.map(r => [r.testCase, r]));

    for (const current of currentResults) {
      const baseline = baselineMap.get(current.testCase);
      if (baseline) {
        const degradation = (baseline.currentScore - current.currentScore) / baseline.currentScore;
        if (degradation > this.regressionThreshold) {
          regressions.push({
            ...current,
            regression: true,
          });
        }
      }
    }

    return regressions;
  }

  private calculatePerformanceMetrics(
    currentResults: RegressionTestResult[],
    baselineResults: RegressionTestResult[]
  ): RegressionAnalysis['performanceMetrics'] {
    const currentScores = currentResults.map(r => r.currentScore);
    const averageScore = currentScores.reduce((sum, score) => sum + score, 0) / currentScores.length;
    
    const variance = currentScores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / currentScores.length;
    
    let regressionCount = 0;
    let improvementCount = 0;
    
    const baselineMap = new Map(baselineResults.map(r => [r.testCase, r]));
    
    for (const current of currentResults) {
      const baseline = baselineMap.get(current.testCase);
      if (baseline) {
        if (current.currentScore < baseline.currentScore * (1 - this.regressionThreshold)) {
          regressionCount++;
        } else if (current.currentScore > baseline.currentScore * (1 + this.regressionThreshold)) {
          improvementCount++;
        }
      }
    }

    return {
      averageScore,
      scoreVariance: variance,
      regressionCount,
      improvementCount,
    };
  }

  private determineOverallTrend(
    currentResults: RegressionTestResult[],
    baselineResults: RegressionTestResult[]
  ): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    const currentAvg = currentResults.reduce((sum, r) => sum + r.currentScore, 0) / currentResults.length;
    const baselineAvg = baselineResults.reduce((sum, r) => sum + r.currentScore, 0) / baselineResults.length;
    
    const change = (currentAvg - baselineAvg) / baselineAvg;
    
    if (change > this.regressionThreshold) {
      return 'IMPROVING';
    } else if (change < -this.regressionThreshold) {
      return 'DECLINING';
    } else {
      return 'STABLE';
    }
  }

  private generateRecommendations(
    regressions: RegressionTestResult[],
    metrics: RegressionAnalysis['performanceMetrics']
  ): string[] {
    const recommendations: string[] = [];

    if (regressions.length > 0) {
      recommendations.push(`Address ${regressions.length} significant regression(s) before deployment`);
      
      if (regressions.length > 3) {
        recommendations.push('Consider rolling back recent changes and investigating root cause');
      }
    }

    if (metrics.scoreVariance > 0.1) {
      recommendations.push('High score variance detected - review test consistency and data quality');
    }

    if (metrics.averageScore < 0.7) {
      recommendations.push('Overall performance below acceptable threshold - comprehensive review needed');
    }

    if (metrics.regressionCount > metrics.improvementCount * 2) {
      recommendations.push('More regressions than improvements - investigate recent changes');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is stable - safe to proceed with deployment');
    }

    return recommendations;
  }

  private calculateTrendLine(data: HistoricalDataPoint[]): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.overallScore);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, val, i) => sum + Math.pow(val - (slope * x[i] + intercept), 2), 0);
    const ssTot = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return { slope, intercept, rSquared };
  }

  private determineTrend(slope: number): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    const threshold = 0.001; // Minimum slope to consider significant
    
    if (slope > threshold) {
      return 'IMPROVING';
    } else if (slope < -threshold) {
      return 'DECLINING';
    } else {
      return 'STABLE';
    }
  }

  private calculateTrendConfidence(rSquared: number, dataPoints: number): number {
    // Confidence based on R-squared and sample size
    const sampleSizeBonus = Math.min(dataPoints / 20, 1); // Bonus for larger sample sizes
    return Math.min(rSquared * sampleSizeBonus, 1);
  }

  private async executeRegressionTests(): Promise<RegressionTestResult[]> {
    // Mock implementation - in reality, this would run actual tests
    const testCases = [
      'saas-company-analysis',
      'hardware-startup-analysis',
      'marketplace-analysis',
      'fintech-analysis',
      'healthcare-analysis',
    ];

    return testCases.map(testCase => ({
      testCase,
      currentScore: 0.75 + Math.random() * 0.2, // Mock score between 0.75-0.95
      expectedScore: 0.8,
      regression: false,
      timestamp: new Date(),
      metadata: {
        version: '1.0.0',
        environment: 'test',
        configuration: {},
      },
    }));
  }

  private async collectSystemMetrics(): Promise<HistoricalDataPoint['systemMetrics']> {
    // Mock implementation - in reality, this would collect actual system metrics
    return {
      processingTime: 2000 + Math.random() * 1000,
      memoryUsage: 150 + Math.random() * 50,
      errorRate: Math.random() * 0.05,
    };
  }

  private calculateOverallScore(testResults: RegressionTestResult[]): number {
    return testResults.reduce((sum, result) => sum + result.currentScore, 0) / testResults.length;
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.dataPath);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async getVersionData(version: string): Promise<HistoricalDataPoint | null> {
    try {
      const versionPath = path.join(path.dirname(this.dataPath), `version-${version}.json`);
      const data = await fs.readFile(versionPath, 'utf-8');
      const versionData = JSON.parse(data);
      return {
        ...versionData,
        timestamp: new Date(versionData.timestamp),
      };
    } catch {
      return null;
    }
  }

  private compareVersions(
    currentData: HistoricalDataPoint,
    previousData: HistoricalDataPoint
  ): {
    improvement: number;
    degradation: number;
    changedTests: string[];
  } {
    const improvement = Math.max(0, currentData.overallScore - previousData.overallScore);
    const degradation = Math.max(0, previousData.overallScore - currentData.overallScore);
    
    const currentTestMap = new Map(currentData.testResults.map(r => [r.testCase, r]));
    const previousTestMap = new Map(previousData.testResults.map(r => [r.testCase, r]));
    
    const changedTests: string[] = [];
    
    for (const [testCase, currentResult] of currentTestMap) {
      const previousResult = previousTestMap.get(testCase);
      if (previousResult && Math.abs(currentResult.currentScore - previousResult.currentScore) > 0.05) {
        changedTests.push(testCase);
      }
    }

    return { improvement, degradation, changedTests };
  }

  private getDeploymentRecommendation(comparison: {
    improvement: number;
    degradation: number;
    changedTests: string[];
  }): 'DEPLOY' | 'INVESTIGATE' | 'ROLLBACK' {
    if (comparison.degradation > 0.1) {
      return 'ROLLBACK';
    } else if (comparison.degradation > 0.05 || comparison.changedTests.length > 3) {
      return 'INVESTIGATE';
    } else {
      return 'DEPLOY';
    }
  }
}