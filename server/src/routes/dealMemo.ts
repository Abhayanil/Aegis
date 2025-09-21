import express from 'express';
import { GeminiAnalyzer } from '../services/ai/GeminiAnalyzer.js';
import { BigQueryConnector } from '../services/benchmarking/BigQueryConnector.js';
import { MetricComparator } from '../services/benchmarking/MetricComparator.js';
import { SectorClassifier } from '../services/benchmarking/SectorClassifier.js';
import { InconsistencyDetector } from '../services/risk/InconsistencyDetector.js';
import { MarketSizeValidator } from '../services/risk/MarketSizeValidator.js';
import { MetricAnomalyDetector } from '../services/risk/MetricAnomalyDetector.js';
import { ScoreCalculator } from '../services/dealMemo/ScoreCalculator.js';
import { RecommendationEngine } from '../services/dealMemo/RecommendationEngine.js';
import { WeightingManager } from '../services/dealMemo/WeightingManager.js';
import { FirebaseStorage } from '../services/storage/FirebaseStorage.js';
import { logger } from '../utils/logger.js';
import { AppError, createErrorResponse } from '../utils/errors.js';
import { ApiResponse } from '../types/interfaces.js';
import { DealMemo, AnalysisWeightings } from '../models/DealMemo.js';
import { ProcessedDocument } from '../models/ProcessedDocument.js';
import { AnalysisType } from '../types/enums.js';

const router = express.Router();

// Analysis pipeline progress tracking
interface AnalysisProgress {
  sessionId: string;
  status: 'processing' | 'completed' | 'failed';
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  startTime: Date;
  endTime?: Date;
  result?: DealMemo;
  error?: string;
}

// In-memory progress tracking (in production, use Redis or database)
const analysisTracker = new Map<string, AnalysisProgress>();

/**
 * Generate unique session ID for tracking analysis progress
 */
