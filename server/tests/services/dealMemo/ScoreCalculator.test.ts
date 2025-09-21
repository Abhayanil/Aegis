// ScoreCalculator test suite
import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreCalculator, ScoringContext, ScoreBreakdown } from '../../../src/services/dealMemo/ScoreCalculator.js';
import { AnalysisWeightings } from '../../../src/models/DealMemo.js';
import { AnalysisResult, MarketClaims, TeamProfile } from '../../../src/models/AnalysisResult.js';
import { InvestmentMetrics } from '../../../src/models/InvestmentMetrics.js';
import { CompanyProfile } from '../../../src/models/CompanyProfile.js';
import { AnalysisType, FundingStage } from '../../../src/types/enums.js';

describe('ScoreCalculator', () => {
  let scoreCalculator: ScoreCalculator;
  let mockAnalysisResult: AnalysisResult;
  let defaultWeightings: AnalysisWeightings;

  beforeEach(() => {
    scoreCalculator = new ScoreCalculator();
    
    defaultWeightings = {
      marketOpportunity: 25,
      team: 25,
      traction: 20,
      product: 15,
      competitivePosition: 15
    };

    mockAnalysisResult = {
      id: 'test-analysis',
      createdAt: new Date(),
      updatedAt: new Date(),
      companyProfile: {
        id: 'test-company',
        name: 'Test Company',
        oneLiner: 'AI-powered test solution',
        sector: 'SaaS',
        stage: FundingStage.SERIES_A,
        foundedYear: 2020,
        location: 'San Francisco',
        createdAt: new Date(),
        updatedAt: new Date()
      } as CompanyProfile,
      extractedMetrics: {
        id: 'test-metrics',
        revenue: {
          arr: 1_000_000,
          mrr: 83_333,
          growthRate: 150,
          projectedArr: [1_500_000, 3_000_000, 6_000_000]
        },
        traction: {
          customers: 500,
          customerGrowthRate: 20,
          churnRate: 3,
          nps: 65,
          ltvCacRatio: 4
        },
        team: {
          size: 25,
          foundersCount: 2,
          keyHires: []
        },
        funding: {
          totalRaised: 5_000_000,
          currentAsk: 10_000_000,
          stage: FundingStage.SERIES_A
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        extractionTimestamp: new Date(),
        sourceDocuments: ['doc1'],
        confidence: 0.8
      } as InvestmentMetrics,
      marketClaims: {
        tam: 50_000_000_000,
        sam: 5_000_000_000,
        som: 500_000_000,
        marketGrowthRate: 25,
        competitorCount: 5,
        marketDescription: 'Large and growing market',
        competitiveLandscape: ['Competitor A', 'Competitor B'],
        marketTrends: ['AI adoption', 'Remote work'],
        opportunities: ['Enterprise expansion', 'International markets']
      } as MarketClaims,
      teamAssessment: {
        founders: [
          {
            name: 'John Doe',
            role: 'CEO',
            yearsExperience: 12,
            education: 'Stanford MBA',
            previousCompanies: ['Google', 'Stripe'],
            isFounder: true
          },
          {
            name: 'Jane Smith',
            role: 'CTO',
            yearsExperience: 10,
            education: 'MIT CS',
            previousCompanies: ['Facebook', 'Uber'],
            isFounder: true
          }
        ],
        keyEmployees: [],
        advisors: [],
        totalSize: 25,
        averageExperience: 11,
        domainExpertise: ['AI/ML', 'SaaS', 'Enterprise Sales'],
        previousExits: 1,
        educationBackground: ['Stanford', 'MIT'],
        networkStrength: 0.8
      } as TeamProfile,
      productProfile: {
        description: 'AI-powered analytics platform',
        stage: 'production',
        features: ['Real-time analytics', 'ML predictions', 'API integration'],
        differentiators: ['Proprietary AI models', 'Real-time processing', 'Easy integration'],
        technologyStack: ['Python', 'TensorFlow', 'Kubernetes', 'AWS'],
        intellectualProperty: ['Patent pending on ML algorithm', 'Trademark'],
        roadmap: ['Mobile app', 'Advanced analytics', 'International expansion']
      },
      competitiveAnalysis: {
        directCompetitors: ['Competitor A', 'Competitor B'],
        indirectCompetitors: ['Alternative C', 'Alternative D'],
        competitiveAdvantages: ['First-mover advantage', 'Superior technology', 'Strong team'],
        threats: ['New entrants', 'Price competition'],
        moatStrength: 0.7,
        marketPosition: 'challenger'
      },
      consistencyFlags: [],
      analysisType: AnalysisType.COMPREHENSIVE,
      confidence: 0.85,
      processingTime: 1500,
      sourceDocumentIds: ['doc1', 'doc2']
    };
  });

  describe('calculateSignalScore', () => {
    it('should calculate a complete score breakdown', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);

      expect(result).toBeDefined();
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.methodology).toContain('Signal score calculated');
    });

    it('should have all component scores', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);

      expect(result.rawComponents.marketOpportunity).toBeGreaterThan(0);
      expect(result.rawComponents.team).toBeGreaterThan(0);
      expect(result.rawComponents.traction).toBeGreaterThan(0);
      expect(result.rawComponents.product).toBeGreaterThan(0);
      expect(result.rawComponents.competitivePosition).toBeGreaterThan(0);
    });

    it('should apply weightings correctly', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const customWeightings: AnalysisWeightings = {
        marketOpportunity: 50,
        team: 30,
        traction: 20,
        product: 0,
        competitivePosition: 0
      };

      const result = scoreCalculator.calculateSignalScore(context, customWeightings);

      expect(result.weightedComponents.product).toBe(0);
      expect(result.weightedComponents.competitivePosition).toBe(0);
      expect(result.weightedComponents.marketOpportunity).toBeGreaterThan(
        result.weightedComponents.team
      );
    });

    it('should handle high-performing startup', () => {
      const highPerformingResult = {
        ...mockAnalysisResult,
        extractedMetrics: {
          ...mockAnalysisResult.extractedMetrics,
          revenue: {
            arr: 10_000_000,
            growthRate: 300,
            mrr: 833_333
          },
          traction: {
            customers: 5000,
            customerGrowthRate: 50,
            churnRate: 1,
            nps: 80,
            ltvCacRatio: 8
          }
        },
        marketClaims: {
          ...mockAnalysisResult.marketClaims,
          tam: 100_000_000_000,
          marketGrowthRate: 40,
          competitorCount: 2
        }
      };

      const context: ScoringContext = {
        analysisResult: highPerformingResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);

      expect(result.totalScore).toBeGreaterThan(70);
      expect(result.rawComponents.traction).toBeGreaterThan(80);
      expect(result.rawComponents.marketOpportunity).toBeGreaterThan(75);
    });

    it('should handle low-performing startup', () => {
      const lowPerformingResult = {
        ...mockAnalysisResult,
        extractedMetrics: {
          ...mockAnalysisResult.extractedMetrics,
          revenue: {
            arr: 10_000,
            growthRate: 10,
            mrr: 833
          },
          traction: {
            customers: 10,
            customerGrowthRate: 5,
            churnRate: 15,
            nps: 20,
            ltvCacRatio: 0.5
          }
        },
        marketClaims: {
          ...mockAnalysisResult.marketClaims,
          tam: 10_000_000,
          marketGrowthRate: 2,
          competitorCount: 50
        },
        teamAssessment: {
          ...mockAnalysisResult.teamAssessment,
          averageExperience: 2,
          previousExits: 0,
          domainExpertise: []
        }
      };

      const context: ScoringContext = {
        analysisResult: lowPerformingResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);

      expect(result.totalScore).toBeLessThan(50);
      expect(result.rawComponents.traction).toBeLessThan(40);
      expect(result.rawComponents.marketOpportunity).toBeLessThan(60);
    });
  });

  describe('market opportunity scoring', () => {
    it('should score large TAM highly', () => {
      const largeMarketResult = {
        ...mockAnalysisResult,
        marketClaims: {
          ...mockAnalysisResult.marketClaims,
          tam: 50_000_000_000, // $50B
          marketGrowthRate: 30,
          competitorCount: 3
        }
      };

      const context: ScoringContext = {
        analysisResult: largeMarketResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.marketOpportunity).toBeGreaterThan(70);
    });

    it('should penalize small TAM', () => {
      const smallMarketResult = {
        ...mockAnalysisResult,
        marketClaims: {
          ...mockAnalysisResult.marketClaims,
          tam: 5_000_000, // $5M
          marketGrowthRate: 5,
          competitorCount: 20
        }
      };

      const context: ScoringContext = {
        analysisResult: smallMarketResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.marketOpportunity).toBeLessThan(40);
    });
  });

  describe('team scoring', () => {
    it('should score experienced founders highly', () => {
      const experiencedTeamResult = {
        ...mockAnalysisResult,
        teamAssessment: {
          ...mockAnalysisResult.teamAssessment,
          averageExperience: 20,
          previousExits: 2,
          domainExpertise: ['AI/ML', 'SaaS', 'Enterprise', 'Security'],
          networkStrength: 0.9
        }
      };

      const context: ScoringContext = {
        analysisResult: experiencedTeamResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.team).toBeGreaterThan(80);
    });

    it('should score inexperienced team lower', () => {
      const inexperiencedTeamResult = {
        ...mockAnalysisResult,
        teamAssessment: {
          ...mockAnalysisResult.teamAssessment,
          averageExperience: 1,
          previousExits: 0,
          domainExpertise: [],
          networkStrength: 0.2
        }
      };

      const context: ScoringContext = {
        analysisResult: inexperiencedTeamResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.team).toBeLessThan(40);
    });
  });

  describe('traction scoring', () => {
    it('should score high growth highly', () => {
      const highGrowthResult = {
        ...mockAnalysisResult,
        extractedMetrics: {
          ...mockAnalysisResult.extractedMetrics,
          revenue: {
            arr: 5_000_000,
            growthRate: 400, // 4x growth
            mrr: 416_667
          },
          traction: {
            customers: 2000,
            customerGrowthRate: 100,
            churnRate: 1,
            nps: 85,
            ltvCacRatio: 10
          }
        }
      };

      const context: ScoringContext = {
        analysisResult: highGrowthResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.traction).toBeGreaterThan(85);
    });

    it('should penalize negative growth', () => {
      const negativeGrowthResult = {
        ...mockAnalysisResult,
        extractedMetrics: {
          ...mockAnalysisResult.extractedMetrics,
          revenue: {
            arr: 100_000,
            growthRate: -20, // Declining
            mrr: 8_333
          },
          traction: {
            customers: 50,
            customerGrowthRate: -10,
            churnRate: 25,
            nps: 10,
            ltvCacRatio: 0.3
          }
        }
      };

      const context: ScoringContext = {
        analysisResult: negativeGrowthResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.traction).toBeLessThan(30);
    });
  });

  describe('product scoring', () => {
    it('should score production-ready product highly', () => {
      const matureProductResult = {
        ...mockAnalysisResult,
        productProfile: {
          ...mockAnalysisResult.productProfile!,
          stage: 'scale',
          differentiators: ['Unique AI', 'Patent protection', 'Network effects', 'Data moat'],
          intellectualProperty: ['3 patents', '2 trademarks', 'Trade secrets'],
          technologyStack: ['AI', 'ML', 'blockchain', 'cloud', 'microservices']
        }
      };

      const context: ScoringContext = {
        analysisResult: matureProductResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.product).toBeGreaterThan(75);
    });

    it('should score concept stage lower', () => {
      const conceptProductResult = {
        ...mockAnalysisResult,
        productProfile: {
          ...mockAnalysisResult.productProfile!,
          stage: 'concept',
          differentiators: [],
          intellectualProperty: [],
          technologyStack: ['PHP', 'MySQL']
        }
      };

      const context: ScoringContext = {
        analysisResult: conceptProductResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.product).toBeLessThan(40);
    });
  });

  describe('competitive position scoring', () => {
    it('should score strong moat highly', () => {
      const strongMoatResult = {
        ...mockAnalysisResult,
        competitiveAnalysis: {
          ...mockAnalysisResult.competitiveAnalysis!,
          moatStrength: 0.9,
          competitiveAdvantages: ['Network effects', 'Data moat', 'Brand', 'Patents', 'Switching costs'],
          marketPosition: 'leader',
          threats: []
        }
      };

      const context: ScoringContext = {
        analysisResult: strongMoatResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.competitivePosition).toBeGreaterThan(80);
    });

    it('should score weak position lower', () => {
      const weakPositionResult = {
        ...mockAnalysisResult,
        competitiveAnalysis: {
          ...mockAnalysisResult.competitiveAnalysis!,
          moatStrength: 0.2,
          competitiveAdvantages: [],
          marketPosition: 'follower',
          threats: ['Price competition', 'New entrants', 'Substitutes', 'Regulation']
        }
      };

      const context: ScoringContext = {
        analysisResult: weakPositionResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.rawComponents.competitivePosition).toBeLessThan(40);
    });
  });

  describe('confidence calculation', () => {
    it('should have high confidence with complete data', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should have lower confidence with missing data', () => {
      const incompleteResult = {
        ...mockAnalysisResult,
        extractedMetrics: {
          ...mockAnalysisResult.extractedMetrics,
          revenue: {
            // Missing ARR
            growthRate: 50
          }
        },
        teamAssessment: {
          ...mockAnalysisResult.teamAssessment,
          founders: [] // No founder data
        },
        confidence: 0.4
      };

      const context: ScoringContext = {
        analysisResult: incompleteResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('input validation', () => {
    it('should validate scoring inputs', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const errors = scoreCalculator.validateScoringInputs(context, defaultWeightings);
      expect(errors).toHaveLength(0);
    });

    it('should detect missing analysis result', () => {
      const context: ScoringContext = {
        analysisResult: null as any
      };

      const errors = scoreCalculator.validateScoringInputs(context, defaultWeightings);
      expect(errors).toContain('Analysis result is required for scoring');
    });

    it('should detect invalid weightings', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const invalidWeightings: AnalysisWeightings = {
        marketOpportunity: 30,
        team: 30,
        traction: 30,
        product: 30,
        competitivePosition: 30 // Total: 150%
      };

      const errors = scoreCalculator.validateScoringInputs(context, invalidWeightings);
      expect(errors.some(error => error.includes('must sum to 100%'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional data gracefully', () => {
      const minimalResult = {
        ...mockAnalysisResult,
        marketClaims: {} as MarketClaims,
        productProfile: undefined,
        competitiveAnalysis: undefined
      };

      const context: ScoringContext = {
        analysisResult: minimalResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should normalize extreme scores', () => {
      const context: ScoringContext = {
        analysisResult: mockAnalysisResult
      };

      const result = scoreCalculator.calculateSignalScore(context, defaultWeightings);
      
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      
      Object.values(result.rawComponents).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });
});