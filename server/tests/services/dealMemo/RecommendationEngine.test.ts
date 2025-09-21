// RecommendationEngine test suite
import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendationEngine, RecommendationContext } from '../../../src/services/dealMemo/RecommendationEngine.js';
import { ScoreBreakdown, ScoreComponents } from '../../../src/services/dealMemo/ScoreCalculator.js';
import { AnalysisWeightings } from '../../../src/models/DealMemo.js';
import { AnalysisResult } from '../../../src/models/AnalysisResult.js';
import { RiskFlag } from '../../../src/models/RiskFlag.js';
import { BenchmarkComparison } from '../../../src/models/BenchmarkData.js';
import { RecommendationType, RiskSeverity, FundingStage, AnalysisType } from '../../../src/types/enums.js';

describe('RecommendationEngine', () => {
  let recommendationEngine: RecommendationEngine;
  let mockContext: RecommendationContext;

  beforeEach(() => {
    recommendationEngine = new RecommendationEngine();

    const mockAnalysisResult: AnalysisResult = {
      id: 'test-analysis',
      createdAt: new Date(),
      updatedAt: new Date(),
      companyProfile: {
        id: 'test-company',
        name: 'TestCorp',
        oneLiner: 'AI-powered analytics platform',
        sector: 'SaaS',
        stage: FundingStage.SERIES_A,
        foundedYear: 2020,
        location: 'San Francisco',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      extractedMetrics: {
        id: 'test-metrics',
        revenue: {
          arr: 2_000_000,
          mrr: 166_667,
          growthRate: 120
        },
        traction: {
          customers: 150,
          customerGrowthRate: 25,
          churnRate: 3,
          nps: 70,
          ltvCacRatio: 5
        },
        team: {
          size: 30,
          foundersCount: 2,
          keyHires: []
        },
        funding: {
          totalRaised: 8_000_000,
          currentAsk: 15_000_000,
          stage: FundingStage.SERIES_A
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        extractionTimestamp: new Date(),
        sourceDocuments: ['doc1'],
        confidence: 0.85
      },
      marketClaims: {
        tam: 25_000_000_000,
        sam: 2_500_000_000,
        marketGrowthRate: 30,
        competitorCount: 8,
        opportunities: ['Enterprise expansion', 'International markets'],
        marketTrends: ['AI adoption', 'Digital transformation']
      },
      teamAssessment: {
        founders: [
          {
            name: 'John Doe',
            role: 'CEO',
            yearsExperience: 15,
            isFounder: true
          }
        ],
        keyEmployees: [],
        advisors: [],
        totalSize: 30,
        averageExperience: 12,
        domainExpertise: ['AI/ML', 'SaaS', 'Enterprise'],
        previousExits: 1
      },
      productProfile: {
        description: 'AI analytics platform',
        stage: 'production',
        features: ['Real-time analytics', 'ML predictions'],
        differentiators: ['Proprietary AI', 'Real-time processing'],
        technologyStack: ['Python', 'TensorFlow', 'Kubernetes'],
        roadmap: ['Mobile app', 'Advanced analytics']
      },
      competitiveAnalysis: {
        directCompetitors: ['Competitor A', 'Competitor B'],
        indirectCompetitors: ['Alternative C'],
        competitiveAdvantages: ['First-mover advantage', 'Superior technology'],
        threats: ['New entrants'],
        moatStrength: 0.7,
        marketPosition: 'challenger'
      },
      consistencyFlags: [],
      analysisType: AnalysisType.COMPREHENSIVE,
      confidence: 0.85,
      processingTime: 1500,
      sourceDocumentIds: ['doc1', 'doc2']
    };

    const mockScoreBreakdown: ScoreBreakdown = {
      totalScore: 75,
      weightedComponents: {
        marketOpportunity: 20,
        team: 18,
        traction: 16,
        product: 12,
        competitivePosition: 9
      } as ScoreComponents,
      rawComponents: {
        marketOpportunity: 80,
        team: 72,
        traction: 80,
        product: 80,
        competitivePosition: 60
      } as ScoreComponents,
      weightings: {
        marketOpportunity: 25,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 15
      } as AnalysisWeightings,
      confidence: 0.85,
      methodology: 'Test methodology'
    };

    const mockRiskFlags: RiskFlag[] = [
      {
        id: 'risk-1',
        type: 'MARKET_SIZE_CONCERN',
        severity: RiskSeverity.MEDIUM,
        description: 'Market size assumptions may be optimistic',
        affectedMetrics: ['TAM'],
        suggestedMitigation: 'Validate market size with third-party research',
        sourceDocuments: ['doc1'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const mockBenchmarkComparisons: BenchmarkComparison[] = [
      {
        metric: 'ARR Growth Rate',
        companyValue: 120,
        sectorMedian: 85,
        percentile: 75,
        interpretation: 'Above average performance'
      }
    ];

    mockContext = {
      analysisResult: mockAnalysisResult,
      scoreBreakdown: mockScoreBreakdown,
      riskFlags: mockRiskFlags,
      benchmarkComparisons: mockBenchmarkComparisons,
      weightings: mockScoreBreakdown.weightings
    };
  });

  describe('generateDealMemo', () => {
    it('should generate a complete deal memo', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);

      expect(dealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary).toBeDefined();
      expect(dealMemo.aegisDealMemo.growthPotential).toBeDefined();
      expect(dealMemo.aegisDealMemo.riskAssessment).toBeDefined();
      expect(dealMemo.aegisDealMemo.investmentRecommendation).toBeDefined();
    });

    it('should include all required summary fields', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const summary = dealMemo.aegisDealMemo.summary;

      expect(summary.companyName).toBe('TestCorp');
      expect(summary.oneLiner).toBe('AI-powered analytics platform');
      expect(summary.sector).toBe('SaaS');
      expect(summary.stage).toBe(FundingStage.SERIES_A);
      expect(summary.signalScore).toBe(75);
      expect(summary.recommendation).toBeDefined();
      expect(summary.confidenceLevel).toBe(0.85);
    });

    it('should include growth potential analysis', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const growth = dealMemo.aegisDealMemo.growthPotential;

      expect(growth.upsideSummary).toBeDefined();
      expect(growth.growthTimeline).toBeDefined();
      expect(growth.keyDrivers).toBeInstanceOf(Array);
      expect(growth.scalabilityFactors).toBeInstanceOf(Array);
      expect(growth.revenueProjection).toBeDefined();
      expect(growth.revenueProjection.year1).toBeGreaterThan(0);
      expect(growth.revenueProjection.year3).toBeGreaterThan(0);
      expect(growth.revenueProjection.year5).toBeGreaterThan(0);
    });

    it('should include risk assessment', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const risk = dealMemo.aegisDealMemo.riskAssessment;

      expect(risk.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(risk.highPriorityRisks).toBeInstanceOf(Array);
      expect(risk.mediumPriorityRisks).toBeInstanceOf(Array);
      expect(risk.lowPriorityRisks).toBeInstanceOf(Array);
      expect(risk.riskMitigationPlan).toBeInstanceOf(Array);
    });

    it('should include investment recommendation', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const recommendation = dealMemo.aegisDealMemo.investmentRecommendation;

      expect(recommendation.narrative).toBeDefined();
      expect(recommendation.investmentThesis).toBeDefined();
      expect(recommendation.idealCheckSize).toBeDefined();
      expect(recommendation.idealValuationCap).toBeDefined();
      expect(recommendation.keyDiligenceQuestions).toBeInstanceOf(Array);
      expect(recommendation.followUpActions).toBeInstanceOf(Array);
      expect(recommendation.timelineToDecision).toBeDefined();
    });
  });

  describe('recommendation types', () => {
    it('should recommend STRONG_BUY for high score with no high risks', () => {
      const highScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 85
        },
        riskFlags: [] // No high risks
      };

      const dealMemo = recommendationEngine.generateDealMemo(highScoreContext);
      expect(dealMemo.aegisDealMemo.summary.recommendation).toBe(RecommendationType.STRONG_BUY);
    });

    it('should recommend BUY for good score with minimal risks', () => {
      const goodScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 70
        },
        riskFlags: [
          {
            ...mockContext.riskFlags[0],
            severity: RiskSeverity.MEDIUM
          }
        ]
      };

      const dealMemo = recommendationEngine.generateDealMemo(goodScoreContext);
      expect(dealMemo.aegisDealMemo.summary.recommendation).toBe(RecommendationType.BUY);
    });

    it('should recommend PASS for low score', () => {
      const lowScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 30
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(lowScoreContext);
      expect(dealMemo.aegisDealMemo.summary.recommendation).toBe(RecommendationType.PASS);
    });

    it('should recommend PASS for high risks regardless of score', () => {
      const highRiskContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 80
        },
        riskFlags: [
          {
            id: 'risk-1',
            type: 'FINANCIAL_INCONSISTENCY',
            severity: RiskSeverity.HIGH,
            description: 'Major financial discrepancies',
            affectedMetrics: ['ARR'],
            suggestedMitigation: 'Request detailed financials',
            sourceDocuments: ['doc1'],
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'risk-2',
            type: 'COMPETITIVE_THREAT',
            severity: RiskSeverity.HIGH,
            description: 'Strong competitive threats',
            affectedMetrics: ['Market Share'],
            suggestedMitigation: 'Develop competitive strategy',
            sourceDocuments: ['doc2'],
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'risk-3',
            type: 'MARKET_SIZE_CONCERN',
            severity: RiskSeverity.HIGH,
            description: 'Market size concerns',
            affectedMetrics: ['TAM'],
            suggestedMitigation: 'Validate market research',
            sourceDocuments: ['doc3'],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      const dealMemo = recommendationEngine.generateDealMemo(highRiskContext);
      expect(dealMemo.aegisDealMemo.summary.recommendation).toBe(RecommendationType.PASS);
    });
  });

  describe('narrative generation', () => {
    it('should generate compelling narrative for high-scoring company', () => {
      const highScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 85
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(highScoreContext);
      const narrative = dealMemo.aegisDealMemo.investmentRecommendation.narrative;

      expect(narrative).toContain('compelling investment opportunity');
      expect(narrative).toContain('TestCorp');
      expect(narrative).toContain('SaaS');
    });

    it('should generate cautious narrative for low-scoring company', () => {
      const lowScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 35
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(lowScoreContext);
      const narrative = dealMemo.aegisDealMemo.investmentRecommendation.narrative;

      expect(narrative).toContain('challenging investment case');
    });

    it('should include market size in narrative', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const narrative = dealMemo.aegisDealMemo.investmentRecommendation.narrative;

      expect(narrative).toContain('$25.0B market');
      expect(narrative).toContain('30% annually');
    });

    it('should include traction metrics in narrative', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const narrative = dealMemo.aegisDealMemo.investmentRecommendation.narrative;

      expect(narrative).toContain('$2.0M');
      expect(narrative).toContain('120%');
    });
  });

  describe('investment thesis generation', () => {
    it('should focus on top-scoring component', () => {
      const marketFocusedContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          rawComponents: {
            marketOpportunity: 90,
            team: 60,
            traction: 70,
            product: 65,
            competitivePosition: 55
          } as ScoreComponents
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(marketFocusedContext);
      const thesis = dealMemo.aegisDealMemo.investmentRecommendation.investmentThesis;

      expect(thesis).toContain('market opportunity');
    });

    it('should include growth drivers', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const thesis = dealMemo.aegisDealMemo.investmentRecommendation.investmentThesis;

      expect(thesis).toBeDefined();
      expect(thesis.length).toBeGreaterThan(50);
    });
  });

  describe('due diligence questions', () => {
    it('should generate risk-based questions', () => {
      const highRiskContext = {
        ...mockContext,
        riskFlags: [
          {
            id: 'risk-1',
            type: 'FINANCIAL_INCONSISTENCY',
            severity: RiskSeverity.HIGH,
            description: 'Financial discrepancies found',
            affectedMetrics: ['ARR'],
            suggestedMitigation: 'Request detailed financials',
            sourceDocuments: ['doc1'],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      const dealMemo = recommendationEngine.generateDealMemo(highRiskContext);
      const questions = dealMemo.aegisDealMemo.investmentRecommendation.keyDiligenceQuestions;

      expect(questions.some(q => q.includes('financial statements'))).toBe(true);
    });

    it('should generate component-specific questions for low scores', () => {
      const lowTractionContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          rawComponents: {
            marketOpportunity: 70,
            team: 70,
            traction: 30, // Low traction score
            product: 70,
            competitivePosition: 70
          } as ScoreComponents
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(lowTractionContext);
      const questions = dealMemo.aegisDealMemo.investmentRecommendation.keyDiligenceQuestions;

      expect(questions.some(q => q.includes('customer acquisition'))).toBe(true);
    });

    it('should limit questions to reasonable number', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const questions = dealMemo.aegisDealMemo.investmentRecommendation.keyDiligenceQuestions;

      expect(questions.length).toBeLessThanOrEqual(8);
    });
  });

  describe('valuation and check size suggestions', () => {
    it('should suggest appropriate check size based on score', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const checkSize = dealMemo.aegisDealMemo.investmentRecommendation.idealCheckSize;

      expect(checkSize).toContain('$');
      expect(checkSize).toContain('M');
      expect(checkSize).toContain('%');
    });

    it('should suggest higher check size for higher scores', () => {
      const highScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 85
        }
      };

      const lowScoreContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 45
        }
      };

      const highScoreMemo = recommendationEngine.generateDealMemo(highScoreContext);
      const lowScoreMemo = recommendationEngine.generateDealMemo(lowScoreContext);

      const highCheckSize = parseFloat(highScoreMemo.aegisDealMemo.investmentRecommendation.idealCheckSize.match(/\$(\d+\.?\d*)M/)?.[1] || '0');
      const lowCheckSize = parseFloat(lowScoreMemo.aegisDealMemo.investmentRecommendation.idealCheckSize.match(/\$(\d+\.?\d*)M/)?.[1] || '0');

      expect(highCheckSize).toBeGreaterThan(lowCheckSize);
    });

    it('should suggest valuation cap based on ARR and stage', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const valuationCap = dealMemo.aegisDealMemo.investmentRecommendation.idealValuationCap;

      expect(valuationCap).toContain('$');
      expect(valuationCap).toContain('M');
      expect(valuationCap).toContain('-');
    });
  });

  describe('timeline suggestions', () => {
    it('should suggest fast track for high scores with low risk', () => {
      const fastTrackContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 85
        },
        riskFlags: []
      };

      const dealMemo = recommendationEngine.generateDealMemo(fastTrackContext);
      const timeline = dealMemo.aegisDealMemo.investmentRecommendation.timelineToDecision;

      expect(timeline).toContain('2-3 weeks');
      expect(timeline).toContain('fast track');
    });

    it('should suggest extended timeline for high risks', () => {
      const highRiskContext = {
        ...mockContext,
        scoreBreakdown: {
          ...mockContext.scoreBreakdown,
          totalScore: 45
        },
        riskFlags: [
          {
            id: 'risk-1',
            type: 'FINANCIAL_INCONSISTENCY',
            severity: RiskSeverity.HIGH,
            description: 'Major concerns',
            affectedMetrics: ['ARR'],
            suggestedMitigation: 'Extended review',
            sourceDocuments: ['doc1'],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      };

      const dealMemo = recommendationEngine.generateDealMemo(highRiskContext);
      const timeline = dealMemo.aegisDealMemo.investmentRecommendation.timelineToDecision;

      expect(timeline).toContain('6-8 weeks');
      expect(timeline).toContain('extended');
    });
  });

  describe('growth projections', () => {
    it('should generate realistic revenue projections', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const projections = dealMemo.aegisDealMemo.growthPotential.revenueProjection;

      expect(projections.year1).toBeGreaterThan(mockContext.analysisResult.extractedMetrics.revenue.arr!);
      expect(projections.year3).toBeGreaterThan(projections.year1);
      expect(projections.year5).toBeGreaterThan(projections.year3);
    });

    it('should identify growth drivers', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const drivers = dealMemo.aegisDealMemo.growthPotential.keyDrivers;

      expect(drivers).toBeInstanceOf(Array);
      expect(drivers.length).toBeGreaterThan(0);
    });

    it('should identify scalability factors', () => {
      const dealMemo = recommendationEngine.generateDealMemo(mockContext);
      const factors = dealMemo.aegisDealMemo.growthPotential.scalabilityFactors;

      expect(factors).toBeInstanceOf(Array);
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional data gracefully', () => {
      const minimalContext = {
        ...mockContext,
        analysisResult: {
          ...mockContext.analysisResult,
          marketClaims: {},
          productProfile: undefined,
          competitiveAnalysis: undefined
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(minimalContext);
      
      expect(dealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary).toBeDefined();
      expect(dealMemo.aegisDealMemo.investmentRecommendation.narrative).toBeDefined();
    });

    it('should handle zero ARR gracefully', () => {
      const zeroArrContext = {
        ...mockContext,
        analysisResult: {
          ...mockContext.analysisResult,
          extractedMetrics: {
            ...mockContext.analysisResult.extractedMetrics,
            revenue: {
              arr: 0,
              growthRate: 0
            }
          }
        }
      };

      const dealMemo = recommendationEngine.generateDealMemo(zeroArrContext);
      
      expect(dealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo.investmentRecommendation.idealValuationCap).toBeDefined();
    });
  });
});