function generateAnalysisSessionId(): string {
  return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default analysis weightings
 */
const DEFAULT_WEIGHTINGS: AnalysisWeightings = {
  marketOpportunity: 25,
  team: 25,
  traction: 20,
  product: 15,
  competitivePosition: 15,
};

/**
 * POST /api/deal-memo
 * Generate deal memo from processed documents
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const sessionId = generateAnalysisSessionId();

  try {
    const {
      documents,
      weightings = DEFAULT_WEIGHTINGS,
      options = {},
    } = req.body;

    // Validate input
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new AppError(
        'No documents provided for analysis',
        400,
        'NO_DOCUMENTS_PROVIDED'
      );
    }

    // Validate weightings
    const weightingManager = new WeightingManager();
    const validatedWeightings = weightingManager.validateWeightings(weightings);

    logger.info(`Starting deal memo generation for session ${sessionId}`, {
      sessionId,
      documentCount: documents.length,
      weightings: validatedWeightings,
      options,
    });

    // Initialize progress tracking
    const analysisSteps = [
      'AI Analysis',
      'Sector Classification',
      'Benchmarking',
      'Risk Assessment',
      'Score Calculation',
      'Recommendation Generation',
      'Storage',
    ];

    const progress: AnalysisProgress = {
      sessionId,
      status: 'processing',
      currentStep: analysisSteps[0],
      completedSteps: [],
      totalSteps: analysisSteps.length,
      startTime: new Date(),
    };
    analysisTracker.set(sessionId, progress);

    // Initialize services
    const geminiAnalyzer = new GeminiAnalyzer();
    const sectorClassifier = new SectorClassifier();
    const bigQueryConnector = new BigQueryConnector();
    const metricComparator = new MetricComparator();
    const inconsistencyDetector = new InconsistencyDetector();
    const marketSizeValidator = new MarketSizeValidator();
    const metricAnomalyDetector = new MetricAnomalyDetector();
    const scoreCalculator = new ScoreCalculator();
    const recommendationEngine = new RecommendationEngine();
    const firebaseStorage = new FirebaseStorage();

    // Step 1: AI Analysis and Entity Extraction
    progress.currentStep = 'AI Analysis';
    analysisTracker.set(sessionId, progress);

    logger.info('Starting AI analysis', { sessionId });
    const analysisResult = await geminiAnalyzer.analyzeContent(documents);
    
    progress.completedSteps.push('AI Analysis');
    progress.currentStep = 'Sector Classification';
    analysisTracker.set(sessionId, progress);

    // Step 2: Sector Classification
    logger.info('Starting sector classification', { sessionId });
    const sectorClassification = await sectorClassifier.classifySector(analysisResult.companyProfile);
    
    progress.completedSteps.push('Sector Classification');
    progress.currentStep = 'Benchmarking';
    analysisTracker.set(sessionId, progress);

    // Step 3: Benchmarking
    logger.info('Starting benchmarking analysis', { sessionId });
    const benchmarkData = await bigQueryConnector.getBenchmarks(
      sectorClassification.primarySector,
      Object.keys(analysisResult.extractedMetrics.revenue || {})
        .concat(Object.keys(analysisResult.extractedMetrics.traction || {}))
    );

    const percentileRankings = await metricComparator.calculatePercentiles(
      analysisResult.extractedMetrics,
      benchmarkData
    );

    progress.completedSteps.push('Benchmarking');
    progress.currentStep = 'Risk Assessment';
    analysisTracker.set(sessionId, progress);

    // Step 4: Risk Assessment
    logger.info('Starting risk assessment', { sessionId });
    const inconsistencies = await inconsistencyDetector.detectInconsistencies([analysisResult]);
    const marketValidation = await marketSizeValidator.validateMarketClaims(analysisResult.marketClaims);
    const metricAnomalies = await metricAnomalyDetector.assessMetricHealth(analysisResult.extractedMetrics);

    const allRisks = [
      ...inconsistencies,
      ...(marketValidation.isValid ? [] : marketValidation.errors.map(error => ({
        type: 'market-size' as any,
        severity: 'MEDIUM' as any,
        description: error,
        affectedMetrics: ['market_size'],
        suggestedMitigation: 'Validate market size claims with additional research',
        sourceDocuments: documents.map(d => d.id),
      }))),
      ...metricAnomalies.risks,
    ];

    progress.completedSteps.push('Risk Assessment');
    progress.currentStep = 'Score Calculation';
    analysisTracker.set(sessionId, progress);

    // Step 5: Score Calculation
    logger.info('Starting score calculation', { sessionId });
    const signalScore = await scoreCalculator.calculateSignalScore(
      analysisResult.extractedMetrics,
      validatedWeightings
    );

    progress.completedSteps.push('Score Calculation');
    progress.currentStep = 'Recommendation Generation';
    analysisTracker.set(sessionId, progress);

    // Step 6: Recommendation Generation
    logger.info('Starting recommendation generation', { sessionId });
    const recommendation = await recommendationEngine.generateRecommendation(
      analysisResult,
      benchmarkData,
      allRisks,
      signalScore,
      validatedWeightings
    );

    progress.completedSteps.push('Recommendation Generation');
    progress.currentStep = 'Storage';
    analysisTracker.set(sessionId, progress);

    // Step 7: Create and Store Deal Memo
    logger.info('Creating and storing deal memo', { sessionId });
    const dealMemo: DealMemo = {
      id: `deal_memo_${sessionId}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      aegisDealMemo: {
        summary: {
          companyName: analysisResult.companyProfile.name,
          oneLiner: analysisResult.companyProfile.oneLiner,
          sector: sectorClassification.primarySector,
          stage: analysisResult.companyProfile.stage,
          signalScore,
          recommendation: recommendation.recommendation,
          confidenceLevel: recommendation.confidenceLevel,
          lastUpdated: new Date(),
        },
        keyBenchmarks: percentileRankings,
        growthPotential: recommendation.growthPotential,
        riskAssessment: {
          overallRiskScore: recommendation.riskScore,
          highPriorityRisks: allRisks.filter(r => r.severity === 'HIGH'),
          mediumPriorityRisks: allRisks.filter(r => r.severity === 'MEDIUM'),
          lowPriorityRisks: allRisks.filter(r => r.severity === 'LOW'),
          riskMitigationPlan: recommendation.riskMitigationPlan,
        },
        investmentRecommendation: recommendation.investmentRecommendation,
        analysisWeightings: validatedWeightings,
        metadata: {
          generatedBy: 'Aegis AI v1.0.0',
          analysisVersion: '1.0.0',
          sourceDocuments: documents.map(d => d.id),
          processingTime: Date.now() - startTime,
          dataQuality: recommendation.dataQuality,
        },
      },
    };

    // Store in Firebase
    const storedMemo = await firebaseStorage.storeDealMemo(dealMemo);

    progress.completedSteps.push('Storage');
    progress.status = 'completed';
    progress.endTime = new Date();
    progress.result = storedMemo;
    analysisTracker.set(sessionId, progress);

    const processingTime = Date.now() - startTime;

    logger.info(`Deal memo generation completed for session ${sessionId}`, {
      sessionId,
      companyName: dealMemo.aegisDealMemo.summary.companyName,
      signalScore,
      recommendation: recommendation.recommendation,
      processingTime,
    });

    // Prepare response
    const response: ApiResponse<DealMemo> = {
      success: true,
      data: storedMemo,
      metadata: {
        processingTime,
        timestamp: new Date(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Update progress on error
    const progress = analysisTracker.get(sessionId);
    if (progress) {
      progress.status = 'failed';
      progress.endTime = new Date();
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      analysisTracker.set(sessionId, progress);
    }

    logger.error('Deal memo generation failed', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Deal memo generation failed',
      500,
      'ANALYSIS_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/deal-memo/progress/:sessionId
 * Get analysis progress for a session
 */
router.get('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const progress = analysisTracker.get(sessionId);
  if (!progress) {
    const error = new AppError(
      'Analysis session not found',
      404,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
    return res.status(404).json(createErrorResponse(error));
  }

  const response: ApiResponse<AnalysisProgress> = {
    success: true,
    data: progress,
    metadata: {
      processingTime: 0,
      timestamp: new Date(),
      version: '1.0.0',
    },
  };

  res.json(response);
});

/**
 * POST /api/deal-memo/stream
 * Generate deal memo with streaming responses for long-running analysis
 */
router.post('/stream', (req, res) => {
  const sessionId = generateAnalysisSessionId();
  
  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Start analysis in background
  (async () => {
    try {
      const {
        documents,
        weightings = DEFAULT_WEIGHTINGS,
        options = {},
      } = req.body;

      // Initialize progress tracking with streaming updates
      const analysisSteps = [
        'AI Analysis',
        'Sector Classification', 
        'Benchmarking',
        'Risk Assessment',
        'Score Calculation',
        'Recommendation Generation',
        'Storage',
      ];

      let currentStepIndex = 0;

      const sendProgress = (step: string, completed: string[] = []) => {
        const progressData = {
          type: 'progress',
          sessionId,
          currentStep: step,
          completedSteps: completed,
          totalSteps: analysisSteps.length,
          progress: (completed.length / analysisSteps.length) * 100,
        };
        res.write(`data: ${JSON.stringify(progressData)}\n\n`);
      };

      const sendError = (error: string) => {
        const errorData = {
          type: 'error',
          sessionId,
          error,
        };
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
        res.end();
      };

      const sendComplete = (result: DealMemo) => {
        const completeData = {
          type: 'complete',
          sessionId,
          result,
        };
        res.write(`data: ${JSON.stringify(completeData)}\n\n`);
        res.end();
      };

      // Simulate the same analysis pipeline with progress updates
      // (Implementation would be similar to the main endpoint but with streaming updates)
      
      sendProgress(analysisSteps[0]);
      // ... analysis steps with sendProgress calls ...
      
      // For now, send a mock completion after a delay
      setTimeout(() => {
        sendComplete({
          id: `deal_memo_${sessionId}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          aegisDealMemo: {
            summary: {
              companyName: 'Mock Company',
              oneLiner: 'Mock analysis result',
              sector: 'Technology',
              stage: 'seed' as any,
              signalScore: 75,
              recommendation: 'buy' as any,
              confidenceLevel: 0.8,
              lastUpdated: new Date(),
            },
            keyBenchmarks: [],
            growthPotential: {
              upsideSummary: 'Strong growth potential',
              growthTimeline: '3-5 years to scale',
              keyDrivers: [],
              scalabilityFactors: [],
              marketExpansionOpportunity: '',
              revenueProjection: { year1: 1000000, year3: 5000000, year5: 20000000 },
            },
            riskAssessment: {
              overallRiskScore: 30,
              highPriorityRisks: [],
              mediumPriorityRisks: [],
              lowPriorityRisks: [],
              riskMitigationPlan: [],
            },
            investmentRecommendation: {
              narrative: 'Mock recommendation',
              investmentThesis: 'Strong team and market opportunity',
              idealCheckSize: '$500K - $1M',
              idealValuationCap: '$8M',
              suggestedTerms: [],
              keyDiligenceQuestions: [],
              followUpActions: [],
              timelineToDecision: '2-3 weeks',
            },
            analysisWeightings: DEFAULT_WEIGHTINGS,
            metadata: {
              generatedBy: 'Aegis AI v1.0.0',
              analysisVersion: '1.0.0',
              sourceDocuments: [],
              processingTime: 5000,
              dataQuality: 0.85,
            },
          },
        } as DealMemo);
      }, 2000);

    } catch (error) {
      sendError(error instanceof Error ? error.message : 'Unknown error');
    }
  })();

  // Handle client disconnect
  req.on('close', () => {
    logger.info(`Client disconnected from streaming analysis ${sessionId}`);
  });
});

export default router;