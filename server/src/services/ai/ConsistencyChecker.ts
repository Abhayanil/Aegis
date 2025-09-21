// Consistency checking service for cross-document validation
import { AnalysisResult } from '../../models/AnalysisResult.js';
import { InvestmentMetrics } from '../../models/InvestmentMetrics.js';
import { ProcessedDocument } from '../../models/ProcessedDocument.js';
import { ConsistencyIssue } from '../../types/interfaces.js';
import { RiskSeverity } from '../../types/enums.js';
import { logger } from '../../utils/logger.js';

export interface ConsistencyCheckResult {
  issues: ConsistencyIssue[];
  overallConsistencyScore: number;
  documentComparisons: DocumentComparison[];
  metricDiscrepancies: MetricDiscrepancy[];
  recommendations: string[];
}

export interface DocumentComparison {
  document1: string;
  document2: string;
  similarityScore: number;
  conflictingMetrics: string[];
  alignedMetrics: string[];
}

export interface MetricDiscrepancy {
  metricName: string;
  values: MetricValue[];
  discrepancyType: 'value_mismatch' | 'missing_data' | 'conflicting_claims' | 'temporal_inconsistency';
  severity: RiskSeverity;
  explanation: string;
  suggestedResolution: string;
}

export interface MetricValue {
  value: any;
  source: string;
  confidence: number;
  context: string;
  timestamp?: Date;
}

export interface ConsistencyCheckOptions {
  toleranceThreshold?: number; // Percentage tolerance for numeric differences
  requireAllDocuments?: boolean; // Whether all documents must contain the metric
  checkTemporalConsistency?: boolean; // Whether to check for timeline consistency
  prioritizeRecent?: boolean; // Whether to prioritize more recent data
  enableSemanticAnalysis?: boolean; // Whether to use AI for semantic consistency
}

export class ConsistencyChecker {
  private defaultOptions: ConsistencyCheckOptions;

  // Tolerance thresholds for different metric types
  private readonly tolerances = {
    financial: 0.05, // 5% tolerance for financial metrics
    percentage: 0.02, // 2% tolerance for percentages
    count: 0.1, // 10% tolerance for counts (customers, team size)
    date: 365 * 24 * 60 * 60 * 1000, // 1 year tolerance for dates
  };

  // Critical metrics that should be consistent across documents
  private readonly criticalMetrics = [
    'arr', 'mrr', 'customers', 'teamSize', 'foundersCount', 
    'totalRaised', 'valuation', 'foundedYear', 'churnRate'
  ];

  constructor(options: ConsistencyCheckOptions = {}) {
    this.defaultOptions = {
      toleranceThreshold: 0.1, // 10% default tolerance
      requireAllDocuments: false,
      checkTemporalConsistency: true,
      prioritizeRecent: true,
      enableSemanticAnalysis: false,
      ...options,
    };

    logger.info('ConsistencyChecker initialized successfully');
  }

  /**
   * Check consistency across multiple analysis results
   */
  async checkConsistency(
    analysisResults: AnalysisResult[],
    sourceDocuments: ProcessedDocument[],
    options?: ConsistencyCheckOptions
  ): Promise<ConsistencyCheckResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      logger.info(`Checking consistency across ${analysisResults.length} analysis results`);

      // Extract metrics from all analysis results
      const allMetrics = this.extractAllMetrics(analysisResults, sourceDocuments);

      // Perform different types of consistency checks
      const valueDiscrepancies = this.checkValueConsistency(allMetrics, opts);
      const missingDataIssues = this.checkMissingData(allMetrics, sourceDocuments, opts);
      const temporalIssues = opts.checkTemporalConsistency 
        ? this.checkTemporalConsistency(allMetrics, sourceDocuments)
        : [];

      // Combine all issues
      const allIssues = [
        ...this.convertDiscrepanciesToIssues(valueDiscrepancies),
        ...missingDataIssues,
        ...temporalIssues,
      ];

      // Calculate document comparisons
      const documentComparisons = this.compareDocuments(analysisResults, sourceDocuments);

