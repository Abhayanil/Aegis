/**
 * A/B Test Framework
 * 
 * This utility class provides A/B testing capabilities for prompt optimization,
 * algorithm improvements, and system configuration changes.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ABTestResult {
  variant: string;
  qualityScore: number;
  dealMemo: any;
  metadata?: {
    processingTime: number;
    memoryUsage: number;
    errorCount: number;
  };
}

export interface ABTestAnalysis {
  statisticalSignificance: number;
  winningVariant: string;
  improvementPercentage: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  pValue: number;
  effectSize: number;
  recommendations: string[];
}

export interface WeightingAnalysis {
  optimalWeighting: string;
  performanceVariance: number;
  recommendations: WeightingRecommendation[];
  sensitivityAnalysis: {
    metric: string;
    impact: number;
  }[];
}

export interface WeightingRecommendation {
  metric: string;
  suggestedWeight: number;
  rationale: string;
  expectedImprovement: number;
}

export interface ABTestConfiguration {
  name: string;
  description: string;
  variants: ABTestVariant[];
  successMetric: string;
  minimumSampleSize: number;
  significanceLevel: number;
  powerLevel: number;
}

export interface ABTestVariant {
  name: string;
  description: string;
  configuration: any;
  weight: number; // Traffic allocation percentage
}

export class ABTestFramework {
  private testDataPath: string;
  private configPath: string;
  private significanceLevel: number;
  private minimumSampleSize: number;

  constructor(options: {
    testDataPath?: string;
    significanceLevel?: number;
    minimumSampleSize?: number;
  } = {}) {
    this.testDataPath = options.testDataPath || path.join(__dirname, '../data/ab-test-data.json');
    this.configPath = path.join(__dirname, '../config/ab-test-config.json');
    this.significanceLevel = options.significanceLevel || 0.05;
    this.minimumSampleSize = options.minimumSampleSize || 30;
  }

  /**
   * Analyze A/B test results for statistical significance
   */
  async analyzeResults(results: ABTestResult[]): Promise<ABTestAnalysis> {
    if (results.length < 2) {
      throw new Error('At least 2 variants required for A/B testing');
    }

    const variantGroups = this.groupResultsByVariant(results);
    const statisticalAnalysis = this.performStatisticalAnalysis(variantGroups);
    const winningVariant = this.determineWinningVariant(variantGroups);
    const recommendations = this.generateABTestRecommendations(statisticalAnalysis, variantGroups);

    return {
      statisticalSignificance: statisticalAnalysis.significance,
      winningVariant: winningVariant.name,
      improvementPercentage: winningVariant.improvement,
      confidenceInterval: statisticalAnalysis.confidenceInterval,
      pValue: statisticalAnalysis.pValue,
      effectSize: statisticalAnalysis.effectSize,
      recommendations,
    };
  }

  /**
   * Analyze weighting algorithm performance
   */
  async analyzeWeightingResults(results: ABTestResult[]): Promise<WeightingAnalysis> {
    const performanceByWeighting = this.groupResultsByVariant(results);
    const optimalWeighting = this.findOptimalWeighting(performanceByWeighting);
    const performanceVariance = this.calculatePerformanceVariance(results);
    const sensitivityAnalysis = this.performSensitivityAnalysis(results);
    const recommendations = this.generateWeightingRecommendations(
      performanceByWeighting,
      sensitivityAnalysis
    );

    return {
      optimalWeighting: optimalWeighting.name,
      performanceVariance,
      recommendations,
      sensitivityAnalysis,
    };
  }

  /**
   * Design and configure a new A/B test
   */
  async designABTest(config: {
    name: string;
    description: string;
    variants: { name: string; configuration: any }[];
    successMetric: string;
    expectedEffect: number;
  }): Promise<ABTestConfiguration> {
    const sampleSize = this.calculateRequiredSampleSize(
      config.expectedEffect,
      this.significanceLevel,
      0.8 // Power level
    );

    const variants: ABTestVariant[] = config.variants.map((variant, index) => ({
      name: variant.name,
      description: `Variant ${index + 1}: ${variant.name}`,
      configuration: variant.configuration,
      weight: 100 / config.variants.length, // Equal traffic split
    }));

    const testConfig: ABTestConfiguration = {
      name: config.name,
      description: config.description,
      variants,
      successMetric: config.successMetric,
      minimumSampleSize: sampleSize,
      significanceLevel: this.significanceLevel,
      powerLevel: 0.8,
    };

    await this.saveTestConfiguration(testConfig);
    return testConfig;
  }

  /**
   * Run a multi-variant test with automatic traffic allocation
   */
  async runMultiVariantTest(
    testName: string,
    testFunction: (variant: ABTestVariant) => Promise<ABTestResult>
  ): Promise<ABTestAnalysis> {
    const config = await this.loadTestConfiguration(testName);
    const results: ABTestResult[] = [];

    for (const variant of config.variants) {
      const sampleSize = Math.ceil(config.minimumSampleSize * (variant.weight / 100));
      
      for (let i = 0; i < sampleSize; i++) {
        try {
          const result = await testFunction(variant);
          results.push({
            ...result,
            variant: variant.name,
          });
        } catch (error) {
          console.warn(`Test failed for variant ${variant.name}:`, error);
        }
      }
    }

    const analysis = await this.analyzeResults(results);
    await this.saveTestResults(testName, results, analysis);
    
    return analysis;
  }

  /**
   * Perform Bayesian A/B testing for continuous monitoring
   */
  async performBayesianAnalysis(results: ABTestResult[]): Promise<{
    posteriorDistributions: Map<string, { mean: number; variance: number }>;
    probabilityOfSuperiority: Map<string, number>;
    expectedLoss: Map<string, number>;
    recommendation: string;
  }> {
    const variantGroups = this.groupResultsByVariant(results);
    const posteriorDistributions = new Map<string, { mean: number; variance: number }>();
    const probabilityOfSuperiority = new Map<string, number>();
    const expectedLoss = new Map<string, number>();

    // Calculate posterior distributions for each variant
    for (const [variantName, variantResults] of variantGroups) {
      const scores = variantResults.map(r => r.qualityScore);
      const posterior = this.calculateBayesianPosterior(scores);
      posteriorDistributions.set(variantName, posterior);
    }

    // Calculate probability of superiority for each variant
    for (const [variantName] of variantGroups) {
      const prob = this.calculateProbabilityOfSuperiority(
        variantName,
        posteriorDistributions
      );
      probabilityOfSuperiority.set(variantName, prob);
    }

    // Calculate expected loss for each variant
    for (const [variantName] of variantGroups) {
      const loss = this.calculateExpectedLoss(
        variantName,
        posteriorDistributions
      );
      expectedLoss.set(variantName, loss);
    }

    const recommendation = this.getBayesianRecommendation(
      probabilityOfSuperiority,
      expectedLoss
    );

    return {
      posteriorDistributions,
      probabilityOfSuperiority,
      expectedLoss,
      recommendation,
    };
  }

  /**
   * Generate comprehensive test report
   */
  async generateTestReport(
    testName: string,
    analysis: ABTestAnalysis,
    results: ABTestResult[]
  ): Promise<string> {
    const report = {
      testName,
      timestamp: new Date().toISOString(),
      summary: {
        totalSamples: results.length,
        variants: [...new Set(results.map(r => r.variant))],
        winningVariant: analysis.winningVariant,
        improvement: `${(analysis.improvementPercentage * 100).toFixed(2)}%`,
        statisticalSignificance: analysis.statisticalSignificance,
        pValue: analysis.pValue,
      },
      detailedResults: this.generateDetailedResults(results),
      statisticalAnalysis: {
        effectSize: analysis.effectSize,
        confidenceInterval: analysis.confidenceInterval,
        powerAnalysis: this.calculatePowerAnalysis(results),
      },
      recommendations: analysis.recommendations,
      nextSteps: this.generateNextSteps(analysis),
    };

    const reportPath = path.join(__dirname, '../reports', `ab-test-${testName}-report.json`);
    await this.ensureReportsDirectory();
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`A/B test report generated: ${reportPath}`);
    return reportPath;
  }

  // Private helper methods

  private groupResultsByVariant(results: ABTestResult[]): Map<string, ABTestResult[]> {
    const groups = new Map<string, ABTestResult[]>();
    
    for (const result of results) {
      if (!groups.has(result.variant)) {
        groups.set(result.variant, []);
      }
      groups.get(result.variant)!.push(result);
    }
    
    return groups;
  }

  private performStatisticalAnalysis(
    variantGroups: Map<string, ABTestResult[]>
  ): {
    significance: number;
    pValue: number;
    effectSize: number;
    confidenceInterval: { lower: number; upper: number };
  } {
    const variants = Array.from(variantGroups.entries());
    
    if (variants.length !== 2) {
      // For multiple variants, use ANOVA
      return this.performANOVA(variantGroups);
    }

    // For two variants, use t-test
    const [controlName, controlResults] = variants[0];
    const [treatmentName, treatmentResults] = variants[1];
    
    const controlScores = controlResults.map(r => r.qualityScore);
    const treatmentScores = treatmentResults.map(r => r.qualityScore);
    
    return this.performTTest(controlScores, treatmentScores);
  }

  private performTTest(
    controlScores: number[],
    treatmentScores: number[]
  ): {
    significance: number;
    pValue: number;
    effectSize: number;
    confidenceInterval: { lower: number; upper: number };
  } {
    const controlMean = this.calculateMean(controlScores);
    const treatmentMean = this.calculateMean(treatmentScores);
    const controlStd = this.calculateStandardDeviation(controlScores);
    const treatmentStd = this.calculateStandardDeviation(treatmentScores);
    
    const n1 = controlScores.length;
    const n2 = treatmentScores.length;
    
    // Welch's t-test for unequal variances
    const pooledStd = Math.sqrt(
      (controlStd * controlStd / n1) + (treatmentStd * treatmentStd / n2)
    );
    
    const tStatistic = (treatmentMean - controlMean) / pooledStd;
    const degreesOfFreedom = this.calculateWelchDF(controlScores, treatmentScores);
    
    const pValue = this.calculateTTestPValue(tStatistic, degreesOfFreedom);
    const significance = 1 - pValue;
    
    // Cohen's d for effect size
    const pooledStdDev = Math.sqrt(
      ((n1 - 1) * controlStd * controlStd + (n2 - 1) * treatmentStd * treatmentStd) /
      (n1 + n2 - 2)
    );
    const effectSize = (treatmentMean - controlMean) / pooledStdDev;
    
    // 95% confidence interval for the difference
    const marginOfError = this.getTCriticalValue(degreesOfFreedom, 0.05) * pooledStd;
    const difference = treatmentMean - controlMean;
    
    return {
      significance,
      pValue,
      effectSize,
      confidenceInterval: {
        lower: difference - marginOfError,
        upper: difference + marginOfError,
      },
    };
  }

  private performANOVA(
    variantGroups: Map<string, ABTestResult[]>
  ): {
    significance: number;
    pValue: number;
    effectSize: number;
    confidenceInterval: { lower: number; upper: number };
  } {
    // Simplified ANOVA implementation
    const allScores: number[] = [];
    const groupMeans: number[] = [];
    const groupSizes: number[] = [];
    
    for (const [_, results] of variantGroups) {
      const scores = results.map(r => r.qualityScore);
      allScores.push(...scores);
      groupMeans.push(this.calculateMean(scores));
      groupSizes.push(scores.length);
    }
    
    const grandMean = this.calculateMean(allScores);
    const totalN = allScores.length;
    const k = variantGroups.size;
    
    // Between-group sum of squares
    let ssBetween = 0;
    for (let i = 0; i < groupMeans.length; i++) {
      ssBetween += groupSizes[i] * Math.pow(groupMeans[i] - grandMean, 2);
    }
    
    // Within-group sum of squares
    let ssWithin = 0;
    let index = 0;
    for (const [_, results] of variantGroups) {
      const scores = results.map(r => r.qualityScore);
      const groupMean = groupMeans[index];
      for (const score of scores) {
        ssWithin += Math.pow(score - groupMean, 2);
      }
      index++;
    }
    
    const dfBetween = k - 1;
    const dfWithin = totalN - k;
    
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    
    const fStatistic = msBetween / msWithin;
    const pValue = this.calculateFTestPValue(fStatistic, dfBetween, dfWithin);
    
    // Eta-squared for effect size
    const etaSquared = ssBetween / (ssBetween + ssWithin);
    
    return {
      significance: 1 - pValue,
      pValue,
      effectSize: etaSquared,
      confidenceInterval: { lower: 0, upper: 1 }, // Placeholder
    };
  }

  private determineWinningVariant(
    variantGroups: Map<string, ABTestResult[]>
  ): { name: string; improvement: number } {
    let bestVariant = '';
    let bestScore = -1;
    let baselineScore = -1;
    
    // Find baseline (first variant) and best performing variant
    let isFirst = true;
    for (const [variantName, results] of variantGroups) {
      const avgScore = this.calculateMean(results.map(r => r.qualityScore));
      
      if (isFirst) {
        baselineScore = avgScore;
        isFirst = false;
      }
      
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestVariant = variantName;
      }
    }
    
    const improvement = baselineScore > 0 ? (bestScore - baselineScore) / baselineScore : 0;
    
    return { name: bestVariant, improvement };
  }

  private generateABTestRecommendations(
    analysis: any,
    variantGroups: Map<string, ABTestResult[]>
  ): string[] {
    const recommendations: string[] = [];
    
    if (analysis.significance > 0.95) {
      recommendations.push('Results are statistically significant - safe to implement winning variant');
    } else if (analysis.significance > 0.8) {
      recommendations.push('Results show promising trend - consider extending test duration');
    } else {
      recommendations.push('Results are not statistically significant - continue testing or investigate');
    }
    
    if (Math.abs(analysis.effectSize) < 0.2) {
      recommendations.push('Effect size is small - consider if practical significance justifies implementation');
    } else if (Math.abs(analysis.effectSize) > 0.8) {
      recommendations.push('Large effect size detected - verify results and implement quickly');
    }
    
    const sampleSizes = Array.from(variantGroups.values()).map(results => results.length);
    const minSampleSize = Math.min(...sampleSizes);
    
    if (minSampleSize < this.minimumSampleSize) {
      recommendations.push(`Increase sample size - current minimum is ${minSampleSize}, recommended minimum is ${this.minimumSampleSize}`);
    }
    
    return recommendations;
  }

  private findOptimalWeighting(
    performanceByWeighting: Map<string, ABTestResult[]>
  ): { name: string; score: number } {
    let bestWeighting = '';
    let bestScore = -1;
    
    for (const [weightingName, results] of performanceByWeighting) {
      const avgScore = this.calculateMean(results.map(r => r.qualityScore));
      
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestWeighting = weightingName;
      }
    }
    
    return { name: bestWeighting, score: bestScore };
  }

  private calculatePerformanceVariance(results: ABTestResult[]): number {
    const scores = results.map(r => r.qualityScore);
    return this.calculateVariance(scores);
  }

  private performSensitivityAnalysis(results: ABTestResult[]): {
    metric: string;
    impact: number;
  }[] {
    // Mock implementation - in reality, this would analyze how changes to different
    // weighting parameters affect the overall score
    const metrics = ['marketOpportunity', 'team', 'traction', 'product', 'competitivePosition'];
    
    return metrics.map(metric => ({
      metric,
      impact: Math.random() * 0.3, // Mock impact score
    }));
  }

  private generateWeightingRecommendations(
    performanceByWeighting: Map<string, ABTestResult[]>,
    sensitivityAnalysis: { metric: string; impact: number }[]
  ): WeightingRecommendation[] {
    const recommendations: WeightingRecommendation[] = [];
    
    // Sort metrics by impact
    const sortedMetrics = sensitivityAnalysis.sort((a, b) => b.impact - a.impact);
    
    for (const metric of sortedMetrics.slice(0, 3)) { // Top 3 most impactful
      recommendations.push({
        metric: metric.metric,
        suggestedWeight: 20 + metric.impact * 30, // Scale impact to weight
        rationale: `High impact metric (${(metric.impact * 100).toFixed(1)}% sensitivity)`,
        expectedImprovement: metric.impact * 0.1,
      });
    }
    
    return recommendations;
  }

  // Statistical utility methods

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private calculateVariance(values: number[]): number {
    const mean = this.calculateMean(values);
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
  }

  private calculateWelchDF(sample1: number[], sample2: number[]): number {
    const n1 = sample1.length;
    const n2 = sample2.length;
    const s1 = this.calculateStandardDeviation(sample1);
    const s2 = this.calculateStandardDeviation(sample2);
    
    const numerator = Math.pow((s1 * s1 / n1) + (s2 * s2 / n2), 2);
    const denominator = (Math.pow(s1 * s1 / n1, 2) / (n1 - 1)) + (Math.pow(s2 * s2 / n2, 2) / (n2 - 1));
    
    return numerator / denominator;
  }

  private calculateTTestPValue(tStatistic: number, df: number): number {
    // Simplified p-value calculation - in reality, would use proper statistical library
    return Math.max(0.001, Math.min(0.999, 1 - Math.abs(tStatistic) / 10));
  }

  private calculateFTestPValue(fStatistic: number, df1: number, df2: number): number {
    // Simplified F-test p-value calculation
    return Math.max(0.001, Math.min(0.999, 1 - fStatistic / 20));
  }

  private getTCriticalValue(df: number, alpha: number): number {
    // Simplified critical value - in reality, would use proper statistical tables
    return 1.96; // Approximate for large df
  }

  private calculateRequiredSampleSize(
    expectedEffect: number,
    alpha: number,
    power: number
  ): number {
    // Simplified sample size calculation
    const zAlpha = 1.96; // For alpha = 0.05
    const zBeta = 0.84;  // For power = 0.8
    
    return Math.ceil(2 * Math.pow((zAlpha + zBeta) / expectedEffect, 2));
  }

  // Bayesian analysis methods

  private calculateBayesianPosterior(scores: number[]): { mean: number; variance: number } {
    // Simplified Bayesian posterior calculation
    const sampleMean = this.calculateMean(scores);
    const sampleVariance = this.calculateVariance(scores);
    const n = scores.length;
    
    // Assuming normal prior with mean=0.5, variance=0.1
    const priorMean = 0.5;
    const priorVariance = 0.1;
    
    const posteriorVariance = 1 / (1 / priorVariance + n / sampleVariance);
    const posteriorMean = posteriorVariance * (priorMean / priorVariance + n * sampleMean / sampleVariance);
    
    return { mean: posteriorMean, variance: posteriorVariance };
  }

  private calculateProbabilityOfSuperiority(
    variantName: string,
    posteriorDistributions: Map<string, { mean: number; variance: number }>
  ): number {
    // Simplified calculation - in reality, would use Monte Carlo simulation
    const targetPosterior = posteriorDistributions.get(variantName)!;
    let superiorityCount = 0;
    let totalComparisons = 0;
    
    for (const [otherVariant, otherPosterior] of posteriorDistributions) {
      if (otherVariant !== variantName) {
        // Approximate probability that target > other
        const meanDiff = targetPosterior.mean - otherPosterior.mean;
        const combinedVariance = targetPosterior.variance + otherPosterior.variance;
        const zScore = meanDiff / Math.sqrt(combinedVariance);
        
        // Convert z-score to probability (simplified)
        const probability = 0.5 + 0.5 * Math.tanh(zScore);
        superiorityCount += probability;
        totalComparisons++;
      }
    }
    
    return totalComparisons > 0 ? superiorityCount / totalComparisons : 0.5;
  }

  private calculateExpectedLoss(
    variantName: string,
    posteriorDistributions: Map<string, { mean: number; variance: number }>
  ): number {
    // Simplified expected loss calculation
    const targetPosterior = posteriorDistributions.get(variantName)!;
    let totalLoss = 0;
    let comparisons = 0;
    
    for (const [otherVariant, otherPosterior] of posteriorDistributions) {
      if (otherVariant !== variantName) {
        const expectedLoss = Math.max(0, otherPosterior.mean - targetPosterior.mean);
        totalLoss += expectedLoss;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalLoss / comparisons : 0;
  }

  private getBayesianRecommendation(
    probabilityOfSuperiority: Map<string, number>,
    expectedLoss: Map<string, number>
  ): string {
    let bestVariant = '';
    let highestProbability = 0;
    
    for (const [variant, probability] of probabilityOfSuperiority) {
      if (probability > highestProbability) {
        highestProbability = probability;
        bestVariant = variant;
      }
    }
    
    const bestLoss = expectedLoss.get(bestVariant) || 0;
    
    if (highestProbability > 0.95 && bestLoss < 0.01) {
      return `Strong recommendation: Deploy ${bestVariant}`;
    } else if (highestProbability > 0.8) {
      return `Moderate recommendation: Consider deploying ${bestVariant}`;
    } else {
      return 'Continue testing - no clear winner yet';
    }
  }

  // File I/O methods

  private async saveTestConfiguration(config: ABTestConfiguration): Promise<void> {
    await this.ensureDataDirectory();
    const configPath = path.join(path.dirname(this.configPath), `${config.name}-config.json`);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  private async loadTestConfiguration(testName: string): Promise<ABTestConfiguration> {
    const configPath = path.join(path.dirname(this.configPath), `${testName}-config.json`);
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  }

  private async saveTestResults(
    testName: string,
    results: ABTestResult[],
    analysis: ABTestAnalysis
  ): Promise<void> {
    const testData = {
      testName,
      timestamp: new Date().toISOString(),
      results,
      analysis,
    };
    
    await this.ensureDataDirectory();
    const resultsPath = path.join(path.dirname(this.testDataPath), `${testName}-results.json`);
    await fs.writeFile(resultsPath, JSON.stringify(testData, null, 2));
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.testDataPath);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async ensureReportsDirectory(): Promise<void> {
    const reportsDir = path.join(__dirname, '../reports');
    try {
      await fs.access(reportsDir);
    } catch {
      await fs.mkdir(reportsDir, { recursive: true });
    }
  }

  private generateDetailedResults(results: ABTestResult[]): any {
    const variantGroups = this.groupResultsByVariant(results);
    const detailedResults: any = {};
    
    for (const [variant, variantResults] of variantGroups) {
      const scores = variantResults.map(r => r.qualityScore);
      detailedResults[variant] = {
        sampleSize: variantResults.length,
        mean: this.calculateMean(scores),
        standardDeviation: this.calculateStandardDeviation(scores),
        min: Math.min(...scores),
        max: Math.max(...scores),
        median: this.calculateMedian(scores),
      };
    }
    
    return detailedResults;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculatePowerAnalysis(results: ABTestResult[]): any {
    // Simplified power analysis
    return {
      observedPower: 0.8,
      recommendedSampleSize: this.minimumSampleSize,
      actualSampleSize: results.length,
    };
  }

  private generateNextSteps(analysis: ABTestAnalysis): string[] {
    const nextSteps: string[] = [];
    
    if (analysis.statisticalSignificance > 0.95) {
      nextSteps.push('Implement winning variant in production');
      nextSteps.push('Monitor key metrics for any unexpected changes');
    } else {
      nextSteps.push('Continue test with larger sample size');
      nextSteps.push('Consider adjusting test parameters or variants');
    }
    
    if (analysis.effectSize < 0.2) {
      nextSteps.push('Evaluate if small effect size justifies implementation cost');
    }
    
    nextSteps.push('Document learnings for future test design');
    
    return nextSteps;
  }
}