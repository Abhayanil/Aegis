// Tests for MetricAnomalyDetector
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricAnomalyDetector, CohortAnalysisData } from '../../../src/services/risk/MetricAnomalyDetector.js';
import { InvestmentMetrics } from '../../../src/models/InvestmentMetrics.js';
import { RiskType, RiskSeverity, FundingStage } from '../../../src/types/enums.js';

describe('MetricAnomalyDetector', () => {
  let detector: MetricAnomalyDetector;

  beforeEach(() => {
    detector = new MetricAnomalyDetector();
  });

  describe('detectFinancialAnomalies', () => {
    it('should detect high churn rate anomaly', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 1000000,
          mrr: 83333,
          growthRate: 0.15,
          grossMargin: 0.75,
        },
        traction: {
          customers: 500,
          churnRate: 0.12, // 12% - critically high for SaaS
          nps: 50,
          ltv: 5000,
          cac: 1000,
        },
        team: {
          size: 25,
          foundersCount: 2,
          keyHires: [],
          burnRate: 100000,
        },
        funding: {
          totalRaised: 2000000,
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: ['test-doc.pdf'],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas', undefined, ['test-doc.pdf']);

      expect(report.overallHealthScore).toBeLessThan(0.8);
      expect(report.churnAnalysis.isHealthy).toBe(false);
      expect(report.churnAnalysis.currentRate).toBe(0.12);
      expect(report.anomalies).toHaveLength(1);
      expect(report.anomalies[0].type).toBe(RiskType.FINANCIAL_ANOMALY);
      expect(report.anomalies[0].severity).toBe(RiskSeverity.HIGH);
      expect(report.anomalies[0].title).toBe('Critical Churn Rate');
    });

    it('should detect poor unit economics', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 500000,
          mrr: 41667,
          grossMargin: 0.40, // Low for SaaS
        },
        traction: {
          customers: 200,
          churnRate: 0.03, // Healthy churn
          ltv: 2000,
          cac: 1000, // Poor 2:1 LTV:CAC ratio
        },
        team: {
          size: 15,
          foundersCount: 2,
          keyHires: [],
          burnRate: 80000,
        },
        funding: {
          totalRaised: 1000000,
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: ['test-doc.pdf'],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      expect(report.unitEconomics.ltvCacRatio).toBe(2);
      expect(report.unitEconomics.healthScore).toBeLessThan(0.5);
      expect(report.anomalies.some(flag => flag.title === 'Poor Unit Economics')).toBe(true);
      expect(report.anomalies.some(flag => flag.title === 'Low Gross Margin')).toBe(true);
    });

    it('should detect inconsistent growth patterns', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-3',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 1000000,
          mrr: 83333,
          // Highly volatile growth: 100K, 200K, 150K, 300K, 180K, 400K
          projectedArr: [100000, 200000, 150000, 300000, 180000, 400000],
        },
        traction: {
          customers: 300,
          churnRate: 0.04, // Healthy
        },
        team: {
          size: 20,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          totalRaised: 1500000,
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: ['test-doc.pdf'],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      expect(report.growthConsistency.isConsistent).toBe(false);
      expect(report.growthConsistency.variance).toBeGreaterThan(0.5);
      expect(report.anomalies.some(flag => flag.title === 'Inconsistent Growth Pattern')).toBe(true);
    });

    it('should handle missing churn rate data', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-4',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 800000,
          mrr: 66667,
        },
        traction: {
          customers: 400,
          // No churn rate provided
        },
        team: {
          size: 18,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          totalRaised: 1200000,
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: ['test-doc.pdf'],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      expect(report.churnAnalysis.isHealthy).toBe(false);
      expect(report.anomalies.some(flag => flag.title === 'Missing Churn Rate Data')).toBe(true);
    });

    it('should calculate payback period correctly', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-5',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 1200000,
          mrr: 100000,
          grossMargin: 0.80,
        },
        traction: {
          customers: 600,
          churnRate: 0.03,
          cac: 200000, // With 80% margin and 100K MRR, payback = 200000 / 80000 = 2.5 months
        },
        team: {
          size: 25,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          totalRaised: 2000000,
          stage: FundingStage.SERIES_A,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: ['test-doc.pdf'],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      expect(report.unitEconomics.paybackPeriod).toBeCloseTo(2.5, 1);
      expect(report.unitEconomics.healthScore).toBeGreaterThan(0.6);
    });

    it('should detect long payback period', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-6',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 600000,
          mrr: 50000,
          grossMargin: 0.60,
        },
        traction: {
          customers: 300,
          churnRate: 0.04,
          cac: 300000, // With 60% margin and 50K MRR, payback = 300000 / 30000 = 10 months
        },
        team: {
          size: 20,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          totalRaised: 1500000,
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: ['test-doc.pdf'],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      expect(report.unitEconomics.paybackPeriod).toBeCloseTo(10, 1);
      // Should not flag as critical (< 36 months) but may warn (> 18 months)
      expect(report.unitEconomics.healthScore).toBeLessThan(1.0);
    });
  });

  describe('validateChurnRate', () => {
    it('should validate healthy churn rate', async () => {
      const result = await detector.validateChurnRate(0.03, 'saas'); // 3% for SaaS

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about elevated churn rate', async () => {
      const result = await detector.validateChurnRate(0.07, 'saas'); // 7% for SaaS

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('above healthy levels');
    });

    it('should error on critical churn rate', async () => {
      const result = await detector.validateChurnRate(0.15, 'saas'); // 15% for SaaS

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('critically high');
    });

    it('should use different thresholds for different sectors', async () => {
      // E-commerce has higher acceptable churn rates
      const saasResult = await detector.validateChurnRate(0.12, 'saas');
      const ecommerceResult = await detector.validateChurnRate(0.12, 'ecommerce');

      expect(saasResult.isValid).toBe(false); // Critical for SaaS
      expect(ecommerceResult.isValid).toBe(true); // Acceptable for e-commerce
    });
  });

  describe('validateUnitEconomics', () => {
    it('should validate healthy unit economics', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-7',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          grossMargin: 0.85, // Healthy for SaaS
        },
        traction: {
          ltv: 10000,
          cac: 1500, // Good 6.7:1 ratio
        },
        team: {
          size: 20,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const result = await detector.validateUnitEconomics(metrics, 'saas');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on poor LTV:CAC ratio', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-8',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          grossMargin: 0.75,
        },
        traction: {
          ltv: 2000,
          cac: 1000, // Poor 2:1 ratio
        },
        team: {
          size: 15,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const result = await detector.validateUnitEconomics(metrics, 'saas');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('below minimum threshold');
    });

    it('should error on low gross margin', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-9',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          grossMargin: 0.50, // Low for SaaS
        },
        traction: {
          ltv: 8000,
          cac: 1200, // Good ratio
        },
        team: {
          size: 18,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const result = await detector.validateUnitEconomics(metrics, 'saas');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('below minimum');
    });
  });

  describe('cohort analysis', () => {
    it('should analyze healthy cohort data', async () => {
      const cohortData: CohortAnalysisData[] = [
        {
          cohortMonth: '2024-01',
          initialCustomers: 100,
          retentionRates: [1.0, 0.90, 0.85, 0.80, 0.75], // Average: 0.86
          revenueRetention: [1.0, 0.98, 0.95, 0.93, 0.90],
          churnRate: 0.03,
        },
        {
          cohortMonth: '2024-02',
          initialCustomers: 120,
          retentionRates: [1.0, 0.95, 0.92, 0.90, 0.88], // Average: 0.93 (improving)
          revenueRetention: [1.0, 0.99, 0.96, 0.94, 0.91],
          churnRate: 0.025,
        },
      ];

      const metrics: InvestmentMetrics = {
        id: 'test-10',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: { arr: 1000000 },
        traction: { customers: 500, churnRate: 0.03 },
        team: { size: 20, foundersCount: 2, keyHires: [] },
        funding: { stage: FundingStage.SEED },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas', cohortData);

      expect(report.cohortHealth.isHealthy).toBe(true);
      expect(report.cohortHealth.retentionTrend).toBe('improving');
    });

    it('should detect deteriorating cohort health', async () => {
      const cohortData: CohortAnalysisData[] = [
        {
          cohortMonth: '2024-01',
          initialCustomers: 100,
          retentionRates: [1.0, 0.85, 0.70, 0.60, 0.50],
          revenueRetention: [1.0, 0.80, 0.65, 0.55, 0.45],
          churnRate: 0.20, // High churn
        },
        {
          cohortMonth: '2024-02',
          initialCustomers: 80,
          retentionRates: [1.0, 0.80, 0.65, 0.50, 0.40],
          revenueRetention: [1.0, 0.75, 0.60, 0.45, 0.35],
          churnRate: 0.25, // Even higher churn
        },
      ];

      const metrics: InvestmentMetrics = {
        id: 'test-11',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: { arr: 800000 },
        traction: { customers: 400, churnRate: 0.22 },
        team: { size: 15, foundersCount: 2, keyHires: [] },
        funding: { stage: FundingStage.SEED },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas', cohortData);

      expect(report.cohortHealth.isHealthy).toBe(false);
      expect(report.cohortHealth.retentionTrend).toBe('deteriorating');
      expect(report.cohortHealth.redFlags).toContain('Cohort retention is deteriorating over time');
    });
  });

  describe('sector-specific thresholds', () => {
    it('should use appropriate thresholds for e-commerce', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-12',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          grossMargin: 0.30, // Acceptable for e-commerce
        },
        traction: {
          churnRate: 0.12, // Within acceptable range for e-commerce (warning at 15%)
        },
        team: {
          size: 25,
          foundersCount: 2,
          keyHires: [],
        },
        funding: {
          stage: FundingStage.SERIES_A,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'ecommerce');

      // Should not flag gross margin as critical for e-commerce
      expect(report.unitEconomics.healthScore).toBeGreaterThan(0.5);
      // Should not flag churn as critical for e-commerce
      expect(report.churnAnalysis.isHealthy).toBe(true);
    });

    it('should use appropriate thresholds for marketplace', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-13',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          grossMargin: 0.20, // Acceptable for marketplace
        },
        traction: {
          churnRate: 0.10, // Acceptable for marketplace
        },
        team: {
          size: 30,
          foundersCount: 3,
          keyHires: [],
        },
        funding: {
          stage: FundingStage.SERIES_A,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'marketplace');

      // Should not flag these metrics as critical for marketplace
      expect(report.unitEconomics.healthScore).toBeGreaterThanOrEqual(0.6);
      expect(report.churnAnalysis.isHealthy).toBe(false); // Still above warning threshold
    });
  });

  describe('burn multiple analysis', () => {
    it('should calculate healthy burn multiple', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-14',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 2000000, // $2M ARR
        },
        traction: {
          churnRate: 0.03,
        },
        team: {
          size: 40,
          foundersCount: 2,
          keyHires: [],
          burnRate: 150000, // $150K monthly burn = $1.8M annual
        },
        funding: {
          stage: FundingStage.SERIES_A,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      // Burn multiple = 1.8M / 2M = 0.9x (very efficient)
      expect(report.unitEconomics.burnMultiple).toBeCloseTo(0.9, 1);
      expect(report.unitEconomics.healthScore).toBeGreaterThan(0.4);
    });

    it('should detect high burn multiple', async () => {
      const metrics: InvestmentMetrics = {
        id: 'test-15',
        createdAt: new Date(),
        updatedAt: new Date(),
        revenue: {
          arr: 500000, // $500K ARR
        },
        traction: {
          churnRate: 0.04,
        },
        team: {
          size: 25,
          foundersCount: 2,
          keyHires: [],
          burnRate: 300000, // $300K monthly burn = $3.6M annual
        },
        funding: {
          stage: FundingStage.SEED,
        },
        extractionTimestamp: new Date(),
        sourceDocuments: [],
        confidence: 0.9,
      };

      const report = await detector.detectFinancialAnomalies(metrics, 'saas');

      // Burn multiple = 3.6M / 500K = 7.2x (very high)
      expect(report.unitEconomics.burnMultiple).toBeCloseTo(7.2, 1);
      expect(report.anomalies.some(flag => flag.title === 'High Burn Multiple')).toBe(true);
    });
  });
});