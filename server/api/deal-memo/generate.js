// Vercel serverless function for deal memo generation
import { GeminiAnalyzer } from '../../src/services/ai/GeminiAnalyzer.js';
import { BigQueryConnector } from '../../src/services/benchmarking/BigQueryConnector.js';
import { ScoreCalculator } from '../../src/services/dealMemo/ScoreCalculator.js';
import { RecommendationEngine } from '../../src/services/dealMemo/RecommendationEngine.js';
import { FirebaseStorage } from '../../src/services/storage/FirebaseStorage.js';
import { MockDataService } from '../../src/services/mock/MockDataService.js';
import { logger } from '../../src/utils/logger.js';
import { handleError } from '../../src/utils/errorHandler.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed',
      },
    });
  }

  try {
    const {
      documentIds,
      sessionId,
      analysisWeightings,
      includeRiskAssessment = true,
      includeBenchmarking = true,
      includeCompetitiveAnalysis = false,
      detailedFinancialAnalysis = false,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Session ID is required',
        },
      });
    }

    const startTime = Date.now();
    logger.info(`Starting deal memo generation for session ${sessionId}`, {
      documentCount: documentIds?.length || 0,
      includeRiskAssessment,
      includeBenchmarking,
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // Use mock data for development
      await MockDataService.simulateProcessingDelay('analyze');
      
      // Create mock analysis result
      const mockDocumentIds = documentIds || [`mock-doc-${Date.now()}`];
      const analysisResult = MockDataService.createMockAnalysisResult(mockDocumentIds);
      
      await MockDataService.simulateProcessingDelay('benchmark');
      
      // Generate mock deal memo
      const dealMemo = MockDataService.createMockDealMemo(analysisResult);
      
      await MockDataService.simulateProcessingDelay('generate');
      
      const processingTime = Date.now() - startTime;
      const dealMemoId = `deal-memo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      logger.info(`Mock deal memo generation completed for session ${sessionId}`, {
        dealMemoId,
        processingTime,
        signalScore: dealMemo.aegisDealMemo.summary.signalScore,
      });

      res.json({
        success: true,
        data: {
          dealMemo,
          dealMemoId,
          processingTime,
          warnings: analysisResult.consistencyFlags.length > 0 ? [
            `Found ${analysisResult.consistencyFlags.length} consistency issues in the analysis`,
          ] : undefined,
        },
      });
    } else {
      // Real implementation for production
      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DOCUMENTS',
            message: 'Document IDs are required and must be a non-empty array',
          },
        });
      }

      // Step 1: Retrieve processed documents
      // In a real implementation, this would fetch from storage
      const documents = []; // Placeholder

      // Step 2: Analyze content with AI
      const geminiAnalyzer = new GeminiAnalyzer();
      const analysisResult = await geminiAnalyzer.analyzeContent(documents, {
        includeRiskAssessment,
        includeCompetitiveAnalysis,
        detailedFinancialAnalysis,
      });

      // Step 3: Get benchmarking data if requested
      let benchmarkData = null;
      if (includeBenchmarking) {
        const bigQueryConnector = new BigQueryConnector();
        benchmarkData = await bigQueryConnector.getBenchmarks(
          analysisResult.companyProfile.sector,
          ['arr', 'growth_rate', 'team_size', 'customer_count']
        );
      }

      // Step 4: Calculate signal score
      const scoreCalculator = new ScoreCalculator();
      const signalScore = await scoreCalculator.calculateScore(
        analysisResult,
        benchmarkData,
        analysisWeightings
      );

      // Step 5: Generate recommendations
      const recommendationEngine = new RecommendationEngine();
      const dealMemo = await recommendationEngine.generateDealMemo(
        analysisResult,
        signalScore,
        benchmarkData
      );

      // Step 6: Save to storage
      const firebaseStorage = new FirebaseStorage();
      const savedDealMemo = await firebaseStorage.saveDealMemo(dealMemo);

      const processingTime = Date.now() - startTime;

      logger.info(`Deal memo generation completed for session ${sessionId}`, {
        dealMemoId: savedDealMemo.id,
        processingTime,
        signalScore: dealMemo.aegisDealMemo.summary.signalScore,
      });

      res.json({
        success: true,
        data: {
          dealMemo,
          dealMemoId: savedDealMemo.id,
          processingTime,
          warnings: analysisResult.consistencyFlags.length > 0 ? [
            `Found ${analysisResult.consistencyFlags.length} consistency issues in the analysis`,
          ] : undefined,
        },
      });
    }
  } catch (error) {
    console.error('Deal memo generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred during deal memo generation',
      },
    });
  }
}