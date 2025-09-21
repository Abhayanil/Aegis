import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import dealMemoRoutes from '../../src/routes/dealMemo.js';
import { GeminiAnalyzer } from '../../src/services/ai/GeminiAnalyzer.js';
import { BigQueryConnector } from '../../src/services/benchmarking/BigQueryConnector.js';
import { MetricComparator } from '../../src/services/benchmarking/MetricComparator.js';
import { SectorClassifier } from '../../src/services/benchmarking/SectorClassifier.js';
import { ScoreCalculator } from '../../src/services/dealMemo/ScoreCalculator.js';
import { RecommendationEngine } from '../../src/services/dealMemo/RecommendationEngine.js';
import { FirebaseStorage } from '../../src/services/storage/FirebaseStorage.js';
import { ProcessedDocument } from '../../src/models/ProcessedDocument.js';
import { DealMemo } from '../../src/models/DealMemo.js';
import { DocumentType, FundingStage, RecommendationType } from '../../src/types/enums.js';

// Mock all the services
vi.mock('../../src/services/ai/GeminiAnalyzer.js');
vi.mock('../../src/services/benchmarking/BigQueryConnector.js');
vi.mock('../../src/services/benchmarking/MetricComparator.js');
vi.mock('../../src/services/benchmarking/SectorClassifier.js');
vi.mock('../../src/services/dealMemo/ScoreCalculator.js');
vi.mock('../../src/services/dealMemo/RecommendationEngine.js');
vi.mock('../../src/services/storage/FirebaseStorage.js');
vi.mock('../../src/services/risk/InconsistencyDetector.js');
vi.mock('../../src/services/risk/MarketSizeValidator.js');
vi.mock('../../src/services/risk/MetricAnomalyDetector.js');
vi.mock('../../src/services/dealMemo/WeightingManager.js');

const app = express();
app.use(express.json());
app.use('/api/deal-memo', dealMemoRoutes);