      // Calculate overall consistency score
      const overallScore = this.calculateConsistencyScore(allIssues, analysisResults.length);

      // Generate recommendations
      const recommendations = this.generateRecommendations(allIssues, overallScore);

      logger.info(`Consistency check completed with score: ${overallScore}`);

      return {
        issues: allIssues,
        overallConsistencyScore: overallScore,
        documentComparisons,
        metricDiscrepancies: valueDiscrepancies,
        recommendations,
      };

    } catch (error) {
      logger.error('Consistency check failed:', error);
      throw error;
    }
  }

  /**
   * Extract all metrics from analysis results with source attribution
   */
  private extractAllMetrics(
    analysisResults: AnalysisResult[],
    sourceDocuments: ProcessedDocument[]
  ): Map<string, MetricValue[]> {
    const metricsMap = new Map<string, MetricValue[]>();

    analysisResults.forEach((result, index) => {
      const sourceDoc = sourceDocuments[index];
      const docName = sourceDoc?.metadata.filename || `Document ${index + 1}`;

      // Extract revenue metrics
      this.addMetricValues(metricsMap, result.extractedMetrics.revenue, docName, result.confidence);

      // Extract traction metrics
      this.addMetricValues(metricsMap, result.extractedMetrics.traction, docName, result.confidence);

      // Extract team metrics
      this.addMetricValues(metricsMap, result.extractedMetrics.team, docName, result.confidence);

      // Extract funding metrics
      this.addMetricValues(metricsMap, result.extractedMetrics.funding, docName, result.confidence);

      // Extract company profile data
      if (result.companyProfile.foundedYear) {
        this.addMetricValue(metricsMap, 'foundedYear', result.companyProfile.foundedYear, docName, result.confidence);
      }

      // Extract market claims
      if (result.marketClaims.tam) {
        this.addMetricValue(metricsMap, 'tam', result.marketClaims.tam, docName, result.confidence);
      }
      if (result.marketClaims.sam) {
        this.addMetricValue(metricsMap, 'sam', result.marketClaims.sam, docName, result.confidence);
      }
    });

    return metricsMap;
  }

  /**
   * Add metric values from an object to the metrics map
   */
  private addMetricValues(
    metricsMap: Map<string, MetricValue[]>,
    metricsObject: any,
    source: string,
    confidence: number
  ): void {
    Object.entries(metricsObject).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        this.addMetricValue(metricsMap, key, value, source, confidence);
      }
    });
  }

  /**
   * Add a single metric value to the metrics map
   */
  private addMetricValue(
    metricsMap: Map<string, MetricValue[]>,
    metricName: string,
    value: any,
    source: string,
    confidence: number,
    context: string = '',
    timestamp?: Date
  ): void {
    if (!metricsMap.has(metricName)) {
      metricsMap.set(metricName, []);
    }

    metricsMap.get(metricName)!.push({
      value,
      source,
      confidence,
      context,
      timestamp,
    });
  }

  /**
   * Check for value consistency across documents
   */
  private checkValueConsistency(
    allMetrics: Map<string, MetricValue[]>,
    options: ConsistencyCheckOptions
  ): MetricDiscrepancy[] {
    const discrepancies: MetricDiscrepancy[] = [];

    allMetrics.forEach((values, metricName) => {
      if (values.length < 2) return; // Need at least 2 values to compare

      // Group values by similarity
      const valueGroups = this.groupSimilarValues(values, metricName);

      if (valueGroups.length > 1) {
        // Multiple different values found
        const severity = this.criticalMetrics.includes(metricName) 
          ? RiskSeverity.HIGH 
          : RiskSeverity.MEDIUM;

        discrepancies.push({
          metricName,
          values,
          discrepancyType: 'value_mismatch',
          severity,
          explanation: this.generateDiscrepancyExplanation(metricName, valueGroups),
          suggestedResolution: this.generateResolutionSuggestion(metricName, valueGroups),
        });
      }
    });

    return discrepancies;
  }

  /**
   * Group similar values together based on tolerance thresholds
   */
  private groupSimilarValues(values: MetricValue[], metricName: string): MetricValue[][] {
    const groups: MetricValue[][] = [];
    const tolerance = this.getToleranceForMetric(metricName);

    values.forEach(value => {
      let addedToGroup = false;

      for (const group of groups) {
        if (this.areValuesSimilar(value.value, group[0].value, tolerance, metricName)) {
          group.push(value);
          addedToGroup = true;
          break;
        }
      }

      if (!addedToGroup) {
        groups.push([value]);
      }
    });

    return groups;
  }

  /**
   * Check if two values are similar within tolerance
   */
  private areValuesSimilar(value1: any, value2: any, tolerance: number, metricName: string): boolean {
    // Handle null/undefined values
    if (value1 == null || value2 == null) {
      return value1 === value2;
    }

    // Handle string values
    if (typeof value1 === 'string' || typeof value2 === 'string') {
      return String(value1).toLowerCase() === String(value2).toLowerCase();
    }

    // Handle numeric values
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      if (metricName.includes('Rate') || metricName.includes('Percentage')) {
        // Percentage values - use absolute difference
        return Math.abs(value1 - value2) <= tolerance * 100;
      } else {
        // Other numeric values - use relative difference
        const avg = (value1 + value2) / 2;
        return Math.abs(value1 - value2) / avg <= tolerance;
      }
    }

    // Handle date values
    if (value1 instanceof Date && value2 instanceof Date) {
      return Math.abs(value1.getTime() - value2.getTime()) <= this.tolerances.date;
    }

    // Default: exact match
    return value1 === value2;
  }

  /**
   * Get tolerance threshold for a specific metric
   */
  private getToleranceForMetric(metricName: string): number {
    if (metricName.includes('Rate') || metricName.includes('Percentage') || metricName === 'nps') {
      return this.tolerances.percentage;
    }
    if (metricName.includes('customers') || metricName.includes('team') || metricName.includes('founders')) {
      return this.tolerances.count;
    }
    if (metricName.includes('Year') || metricName.includes('Date')) {
      return this.tolerances.date;
    }
    return this.tolerances.financial;
  }

  /**
   * Check for missing data across documents
   */
  private checkMissingData(
    allMetrics: Map<string, MetricValue[]>,
    sourceDocuments: ProcessedDocument[],
    options: ConsistencyCheckOptions
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    if (!options.requireAllDocuments) return issues;

    this.criticalMetrics.forEach(metricName => {
      const values = allMetrics.get(metricName) || [];
      const documentsSources = new Set(values.map(v => v.source));

      if (documentsSources.size < sourceDocuments.length) {
        const missingSources = sourceDocuments
          .map(doc => doc.metadata.filename)
          .filter(filename => !documentsSources.has(filename));

        issues.push({
          metric: metricName,
          sources: Array.from(documentsSources),
          values: values.map(v => v.value),
          severity: RiskSeverity.MEDIUM,
          description: `Metric '${metricName}' is missing from documents: ${missingSources.join(', ')}`,
        });
      }
    });

    return issues;
  }

  /**
   * Check for temporal consistency (timeline issues)
   */
  private checkTemporalConsistency(
    allMetrics: Map<string, MetricValue[]>,
    sourceDocuments: ProcessedDocument[]
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // Check for logical timeline issues
    const foundedYears = allMetrics.get('foundedYear') || [];
    const fundingDates = allMetrics.get('lastRoundDate') || [];

    foundedYears.forEach(foundedYear => {
      fundingDates.forEach(fundingDate => {
        if (foundedYear.value && fundingDate.value) {
          const foundedDate = new Date(foundedYear.value, 0, 1);
          const fundingDateObj = new Date(fundingDate.value);

          if (fundingDateObj < foundedDate) {
            issues.push({
              metric: 'timeline',
              sources: [foundedYear.source, fundingDate.source],
              values: [foundedYear.value, fundingDate.value],
              severity: RiskSeverity.HIGH,
              description: `Funding date (${fundingDate.value}) is before company founded year (${foundedYear.value})`,
            });
          }
        }
      });
    });

    return issues;
  }

  /**
   * Compare documents for similarity and conflicts
   */
  private compareDocuments(
    analysisResults: AnalysisResult[],
    sourceDocuments: ProcessedDocument[]
  ): DocumentComparison[] {
    const comparisons: DocumentComparison[] = [];

    for (let i = 0; i < analysisResults.length; i++) {
      for (let j = i + 1; j < analysisResults.length; j++) {
        const doc1 = sourceDocuments[i]?.metadata.filename || `Document ${i + 1}`;
        const doc2 = sourceDocuments[j]?.metadata.filename || `Document ${j + 1}`;

        const comparison = this.compareAnalysisResults(
          analysisResults[i],
          analysisResults[j],
          doc1,
          doc2
        );

        comparisons.push(comparison);
      }
    }

    return comparisons;
  }

  /**
   * Compare two analysis results
   */
  private compareAnalysisResults(
    result1: AnalysisResult,
    result2: AnalysisResult,
    doc1Name: string,
    doc2Name: string
  ): DocumentComparison {
    const conflictingMetrics: string[] = [];
    const alignedMetrics: string[] = [];

    // Compare metrics
    const metrics1 = this.flattenMetrics(result1.extractedMetrics);
    const metrics2 = this.flattenMetrics(result2.extractedMetrics);

    const allMetricNames = new Set([...Object.keys(metrics1), ...Object.keys(metrics2)]);

    allMetricNames.forEach(metricName => {
      const value1 = metrics1[metricName];
      const value2 = metrics2[metricName];

      if (value1 !== undefined && value2 !== undefined) {
        const tolerance = this.getToleranceForMetric(metricName);
        if (this.areValuesSimilar(value1, value2, tolerance, metricName)) {
          alignedMetrics.push(metricName);
        } else {
          conflictingMetrics.push(metricName);
        }
      }
    });

    // Calculate similarity score
    const totalMetrics = alignedMetrics.length + conflictingMetrics.length;
    const similarityScore = totalMetrics > 0 ? alignedMetrics.length / totalMetrics : 0;

    return {
      document1: doc1Name,
      document2: doc2Name,
      similarityScore,
      conflictingMetrics,
      alignedMetrics,
    };
  }

  /**
   * Flatten metrics object for comparison
   */
  private flattenMetrics(metrics: InvestmentMetrics): Record<string, any> {
    const flattened: Record<string, any> = {};

    // Flatten revenue metrics
    Object.entries(metrics.revenue).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        flattened[key] = value;
      }
    });

    // Flatten traction metrics
    Object.entries(metrics.traction).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        flattened[key] = value;
      }
    });

    // Flatten team metrics
    Object.entries(metrics.team).forEach(([key, value]) => {
      if (value !== null && value !== undefined && key !== 'keyHires') {
        flattened[key] = value;
      }
    });

    // Flatten funding metrics
    Object.entries(metrics.funding).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        flattened[key] = value;
      }
    });

    return flattened;
  }

  /**
   * Convert metric discrepancies to consistency issues
   */
  private convertDiscrepanciesToIssues(discrepancies: MetricDiscrepancy[]): ConsistencyIssue[] {
    return discrepancies.map(discrepancy => ({
      metric: discrepancy.metricName,
      sources: discrepancy.values.map(v => v.source),
      values: discrepancy.values.map(v => v.value),
      severity: discrepancy.severity,
      description: discrepancy.explanation,
    }));
  }

  /**
   * Calculate overall consistency score
   */
  private calculateConsistencyScore(issues: ConsistencyIssue[], documentCount: number): number {
    if (documentCount < 2) return 1.0; // Perfect score for single document

    let totalWeight = 0;
    let penaltyWeight = 0;

    issues.forEach(issue => {
      const weight = issue.severity === RiskSeverity.HIGH ? 3 : 
                    issue.severity === RiskSeverity.MEDIUM ? 2 : 1;
      
      totalWeight += weight;
      penaltyWeight += weight;
    });

    // Base score calculation
    const maxPossibleIssues = this.criticalMetrics.length * documentCount;
    const normalizedPenalty = Math.min(penaltyWeight / maxPossibleIssues, 1);
    
    return Math.max(0, 1 - normalizedPenalty);
  }

  /**
   * Generate discrepancy explanation
   */
  private generateDiscrepancyExplanation(metricName: string, valueGroups: MetricValue[][]): string {
    const groupDescriptions = valueGroups.map((group, index) => {
      const value = group[0].value;
      const sources = group.map(v => v.source).join(', ');
      return `Group ${index + 1}: ${value} (from ${sources})`;
    });

    return `Inconsistent values found for ${metricName}: ${groupDescriptions.join('; ')}`;
  }

  /**
   * Generate resolution suggestion
   */
  private generateResolutionSuggestion(metricName: string, valueGroups: MetricValue[][]): string {
    // Find the group with highest confidence
    const bestGroup = valueGroups.reduce((best, current) => {
      const bestAvgConfidence = best.reduce((sum, v) => sum + v.confidence, 0) / best.length;
      const currentAvgConfidence = current.reduce((sum, v) => sum + v.confidence, 0) / current.length;
      return currentAvgConfidence > bestAvgConfidence ? current : best;
    });

    const recommendedValue = bestGroup[0].value;
    const recommendedSources = bestGroup.map(v => v.source).join(', ');

    return `Recommend using value ${recommendedValue} based on higher confidence from ${recommendedSources}. Verify with original sources.`;
  }

  /**
   * Generate recommendations based on consistency issues
   */
  private generateRecommendations(issues: ConsistencyIssue[], overallScore: number): string[] {
    const recommendations: string[] = [];

    if (overallScore < 0.7) {
      recommendations.push('Overall consistency is low. Recommend thorough review of all source documents.');
    }

    const highSeverityIssues = issues.filter(issue => issue.severity === RiskSeverity.HIGH);
    if (highSeverityIssues.length > 0) {
      recommendations.push(`${highSeverityIssues.length} high-severity inconsistencies found. Prioritize resolution of these issues.`);
    }

    const criticalMetricIssues = issues.filter(issue => this.criticalMetrics.includes(issue.metric));
    if (criticalMetricIssues.length > 0) {
      recommendations.push('Critical metrics have inconsistencies. Verify with founders directly.');
    }

    if (issues.some(issue => issue.metric === 'timeline')) {
      recommendations.push('Timeline inconsistencies detected. Review company history and funding timeline.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Documents show good consistency. Proceed with confidence in the data.');
    }

    return recommendations;
  }

  /**
   * Get consistency check summary
   */
  getConsistencySummary(result: ConsistencyCheckResult): {
    totalIssues: number;
    highSeverityIssues: number;
    mediumSeverityIssues: number;
    lowSeverityIssues: number;
    averageDocumentSimilarity: number;
    mostInconsistentMetrics: string[];
  } {
    const highSeverityIssues = result.issues.filter(i => i.severity === RiskSeverity.HIGH).length;
    const mediumSeverityIssues = result.issues.filter(i => i.severity === RiskSeverity.MEDIUM).length;
    const lowSeverityIssues = result.issues.filter(i => i.severity === RiskSeverity.LOW).length;

    const avgSimilarity = result.documentComparisons.length > 0
      ? result.documentComparisons.reduce((sum, comp) => sum + comp.similarityScore, 0) / result.documentComparisons.length
      : 1.0;

    // Find most inconsistent metrics
    const metricIssueCount = new Map<string, number>();
    result.issues.forEach(issue => {
      metricIssueCount.set(issue.metric, (metricIssueCount.get(issue.metric) || 0) + 1);
    });

    const mostInconsistentMetrics = Array.from(metricIssueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([metric]) => metric);

    return {
      totalIssues: result.issues.length,
      highSeverityIssues,
      mediumSeverityIssues,
      lowSeverityIssues,
      averageDocumentSimilarity: avgSimilarity,
      mostInconsistentMetrics,
    };
  }
}