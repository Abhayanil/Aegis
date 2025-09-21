// Unit tests for ConsistencyChecker
import { describe, it, expect, beforeEach } from 'vitest';
import { ConsistencyChecker, MetricDiscrepancy } from '../../../src/services/ai/ConsistencyChecker.js';
import { AnalysisResult } from '../../../src/models/AnalysisResult.js';
import { ProcessedDocument } from '../../../src/models/ProcessedDocument.js';
import { DocumentType, ProcessingStatus, FundingStage, AnalysisType, RiskSeverity } from '../../../src/types/enums.js';

describe('ConsistencyChecker', () => {
  let checker: ConsistencyChecker;

  beforeEach(() => {
    checker = new ConsistencyChecker();
  });

  const createMockDocument = (id: string, filename: string): ProcessedDocument => ({
    id,
    sourceType: DocumentType.PDF,
    extractedText: 'Sample content',
    sections: [],
    metadata: {
      filename,
      fileSize: 1000,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
      processingStatus: ProcessingStatus.COMPLETED,
    },
    processingTimestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createMockAnalysisResult = (
    id: string,
    metrics: any,
    companyData: any = {},
    marketData: any = {}
  ): AnalysisResult => ({
    id,
    companyProfile: {
      id: `company_${id}`,
      name: companyData.name || 'TestCorp',
      oneLiner: 'Test company',
      sector: 'SaaS',
      stage: FundingStage.SEED,
      foundedYear: companyData.foundedYear || 2020,
      location: 'San Francisco',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    extractedMetrics: {
      id: `metrics_${id}`,
      revenue: metrics.revenue || {},
      traction: metrics.traction || {},
      team: metrics.team || { size: 0, foundersCount: 0, keyHires: [] },
      funding: metrics.funding || {},
      extractionTimestamp: new Date(),
      sourceDocuments: [id],
      confidence: 0.8,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    marketClaims: marketData,
    teamAssessment: {
      founders: [],
      keyEmployees: [],
      advisors: [],
      totalSize: metrics.team?.size || 0,
      averageExperience: 0,
      domainExpertise: [],
    },
    consistencyFlags: [],
    analysisType: AnalysisType.COMPREHENSIVE,
    confidence: 0.8,
    processingTime: 1000,
    sourceDocumentIds: [id],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(checker).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customChecker = new ConsistencyChecker({
        toleranceThreshold: 0.05,
        requireAllDocuments: true,
        checkTemporalConsistency: false,
      });
      expect(customChecker).toBeDefined();
    });
  });

  describe('Value Consistency Checking', () => {
    it('should detect consistent values across documents', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf'),
        createMockDocument('doc2', 'financials.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000, mrr: 83333 },
          traction: { customers: 500 },
          team: { size: 20, foundersCount: 2 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 1000000, mrr: 83333 }, // Same values
          traction: { customers: 500 },
          team: { size: 20, foundersCount: 2 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.overallConsistencyScore).toBeGreaterThan(0.8);
      expect(result.metricDiscrepancies).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect value discrepancies within tolerance', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf'),
        createMockDocument('doc2', 'financials.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          team: { size: 20 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 1020000 }, // 2% difference - within tolerance
          team: { size: 20 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.overallConsistencyScore).toBeGreaterThan(0.7);
      expect(result.metricDiscrepancies).toHaveLength(0);
    });

    it('should detect significant value discrepancies', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf'),
        createMockDocument('doc2', 'financials.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          traction: { customers: 500 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 1500000 }, // 50% difference - significant
          traction: { customers: 800 }, // 60% difference
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.overallConsistencyScore).toBeLessThan(0.7);
      expect(result.metricDiscrepancies.length).toBeGreaterThan(0);
      
      const arrDiscrepancy = result.metricDiscrepancies.find(d => d.metricName === 'arr');
      expect(arrDiscrepancy).toBeDefined();
      expect(arrDiscrepancy?.discrepancyType).toBe('value_mismatch');
      expect(arrDiscrepancy?.severity).toBe(RiskSeverity.HIGH);
    });

    it('should handle percentage metrics correctly', async () => {
      const documents = [
        createMockDocument('doc1', 'metrics.pdf'),
        createMockDocument('doc2', 'update.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          traction: { churnRate: 5.0 }, // 5%
          team: { size: 20, foundersCount: 2 }, // Same values to avoid other discrepancies
        }),
        createMockAnalysisResult('result2', {
          traction: { churnRate: 5.5 }, // 5.5% - small difference
          team: { size: 20, foundersCount: 2 }, // Same values
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      // Should not have churn rate discrepancy due to percentage tolerance
      const churnDiscrepancy = result.metricDiscrepancies.find(d => d.metricName === 'churnRate');
      expect(churnDiscrepancy).toBeUndefined();
    });

    it('should detect conflicting percentage values', async () => {
      const documents = [
        createMockDocument('doc1', 'metrics.pdf'),
        createMockDocument('doc2', 'update.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          traction: { churnRate: 2.0 }, // 2%
        }),
        createMockAnalysisResult('result2', {
          traction: { churnRate: 8.0 }, // 8% - significant difference
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.metricDiscrepancies.length).toBeGreaterThan(0);
      const churnDiscrepancy = result.metricDiscrepancies.find(d => d.metricName === 'churnRate');
      expect(churnDiscrepancy).toBeDefined();
    });
  });

  describe('Missing Data Detection', () => {
    it('should detect missing critical metrics when required', async () => {
      const checkerWithRequiredData = new ConsistencyChecker({
        requireAllDocuments: true,
      });

      const documents = [
        createMockDocument('doc1', 'pitch.pdf'),
        createMockDocument('doc2', 'financials.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          team: { size: 20 },
        }),
        createMockAnalysisResult('result2', {
          // Missing ARR data
          team: { size: 20 },
        }),
      ];

      const result = await checkerWithRequiredData.checkConsistency(analysisResults, documents);

      expect(result.issues.length).toBeGreaterThan(0);
      const missingArrIssue = result.issues.find(issue => 
        issue.metric === 'arr' && issue.description.includes('missing')
      );
      expect(missingArrIssue).toBeDefined();
    });

    it('should not flag missing data when not required', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf'),
        createMockDocument('doc2', 'financials.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
        }),
        createMockAnalysisResult('result2', {
          // Missing ARR data but not required
          team: { size: 20 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      const missingDataIssues = result.issues.filter(issue => 
        issue.description.includes('missing')
      );
      expect(missingDataIssues).toHaveLength(0);
    });
  });

  describe('Temporal Consistency', () => {
    it('should detect timeline inconsistencies', async () => {
      const documents = [
        createMockDocument('doc1', 'company.pdf'),
        createMockDocument('doc2', 'funding.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          funding: { lastRoundDate: new Date('2019-01-01') }, // Before founded
        }, { foundedYear: 2020 }),
        createMockAnalysisResult('result2', {}, { foundedYear: 2020 }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      const timelineIssue = result.issues.find(issue => issue.metric === 'timeline');
      expect(timelineIssue).toBeDefined();
      expect(timelineIssue?.severity).toBe(RiskSeverity.HIGH);
    });

    it('should pass valid timeline consistency', async () => {
      const documents = [
        createMockDocument('doc1', 'company.pdf'),
        createMockDocument('doc2', 'funding.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          funding: { lastRoundDate: new Date('2021-01-01') }, // After founded
        }, { foundedYear: 2020 }),
        createMockAnalysisResult('result2', {}, { foundedYear: 2020 }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      const timelineIssues = result.issues.filter(issue => issue.metric === 'timeline');
      expect(timelineIssues).toHaveLength(0);
    });

    it('should skip temporal checks when disabled', async () => {
      const checkerNoTemporal = new ConsistencyChecker({
        checkTemporalConsistency: false,
      });

      const documents = [
        createMockDocument('doc1', 'company.pdf'),
        createMockDocument('doc2', 'funding.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          funding: { lastRoundDate: new Date('2019-01-01') }, // Before founded
        }, { foundedYear: 2020 }),
        createMockAnalysisResult('result2', {}, { foundedYear: 2020 }),
      ];

      const result = await checkerNoTemporal.checkConsistency(analysisResults, documents);

      const timelineIssues = result.issues.filter(issue => issue.metric === 'timeline');
      expect(timelineIssues).toHaveLength(0);
    });
  });

  describe('Document Comparison', () => {
    it('should compare document similarity correctly', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf'),
        createMockDocument('doc2', 'financials.pdf'),
        createMockDocument('doc3', 'update.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          team: { size: 20 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 1000000 }, // Same ARR
          team: { size: 25 }, // Different team size
        }),
        createMockAnalysisResult('result3', {
          revenue: { arr: 1500000 }, // Different ARR
          team: { size: 20 }, // Same team size as doc1
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.documentComparisons).toHaveLength(3); // 3 choose 2 = 3 comparisons

      const doc1Doc2Comparison = result.documentComparisons.find(
        comp => comp.document1 === 'pitch.pdf' && comp.document2 === 'financials.pdf'
      );
      expect(doc1Doc2Comparison).toBeDefined();
      expect(doc1Doc2Comparison?.alignedMetrics).toContain('arr');
      expect(doc1Doc2Comparison?.conflictingMetrics).toContain('size');
    });

    it('should calculate similarity scores correctly', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000, mrr: 83333 },
          team: { size: 20 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 1000000, mrr: 83333 }, // 2 aligned
          team: { size: 25 }, // 1 conflicting
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      const comparison = result.documentComparisons[0];
      expect(comparison.similarityScore).toBeCloseTo(2/3, 2); // 2 aligned out of 3 total
    });
  });

  describe('Consistency Score Calculation', () => {
    it('should return perfect score for single document', async () => {
      const documents = [createMockDocument('doc1', 'single.pdf')];
      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.overallConsistencyScore).toBe(1.0);
    });

    it('should penalize high-severity issues more', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
      ];

      // Create scenario with high-severity issue (critical metric discrepancy)
      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 }, // Critical metric
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 2000000 }, // Significant difference
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.overallConsistencyScore).toBeLessThan(0.5);
    });

    it('should handle edge cases gracefully', async () => {
      const documents: ProcessedDocument[] = [];
      const analysisResults: AnalysisResult[] = [];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.overallConsistencyScore).toBe(1.0);
      expect(result.issues).toHaveLength(0);
      expect(result.metricDiscrepancies).toHaveLength(0);
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate appropriate recommendations for low consistency', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          traction: { customers: 500 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 2000000 }, // Major discrepancy
          traction: { customers: 1000 }, // Major discrepancy
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => 
        rec.includes('consistency is low')
      )).toBe(true);
    });

    it('should recommend verification for critical metrics', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 }, // Critical metric with discrepancy
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 2000000 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.recommendations.some(rec => 
        rec.includes('Critical metrics') || rec.includes('founders directly')
      )).toBe(true);
    });

    it('should provide positive feedback for consistent data', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          team: { size: 20 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 1000000 },
          team: { size: 20 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);

      expect(result.recommendations.some(rec => 
        rec.includes('good consistency') || rec.includes('confidence')
      )).toBe(true);
    });
  });

  describe('Consistency Summary', () => {
    it('should provide accurate summary statistics', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000, mrr: 83333 },
          traction: { customers: 500 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 2000000, mrr: 83333 }, // ARR discrepancy
          traction: { customers: 1000 }, // Customer discrepancy
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);
      const summary = checker.getConsistencySummary(result);

      expect(summary.totalIssues).toBe(result.issues.length);
      expect(summary.averageDocumentSimilarity).toBeGreaterThan(0);
      expect(summary.averageDocumentSimilarity).toBeLessThanOrEqual(1);
      expect(summary.mostInconsistentMetrics).toBeDefined();
    });

    it('should identify most inconsistent metrics', async () => {
      const documents = [
        createMockDocument('doc1', 'doc1.pdf'),
        createMockDocument('doc2', 'doc2.pdf'),
        createMockDocument('doc3', 'doc3.pdf'),
      ];

      const analysisResults = [
        createMockAnalysisResult('result1', {
          revenue: { arr: 1000000 },
          team: { size: 20 },
        }),
        createMockAnalysisResult('result2', {
          revenue: { arr: 2000000 }, // ARR appears in multiple discrepancies
          team: { size: 20 },
        }),
        createMockAnalysisResult('result3', {
          revenue: { arr: 1500000 }, // ARR appears again
          team: { size: 25 },
        }),
      ];

      const result = await checker.checkConsistency(analysisResults, documents);
      const summary = checker.getConsistencySummary(result);

      expect(summary.mostInconsistentMetrics).toContain('arr');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed analysis results gracefully', async () => {
      const documents = [createMockDocument('doc1', 'doc1.pdf')];
      
      // Create malformed analysis result
      const malformedResult = createMockAnalysisResult('result1', {});
      malformedResult.extractedMetrics = null as any;

      await expect(checker.checkConsistency([malformedResult], documents))
        .rejects.toThrow();
    });

    it('should handle empty inputs gracefully', async () => {
      const result = await checker.checkConsistency([], []);

      expect(result.overallConsistencyScore).toBe(1.0);
      expect(result.issues).toHaveLength(0);
      expect(result.documentComparisons).toHaveLength(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => 
        rec.includes('good consistency') || rec.includes('confidence')
      )).toBe(true);
    });
  });
});