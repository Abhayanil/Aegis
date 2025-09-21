import { describe, it, expect } from 'vitest';
import {
  validateDealMemo,
  validateCompanyProfile,
  validateInvestmentMetrics,
  validateRiskFlag,
  validateBenchmarkData,
  validateWithReport,
  normalizeWeightings,
  dealMemoSchema,
  companyProfileSchema,
  investmentMetricsSchema,
  riskFlagSchema,
  benchmarkDataSchema,
} from '../../src/utils/validation.js';
import { 
  FundingStage, 
  RecommendationType, 
  RiskType, 
  RiskSeverity 
} from '../../src/types/enums.js';

describe('Schema Validation', () => {
  describe('Company Profile Validation', () => {
    const validCompanyProfile = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
      name: 'TechStartup Inc',
      oneLiner: 'Revolutionary AI platform for enterprise automation',
      sector: 'Enterprise Software',
      stage: FundingStage.SERIES_A,
      foundedYear: 2020,
      location: 'San Francisco, CA',
      website: 'https://techstartup.com',
      description: 'A comprehensive AI platform that helps enterprises automate their workflows.',
    };

    it('should validate a correct company profile', () => {
      expect(() => validateCompanyProfile(validCompanyProfile)).not.toThrow();
    });

    it('should reject company profile with invalid name', () => {
      const invalid = { ...validCompanyProfile, name: '' };
      expect(() => validateCompanyProfile(invalid)).toThrow();
    });

    it('should reject company profile with invalid founded year', () => {
      const invalid = { ...validCompanyProfile, foundedYear: 1800 };
      expect(() => validateCompanyProfile(invalid)).toThrow();
    });

    it('should reject company profile with invalid website URL', () => {
      const invalid = { ...validCompanyProfile, website: 'not-a-url' };
      expect(() => validateCompanyProfile(invalid)).toThrow();
    });

    it('should accept company profile without optional fields', () => {
      const minimal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
        name: 'TechStartup Inc',
        oneLiner: 'Revolutionary AI platform for enterprise automation',
        sector: 'Enterprise Software',
        stage: FundingStage.SERIES_A,
        foundedYear: 2020,
        location: 'San Francisco, CA',
      };
      expect(() => validateCompanyProfile(minimal)).not.toThrow();
    });
  });

  describe('Investment Metrics Validation', () => {
    const validInvestmentMetrics = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
      revenue: {
        arr: 1000000,
        mrr: 83333,
        growthRate: 150,
        projectedArr: [1000000, 2000000, 4000000],
      },
      traction: {
        customers: 50,
        customerGrowthRate: 20,
        churnRate: 5,
        nps: 70,
      },
      team: {
        size: 25,
        foundersCount: 2,
        keyHires: [
          {
            name: 'John Doe',
            role: 'CTO',
            background: 'Former Google engineer',
            yearsExperience: 10,
            isFounder: true,
          },
        ],
      },
      funding: {
        totalRaised: 5000000,
        lastRoundSize: 3000000,
        lastRoundDate: new Date(),
        currentAsk: 10000000,
        valuation: 50000000,
      },
      extractionTimestamp: new Date(),
      sourceDocuments: ['doc1.pdf', 'doc2.docx'],
      confidence: 0.85,
    };

    it('should validate correct investment metrics', () => {
      expect(() => validateInvestmentMetrics(validInvestmentMetrics)).not.toThrow();
    });

    it('should reject negative revenue values', () => {
      const invalid = {
        ...validInvestmentMetrics,
        revenue: { ...validInvestmentMetrics.revenue, arr: -1000 },
      };
      expect(() => validateInvestmentMetrics(invalid)).toThrow();
    });

    it('should reject invalid churn rate', () => {
      const invalid = {
        ...validInvestmentMetrics,
        traction: { ...validInvestmentMetrics.traction, churnRate: 150 },
      };
      expect(() => validateInvestmentMetrics(invalid)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalid = { ...validInvestmentMetrics, confidence: 1.5 };
      expect(() => validateInvestmentMetrics(invalid)).toThrow();
    });
  });

  describe('Risk Flag Validation', () => {
    const validRiskFlag = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
      type: RiskType.FINANCIAL_ANOMALY,
      severity: RiskSeverity.HIGH,
      title: 'Unusual Churn Pattern',
      description: 'Customer churn rate has increased significantly in recent months without clear explanation.',
      affectedMetrics: ['churnRate', 'customerGrowthRate'],
      suggestedMitigation: 'Conduct customer interviews to understand churn drivers and implement retention strategies.',
      sourceDocuments: ['transcript.txt', 'metrics.pdf'],
      confidence: 0.9,
      impact: 'high' as const,
      likelihood: 'medium' as const,
      category: 'financial' as const,
      detectedAt: new Date(),
      evidence: ['Churn increased from 3% to 8%', 'No explanation in founder updates'],
    };

    it('should validate correct risk flag', () => {
      expect(() => validateRiskFlag(validRiskFlag)).not.toThrow();
    });

    it('should reject risk flag with short description', () => {
      const invalid = { ...validRiskFlag, description: 'Too short' };
      expect(() => validateRiskFlag(invalid)).toThrow();
    });

    it('should reject risk flag with invalid confidence', () => {
      const invalid = { ...validRiskFlag, confidence: 2.0 };
      expect(() => validateRiskFlag(invalid)).toThrow();
    });

    it('should reject risk flag with invalid impact level', () => {
      const invalid = { ...validRiskFlag, impact: 'invalid' as any };
      expect(() => validateRiskFlag(invalid)).toThrow();
    });
  });

  describe('Benchmark Data Validation', () => {
    const validBenchmarkData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
      sector: 'Enterprise Software',
      sampleSize: 100,
      metrics: {
        arr: {
          min: 100000,
          max: 50000000,
          median: 2000000,
          p25: 500000,
          p75: 5000000,
          p90: 15000000,
          mean: 3500000,
          stdDev: 8000000,
          sampleSize: 100,
        },
      },
      lastUpdated: new Date(),
      dataSource: 'Industry Research Database',
      methodology: 'Survey of 100 enterprise software companies in Series A-C stages',
      confidence: 0.85,
      timeRange: {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
      },
    };

    it('should validate correct benchmark data', () => {
      expect(() => validateBenchmarkData(validBenchmarkData)).not.toThrow();
    });

    it('should reject benchmark data with zero sample size', () => {
      const invalid = { ...validBenchmarkData, sampleSize: 0 };
      expect(() => validateBenchmarkData(invalid)).toThrow();
    });

    it('should reject benchmark data with invalid confidence', () => {
      const invalid = { ...validBenchmarkData, confidence: -0.1 };
      expect(() => validateBenchmarkData(invalid)).toThrow();
    });
  });

  describe('Deal Memo Validation', () => {
    const validDealMemo = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
      updatedAt: new Date(),
      aegisDealMemo: {
        summary: {
          companyName: 'TechStartup Inc',
          oneLiner: 'Revolutionary AI platform for enterprise automation',
          sector: 'Enterprise Software',
          stage: FundingStage.SERIES_A,
          signalScore: 85,
          recommendation: RecommendationType.BUY,
          confidenceLevel: 0.9,
          lastUpdated: new Date(),
        },
        keyBenchmarks: [
          {
            metric: 'ARR',
            companyValue: 1000000,
            sectorMedian: 2000000,
            percentile: 40,
            interpretation: 'Below median but showing strong growth trajectory',
            context: 'Company is earlier stage than typical Series A',
            recommendation: 'Monitor growth rate closely',
          },
        ],
        growthPotential: {
          upsideSummary: 'Strong potential for 10x growth over 5 years driven by market expansion and product development.',
          growthTimeline: 'Expect 3x growth in next 18 months with Series B funding',
          keyDrivers: ['Market expansion', 'Product development', 'Team scaling'],
          scalabilityFactors: ['Cloud-native architecture', 'API-first design'],
          marketExpansionOpportunity: 'Large addressable market with low penetration',
          revenueProjection: {
            year1: 2000000,
            year3: 10000000,
            year5: 50000000,
          },
        },
        riskAssessment: {
          overallRiskScore: 35,
          highPriorityRisks: [],
          mediumPriorityRisks: [],
          lowPriorityRisks: [],
          riskMitigationPlan: ['Regular customer feedback collection', 'Competitive monitoring'],
        },
        investmentRecommendation: {
          narrative: 'TechStartup Inc represents a compelling investment opportunity in the rapidly growing enterprise automation market. The company has demonstrated strong product-market fit with impressive early traction and a world-class founding team.',
          investmentThesis: 'Enterprise automation is a massive market opportunity with TechStartup positioned to capture significant market share.',
          idealCheckSize: '$2-5M',
          idealValuationCap: '$25M cap',
          suggestedTerms: ['Board seat', 'Pro rata rights', 'Anti-dilution protection'],
          keyDiligenceQuestions: [
            'What is the customer acquisition cost trend?',
            'How defensible is the technology moat?',
            'What are the key competitive threats?',
          ],
          followUpActions: ['Reference calls with customers', 'Technical deep dive'],
          timelineToDecision: '2-3 weeks',
        },
        analysisWeightings: {
          marketOpportunity: 25,
          team: 25,
          traction: 20,
          product: 15,
          competitivePosition: 15,
        },
        metadata: {
          generatedBy: 'Aegis AI v1.0',
          analysisVersion: '1.0.0',
          sourceDocuments: ['pitch_deck.pdf', 'transcript.txt'],
          processingTime: 45.2,
          dataQuality: 0.85,
        },
      },
    };

    it('should validate correct deal memo', () => {
      expect(() => validateDealMemo(validDealMemo)).not.toThrow();
    });

    it('should reject deal memo with invalid signal score', () => {
      const invalid = {
        ...validDealMemo,
        aegisDealMemo: {
          ...validDealMemo.aegisDealMemo,
          summary: {
            ...validDealMemo.aegisDealMemo.summary,
            signalScore: 150,
          },
        },
      };
      expect(() => validateDealMemo(invalid)).toThrow();
    });

    it('should reject deal memo with invalid weightings', () => {
      const invalid = {
        ...validDealMemo,
        aegisDealMemo: {
          ...validDealMemo.aegisDealMemo,
          analysisWeightings: {
            marketOpportunity: 50,
            team: 25,
            traction: 20,
            product: 15,
            competitivePosition: 15,
          },
        },
      };
      expect(() => validateDealMemo(invalid)).toThrow();
    });
  });

  describe('Validation Reporting', () => {
    it('should provide detailed validation report for valid data', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: new Date(),
        updatedAt: new Date(),
        name: 'TechStartup Inc',
        oneLiner: 'Revolutionary AI platform for enterprise automation',
        sector: 'Enterprise Software',
        stage: FundingStage.SERIES_A,
        foundedYear: 2020,
        location: 'San Francisco, CA',
      };

      const report = validateWithReport(companyProfileSchema, validData, 'Company Profile');
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.summary).toContain('validation passed');
    });

    it('should provide detailed validation report for invalid data', () => {
      const invalidData = {
        name: '', // Invalid: empty name
        oneLiner: 'Short', // Invalid: too short
        foundedYear: 1800, // Invalid: too old
      };

      const report = validateWithReport(companyProfileSchema, invalidData, 'Company Profile');
      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.summary).toContain('validation failed');
    });
  });

  describe('Utility Functions', () => {
    describe('normalizeWeightings', () => {
      it('should normalize weightings to sum to 100', () => {
        const weightings = {
          marketOpportunity: 30,
          team: 30,
          traction: 20,
          product: 10,
          competitivePosition: 10,
        };

        const normalized = normalizeWeightings(weightings);
        const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
        expect(Math.abs(total - 100)).toBeLessThan(0.01);
      });

      it('should handle weightings that do not sum to 100', () => {
        const weightings = {
          marketOpportunity: 40,
          team: 40,
          traction: 30,
          product: 20,
          competitivePosition: 20,
        };

        const normalized = normalizeWeightings(weightings);
        const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
        expect(Math.abs(total - 100)).toBeLessThan(0.01);
      });

      it('should throw error for all zero weightings', () => {
        const weightings = {
          marketOpportunity: 0,
          team: 0,
          traction: 0,
          product: 0,
          competitivePosition: 0,
        };

        expect(() => normalizeWeightings(weightings)).toThrow('All weightings cannot be zero');
      });
    });
  });
});