// Gemini AI integration for document analysis
import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { initializeVertexAI } from '../../utils/googleCloud.js';
import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { PromptManager, AnalysisPrompt } from './PromptManager.js';
import { ProcessedDocument } from '../../models/ProcessedDocument.js';
import { AnalysisResult, AnalysisResultInput } from '../../models/AnalysisResult.js';
import { CompanyProfileInput } from '../../models/CompanyProfile.js';
import { InvestmentMetricsInput } from '../../models/InvestmentMetrics.js';
import { AnalysisContext } from '../../types/interfaces.js';
import { AnalysisType } from '../../types/enums.js';

export interface GeminiResponse {
  content: string;
  finishReason: string;
  safetyRatings?: any[];
  citationMetadata?: any;
}

export interface AnalysisOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  enableSafetyFilters?: boolean;
}

export class GeminiAnalyzer {
  private vertexAI: VertexAI;
  private model: GenerativeModel;
  private promptManager: PromptManager;
  private defaultOptions: AnalysisOptions;

  constructor(options: AnalysisOptions = {}) {
    this.vertexAI = initializeVertexAI();
    this.model = this.vertexAI.getGenerativeModel({
      model: appConfig.googleCloud.vertexAI.model,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
      },
      safetySettings: options.enableSafetyFilters !== false ? [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ] : [],
    });