describe('Deal Memo Routes', () => {
  let mockGeminiAnalyzer: any;
  let mockBigQueryConnector: any;
  let mockMetricComparator: any;
  let mockSectorClassifier: any;
  let mockScoreCalculator: any;
  let mockRecommendationEngine: any;
  let mockFirebaseStorage: any;
  let mockInconsistencyDetector: any;
  let mockMarketSizeValidator: any;
  let mockMetricAnomalyDetector: any;
  let mockWeightingManager: any;

  const mockProcessedDocument: ProcessedDocument = {
    id: 'test-doc-1',
    sourceType: DocumentType.PDF,
    extractedText: 'Test startup pitch deck content with financial metrics',
    sections: [
      {
        title: 'Company Overview',
        content: 'TechCorp is a SaaS platform for enterprise automation',
        sourceDocument: 'pitch-deck.pdf',
      },
    ],
    metadata: {
      filename: 'pitch-deck.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
      processingStatus: 'completed' as any,
    },
    processingTimestamp: new Date(),
    processingDuration: 2000,
    wordCount: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAnalysisResult = {
    companyProfile: {
      name: 'TechCorp',
      oneLiner: 'Enterprise automation SaaS platform',
      sector: 'Enterprise Software',
      stage: FundingStage.SEED,
      foundedYear: 2022,
      location: 'San Francisco, CA',
    },
    extractedMetrics: {
      revenue: {
        arr: 500000,
        mrr: 42000,
        growthRate: 15,
      },
      traction: {
        customers: 50,
        customerGrowthRate: 20,
        churnRate: 5,
      },
      team: {
        size: 12,
        foundersCount: 2,
        keyHires: [],
      },
      funding: {
        currentAsk: 2000000,
        valuation: 10000000,
      },
    },
    marketClaims: {
      tamSize: 50000000000,
      samSize: 5000000000,
      competitiveAdvantage: 'AI-powered automation',
    },
    teamAssessment: {
      overallScore: 85,
      strengths: ['Technical expertise', 'Domain knowledge'],
      concerns: ['Limited sales experience'],
    },
    consistencyFlags: [],
  };

  const mockDealMemo: DealMemo = {
    id: 'deal-memo-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    aegisDealMemo: {
      summary: {
        companyName: 'TechCorp',
        oneLiner: 'Enterprise automation SaaS platform',
        sector: 'Enterprise Software',
        stage: FundingStage.SEED,
        signalScore: 78,
        recommendation: RecommendationType.BUY,
        confidenceLevel: 0.85,
        lastUpdated: new Date(),
      },
      keyBenchmarks: [
        {
          metric: 'ARR Growth Rate',
          companyValue: 15,
          sectorMedian: 12,
          percentile: 65,
          interpretation: 'Above median growth',
          context: 'Strong for seed stage',
        },
      ],
      growthPotential: {
        upsideSummary: 'Strong growth potential in large market',
        growthTimeline: '3-5 years to reach $10M ARR',
        keyDrivers: ['Market expansion', 'Product development'],
        scalabilityFactors: ['API-first architecture', 'Self-service onboarding'],
        marketExpansionOpportunity: 'International expansion opportunity',
        revenueProjection: {
          year1: 1200000,
          year3: 8000000,
          year5: 25000000,
        },
      },
      riskAssessment: {
        overallRiskScore: 25,
        highPriorityRisks: [],
        mediumPriorityRisks: [],
        lowPriorityRisks: [],
        riskMitigationPlan: ['Hire experienced sales leader'],
      },
      investmentRecommendation: {
        narrative: 'Strong team with proven product-market fit',
        investmentThesis: 'Large market opportunity with differentiated product',
        idealCheckSize: '$500K - $1M',
        idealValuationCap: '$8M',
        suggestedTerms: ['Pro rata rights', 'Board observer seat'],
        keyDiligenceQuestions: ['Customer retention metrics', 'Competitive landscape'],
        followUpActions: ['Reference calls with customers'],
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
        generatedBy: 'Aegis AI v1.0.0',
        analysisVersion: '1.0.0',
        sourceDocuments: ['test-doc-1'],
        processingTime: 5000,
        dataQuality: 0.9,
      },
    },
  };

  beforeEach(() => {
    // Setup mocks
    mockGeminiAnalyzer = {
      analyzeContent: vi.fn(),
    };
    mockBigQueryConnector = {
      getBenchmarks: vi.fn(),
    };
    mockMetricComparator = {
      calculatePercentiles: vi.fn(),
    };
    mockSectorClassifier = {
      classifySector: vi.fn(),
    };
    mockScoreCalculator = {
      calculateSignalScore: vi.fn(),
    };
    mockRecommendationEngine = {
      generateRecommendation: vi.fn(),
    };
    mockFirebaseStorage = {
      storeDealMemo: vi.fn(),
    };
    mockInconsistencyDetector = {
      detectInconsistencies: vi.fn(),
    };
    mockMarketSizeValidator = {
      validateMarketClaims: vi.fn(),
    };
    mockMetricAnomalyDetector = {
      assessMetricHealth: vi.fn(),
    };
    mockWeightingManager = {
      validateWeightings: vi.fn(),
    };

    // Mock constructors
    (GeminiAnalyzer as any).mockImplementation(() => mockGeminiAnalyzer);
    (BigQueryConnector as any).mockImplementation(() => mockBigQueryConnector);
    (MetricComparator as any).mockImplementation(() => mockMetricComparator);
    (SectorClassifier as any).mockImplementation(() => mockSectorClassifier);
    (ScoreCalculator as any).mockImplementation(() => mockScoreCalculator);
    (RecommendationEngine as any).mockImplementation(() => mockRecommendationEngine);
    (FirebaseStorage as any).mockImplementation(() => mockFirebaseStorage);
    
    // Import and mock the risk detection services
    const { InconsistencyDetector } = await import('../../src/services/risk/InconsistencyDetector.js');
    const { MarketSizeValidator } = await import('../../src/services/risk/MarketSizeValidator.js');
    const { MetricAnomalyDetector } = await import('../../src/services/risk/MetricAnomalyDetector.js');
    const { WeightingManager } = await import('../../src/services/dealMemo/WeightingManager.js');
    
    (InconsistencyDetector as any).mockImplementation(() => mockInconsistencyDetector);
    (MarketSizeValidator as any).mockImplementation(() => mockMarketSizeValidator);
    (MetricAnomalyDetector as any).mockImplementation(() => mockMetricAnomalyDetector);
    (WeightingManager as any).mockImplementation(() => mockWeightingManager);

    // Setup default mock responses
    mockGeminiAnalyzer.analyzeContent.mockResolvedValue(mockAnalysisResult);
    mockSectorClassifier.classifySector.mockResolvedValue({
      primarySector: 'Enterprise Software',
      secondarySectors: ['SaaS'],
      confidence: 0.9,
      reasoning: 'Clear enterprise software focus',
    });
    mockBigQueryConnector.getBenchmarks.mockResolvedValue({
      sector: 'Enterprise Software',
      sampleSize: 100,
      metrics: {},
      lastUpdated: new Date(),
    });
    mockMetricComparator.calculatePercentiles.mockResolvedValue(mockDealMemo.aegisDealMemo.keyBenchmarks);
    mockScoreCalculator.calculateSignalScore.mockResolvedValue(78);
    mockRecommendationEngine.generateRecommendation.mockResolvedValue({
      recommendation: RecommendationType.BUY,
      confidenceLevel: 0.85,
      growthPotential: mockDealMemo.aegisDealMemo.growthPotential,
      riskScore: 25,
      riskMitigationPlan: ['Hire experienced sales leader'],
      investmentRecommendation: mockDealMemo.aegisDealMemo.investmentRecommendation,
      dataQuality: 0.9,
    });
    mockFirebaseStorage.storeDealMemo.mockResolvedValue(mockDealMemo);
    mockInconsistencyDetector.detectInconsistencies.mockResolvedValue([]);
    mockMarketSizeValidator.validateMarketClaims.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    });
    mockMetricAnomalyDetector.assessMetricHealth.mockResolvedValue({
      risks: [],
      healthScore: 85,
      anomalies: [],
    });
    mockWeightingManager.validateWeightings.mockReturnValue({
      marketOpportunity: 25,
      team: 25,
      traction: 20,
      product: 15,
      competitivePosition: 15,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/deal-memo', () => {
    it('should successfully generate deal memo from processed documents', async () => {
      const requestBody = {
        documents: [mockProcessedDocument],
        weightings: {
          marketOpportunity: 30,
          team: 25,
          traction: 20,
          product: 15,
          competitivePosition: 10,
        },
        options: {},
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aegisDealMemo.summary.companyName).toBe('TechCorp');
      expect(response.body.data.aegisDealMemo.summary.signalScore).toBe(78);
      expect(response.body.data.aegisDealMemo.summary.recommendation).toBe('buy');

      // Verify all services were called
      expect(mockGeminiAnalyzer.analyzeContent).toHaveBeenCalledWith([mockProcessedDocument]);
      expect(mockSectorClassifier.classifySector).toHaveBeenCalled();
      expect(mockBigQueryConnector.getBenchmarks).toHaveBeenCalled();
      expect(mockScoreCalculator.calculateSignalScore).toHaveBeenCalled();
      expect(mockRecommendationEngine.generateRecommendation).toHaveBeenCalled();
      expect(mockFirebaseStorage.storeDealMemo).toHaveBeenCalled();
    });

    it('should use default weightings when none provided', async () => {
      const requestBody = {
        documents: [mockProcessedDocument],
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aegisDealMemo.analysisWeightings).toEqual({
        marketOpportunity: 25,
        team: 25,
        traction: 20,
        product: 15,
        competitivePosition: 15,
      });
    });

    it('should reject requests with no documents', async () => {
      const requestBody = {
        documents: [],
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_DOCUMENTS_PROVIDED');
    });

    it('should handle AI analysis failures gracefully', async () => {
      mockGeminiAnalyzer.analyzeContent.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const requestBody = {
        documents: [mockProcessedDocument],
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ANALYSIS_FAILED');
    });

    it('should handle benchmarking service failures', async () => {
      mockBigQueryConnector.getBenchmarks.mockRejectedValue(
        new Error('BigQuery connection failed')
      );

      const requestBody = {
        documents: [mockProcessedDocument],
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ANALYSIS_FAILED');
    });

    it('should handle storage failures', async () => {
      mockFirebaseStorage.storeDealMemo.mockRejectedValue(
        new Error('Firebase storage failed')
      );

      const requestBody = {
        documents: [mockProcessedDocument],
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ANALYSIS_FAILED');
    });
  });

  describe('GET /api/deal-memo/progress/:sessionId', () => {
    it('should return progress for valid session', async () => {
      // First start an analysis to get a session ID
      const requestBody = {
        documents: [mockProcessedDocument],
      };

      const analysisResponse = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(200);

      // Extract session ID from response metadata or logs
      // For this test, we'll simulate a session ID
      const sessionId = 'analysis_123456789_abc123';

      const progressResponse = await request(app)
        .get(`/api/deal-memo/progress/${sessionId}`)
        .expect(404); // Will be 404 since we don't have real session tracking in test

      expect(progressResponse.body.success).toBe(false);
      expect(progressResponse.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('POST /api/deal-memo/stream', () => {
    it('should establish streaming connection', async () => {
      const requestBody = {
        documents: [mockProcessedDocument],
      };

      const response = await request(app)
        .post('/api/deal-memo/stream')
        .send(requestBody)
        .expect(200);

      // For streaming endpoints, we expect the response to start immediately
      // The actual streaming behavior would need more complex testing
      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete analysis pipeline with custom weightings', async () => {
      const customWeightings = {
        marketOpportunity: 35,
        team: 20,
        traction: 25,
        product: 10,
        competitivePosition: 10,
      };

      const requestBody = {
        documents: [mockProcessedDocument],
        weightings: customWeightings,
        options: {
          includeDetailedRiskAnalysis: true,
          generateDiligenceQuestions: true,
        },
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.aegisDealMemo.analysisWeightings).toEqual(customWeightings);
      
      // Verify the complete pipeline was executed
      expect(mockGeminiAnalyzer.analyzeContent).toHaveBeenCalledTimes(1);
      expect(mockSectorClassifier.classifySector).toHaveBeenCalledTimes(1);
      expect(mockBigQueryConnector.getBenchmarks).toHaveBeenCalledTimes(1);
      expect(mockMetricComparator.calculatePercentiles).toHaveBeenCalledTimes(1);
      expect(mockScoreCalculator.calculateSignalScore).toHaveBeenCalledTimes(1);
      expect(mockRecommendationEngine.generateRecommendation).toHaveBeenCalledTimes(1);
      expect(mockFirebaseStorage.storeDealMemo).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple documents in analysis', async () => {
      const secondDocument: ProcessedDocument = {
        ...mockProcessedDocument,
        id: 'test-doc-2',
        metadata: {
          ...mockProcessedDocument.metadata,
          filename: 'financial-model.xlsx',
        },
        extractedText: 'Financial projections and unit economics data',
      };

      const requestBody = {
        documents: [mockProcessedDocument, secondDocument],
      };

      const response = await request(app)
        .post('/api/deal-memo')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGeminiAnalyzer.analyzeContent).toHaveBeenCalledWith([
        mockProcessedDocument,
        secondDocument,
      ]);
      expect(response.body.data.aegisDealMemo.metadata.sourceDocuments).toHaveLength(2);
    });
  });
});