    this.promptManager = new PromptManager();
    this.defaultOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableSafetyFilters: true,
      ...options,
    };

    logger.info('GeminiAnalyzer initialized successfully');
  }

  /**
   * Analyze content using a specific prompt
   */
  async analyzeWithPrompt(prompt: AnalysisPrompt, options?: AnalysisOptions): Promise<GeminiResponse> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxRetries!; attempt++) {
      try {
        logger.debug(`Gemini analysis attempt ${attempt}/${opts.maxRetries}`);

        // Create the full prompt
        const fullPrompt = `${prompt.systemPrompt}\n\n${prompt.userPrompt}`;

        // Generate content with timeout
        const result = await Promise.race([
          this.model.generateContent(fullPrompt),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), opts.timeout)
          )
        ]) as any;

        if (!result.response) {
          throw new Error('No response received from Gemini');
        }

        const response = result.response;
        const content = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
          throw new Error('No content in Gemini response');
        }

        logger.debug('Gemini analysis completed successfully');

        return {
          content: content.trim(),
          finishReason: response.candidates?.[0]?.finishReason || 'STOP',
          safetyRatings: response.candidates?.[0]?.safetyRatings,
          citationMetadata: response.candidates?.[0]?.citationMetadata,
        };

      } catch (error) {
        lastError = error as Error;
        logger.warn(`Gemini analysis attempt ${attempt} failed:`, error);

        if (attempt < opts.maxRetries!) {
          await this.delay(opts.retryDelay! * attempt);
        }
      }
    }

    logger.error('All Gemini analysis attempts failed:', lastError);
    throw new Error(`Gemini analysis failed after ${opts.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Analyze documents to extract structured data
   */
  async analyzeContent(documents: ProcessedDocument[], context?: AnalysisContext): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Combine document text
      const documentText = documents
        .map(doc => `=== ${doc.metadata.filename} ===\n${doc.extractedText}`)
        .join('\n\n');

      // Create analysis context
      const analysisContext: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
        ...context,
      };

      // Generate analysis prompts
      const prompts = this.promptManager.generateAnalysisWorkflow(analysisContext, documentText);

      if (prompts.length === 0) {
        throw new Error('No analysis prompts generated');
      }

      // Execute analysis prompts in parallel for better performance
      const analysisPromises = prompts.map(async (prompt, index) => {
        try {
          const response = await this.analyzeWithPrompt(prompt);
          return { index, response, success: true };
        } catch (error) {
          logger.error(`Analysis prompt ${index} failed:`, error);
          return { index, error, success: false };
        }
      });

      const results = await Promise.all(analysisPromises);

      // Process results
      let companyProfile: CompanyProfileInput | null = null;
      let investmentMetrics: InvestmentMetricsInput | null = null;
      let marketClaims: any = {};
      let teamAssessment: any = {};
      const consistencyFlags: any[] = [];

      for (const result of results) {
        if (!result.success) {
          logger.warn(`Skipping failed analysis result at index ${result.index}`);
          continue;
        }

        try {
          const parsedContent = JSON.parse(result.response!.content);

          // Map results based on prompt index (matches workflow order)
          switch (result.index) {
            case 0: // company_profile
              companyProfile = this.mapCompanyProfile(parsedContent);
              break;
            case 1: // investment_metrics
              investmentMetrics = this.mapInvestmentMetrics(parsedContent, documents.map(d => d.id));
              break;
            case 2: // market_claims
              marketClaims = parsedContent;
              break;
            case 3: // team_assessment
              teamAssessment = this.mapTeamAssessment(parsedContent);
              break;
          }
        } catch (parseError) {
          logger.error(`Failed to parse analysis result ${result.index}:`, parseError);
          logger.debug('Raw content:', result.response!.content);
        }
      }

      // Validate required data
      if (!companyProfile) {
        throw new Error('Failed to extract company profile');
      }
      if (!investmentMetrics) {
        throw new Error('Failed to extract investment metrics');
      }

      const processingTime = Date.now() - startTime;

      // Create analysis result
      const analysisResult: AnalysisResultInput = {
        companyProfile: {
          ...companyProfile,
          id: `company_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        extractedMetrics: {
          ...investmentMetrics,
          id: `metrics_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          extractionTimestamp: new Date(),
          confidence: 0.8, // Default confidence, can be improved with more sophisticated scoring
        },
        marketClaims,
        teamAssessment,
        consistencyFlags,
        analysisType: analysisContext.analysisType,
        confidence: 0.8,
        processingTime,
        sourceDocumentIds: documents.map(d => d.id),
      };

      logger.info(`Analysis completed in ${processingTime}ms`);
      
      return {
        ...analysisResult,
        id: `analysis_${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

    } catch (error) {
      logger.error('Content analysis failed:', error);
      throw error;
    }
  }

  /**
   * Extract entities from text using custom prompts
   */
  async extractEntities(text: string, context: AnalysisContext): Promise<Record<string, any>> {
    try {
      const prompt = this.promptManager.generatePrompt('investment_metrics', context, { documentText: text });
      
      if (!prompt) {
        throw new Error('Failed to generate entity extraction prompt');
      }

      const response = await this.analyzeWithPrompt(prompt);
      return JSON.parse(response.content);

    } catch (error) {
      logger.error('Entity extraction failed:', error);
      throw error;
    }
  }

  /**
   * Validate consistency across multiple documents
   */
  async validateConsistency(entities: Record<string, any>[]): Promise<any[]> {
    // This is a placeholder for consistency validation logic
    // Will be implemented in task 4.3
    logger.info('Consistency validation called - implementation pending in task 4.3');
    return [];
  }

  /**
   * Map raw company profile data to typed interface
   */
  private mapCompanyProfile(data: any): CompanyProfileInput {
    return {
      name: data.name || '',
      oneLiner: data.oneLiner || '',
      sector: data.sector || '',
      stage: data.stage || 'pre_seed',
      foundedYear: data.foundedYear || new Date().getFullYear(),
      location: data.location || '',
      website: data.website,
      description: data.description,
      logoUrl: data.logoUrl,
      socialLinks: data.socialLinks,
    };
  }

  /**
   * Map raw investment metrics data to typed interface
   */
  private mapInvestmentMetrics(data: any, sourceDocuments: string[]): InvestmentMetricsInput {
    return {
      revenue: data.revenue || {},
      traction: data.traction || {},
      team: {
        size: data.team?.size || 0,
        foundersCount: data.team?.foundersCount || 0,
        keyHires: data.team?.keyHires || [],
        burnRate: data.team?.burnRate,
        runway: data.team?.runway,
      },
      funding: data.funding || {},
      sourceDocuments,
    };
  }

  /**
   * Map raw team assessment data to typed interface
   */
  private mapTeamAssessment(data: any): any {
    return {
      founders: data.founders || [],
      keyEmployees: data.keyEmployees || [],
      advisors: data.advisors || [],
      totalSize: data.totalSize || 0,
      averageExperience: data.averageExperience || 0,
      domainExpertise: data.domainExpertise || [],
      previousExits: data.previousExits,
      educationBackground: data.educationBackground,
      networkStrength: data.networkStrength,
    };
  }

  /**
   * Utility method for delays in retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get model information and health status
   */
  async getModelInfo(): Promise<{ model: string; status: string; lastCheck: Date }> {
    try {
      // Simple health check by making a minimal request
      const testPrompt: AnalysisPrompt = {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Respond with "OK" if you are working correctly.',
        temperature: 0,
        maxTokens: 10,
      };

      const response = await this.analyzeWithPrompt(testPrompt, { maxRetries: 1, timeout: 5000 });
      
      return {
        model: appConfig.googleCloud.vertexAI.model,
        status: response.content.includes('OK') ? 'healthy' : 'degraded',
        lastCheck: new Date(),
      };
    } catch (error) {
      logger.error('Model health check failed:', error);
      return {
        model: appConfig.googleCloud.vertexAI.model,
        status: 'unhealthy',
        lastCheck: new Date(),
      };
    }
  }
}