// Entity extraction and metric identification service
import { GeminiAnalyzer } from './GeminiAnalyzer.js';
import { PromptManager } from './PromptManager.js';
import { ProcessedDocument } from '../../models/ProcessedDocument.js';
import { InvestmentMetrics, RevenueMetrics, TractionMetrics, TeamMetrics, FundingMetrics } from '../../models/InvestmentMetrics.js';
import { CompanyProfile } from '../../models/CompanyProfile.js';
import { MarketClaims, TeamProfile } from '../../models/AnalysisResult.js';
import { AnalysisContext, TeamMember } from '../../types/interfaces.js';
import { AnalysisType, FundingStage } from '../../types/enums.js';
import { logger } from '../../utils/logger.js';

export interface ExtractedEntity {
  type: 'financial' | 'team' | 'market' | 'product' | 'company';
  name: string;
  value: any;
  confidence: number;
  sourceContext: string;
  sourceDocument: string;
  extractionMethod: 'pattern' | 'ai' | 'hybrid';
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  metrics: InvestmentMetrics;
  companyProfile: CompanyProfile;
  marketClaims: MarketClaims;
  teamProfile: TeamProfile;
  confidence: number;
  processingTime: number;
}

export interface ExtractionOptions {
  enablePatternMatching?: boolean;
  enableAIExtraction?: boolean;
  confidenceThreshold?: number;
  validateNumericValues?: boolean;
  extractDates?: boolean;
}

export class EntityExtractor {
  private geminiAnalyzer: GeminiAnalyzer;
  private promptManager: PromptManager;
  private defaultOptions: ExtractionOptions;

  // Regex patterns for common financial metrics
  private readonly patterns = {
    // Revenue patterns - flexible order
    arr: /(?:\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)\s+(?:ARR|Annual Recurring Revenue)|(?:ARR|Annual Recurring Revenue)[\s:]*\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?))/gi,
    mrr: /(?:MRR|Monthly Recurring Revenue)[\s:]*\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    revenue: /(?:revenue|sales)[\s:]*\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    growthRate: /(?:growth|growth rate)[\s:]*([0-9]+(?:\.[0-9]+)?)%/gi,
    
    // Customer metrics
    customers: /([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)\s+(?:customers?|users?)|(?:customers?|users?)[\s:]*([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    churn: /(?:churn|churn rate)[\s:]*(?:of\s+)?([0-9]+(?:\.[0-9]+)?)%/gi,
    nps: /(?:NPS|Net Promoter Score)[\s:]*(?:score\s+)?(?:of\s+)?([0-9]+)/gi,
    
    // Team metrics
    teamSize: /(?:team)[\s:]*(?:of\s+)?([0-9]+)|([0-9]+)\s+(?:employees?|people)/gi,
    founders: /([0-9]+)\s+(?:founders?|co-founders?)|(?:founders?|co-founders?)[\s:]*([0-9]+)/gi,
    
    // Funding metrics
    raised: /(?:raised|funding)[\s:]*\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    valuation: /(?:valuation|valued at)[\s:]*\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    
    // Market metrics
    tam: /(?:TAM|Total Addressable Market)[\s:]*(?:is\s+)?\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    sam: /(?:SAM|Serviceable Addressable Market)[\s:]*(?:is\s+|being\s+approximately\s+)?\$?([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/gi,
    
    // Dates
    dates: /(?:founded|established|started)[\s:]*(?:in\s+)?([0-9]{4})/gi,
    
    // Percentages
    percentages: /([0-9]+(?:\.[0-9]+)?)%/g,
    
    // Currency amounts
    currency: /\$([0-9,]+(?:\.[0-9]+)?)\s*([KMB]?)/g,
  };

  constructor(options: ExtractionOptions = {}) {
    this.geminiAnalyzer = new GeminiAnalyzer();
    this.promptManager = new PromptManager();
    this.defaultOptions = {
      enablePatternMatching: true,
      enableAIExtraction: true,
      confidenceThreshold: 0.6,
      validateNumericValues: true,
      extractDates: true,
      ...options,
    };

    logger.info('EntityExtractor initialized successfully');
  }

  /**
   * Extract entities from processed documents
   */
  async extractFromDocuments(documents: ProcessedDocument[], context?: AnalysisContext): Promise<EntityExtractionResult> {
    const startTime = Date.now();
    
    try {
      const extractedEntities: ExtractedEntity[] = [];
      
      // Combine document text for analysis
      const combinedText = documents
        .map(doc => `=== ${doc.metadata.filename} ===\n${doc.extractedText}`)
        .join('\n\n');

      // Pattern-based extraction
      if (this.defaultOptions.enablePatternMatching) {
        const patternEntities = this.extractWithPatterns(combinedText, documents);
        extractedEntities.push(...patternEntities);
      }

      // AI-based extraction
      let aiEntities: ExtractedEntity[] = [];
      if (this.defaultOptions.enableAIExtraction) {
        aiEntities = await this.extractWithAI(combinedText, documents, context);
        extractedEntities.push(...aiEntities);
      }

      // Merge and validate entities
      const mergedEntities = this.mergeEntities(extractedEntities);
      const validatedEntities = this.validateEntities(mergedEntities);

      // Convert entities to structured metrics
      const metrics = this.entitiesToMetrics(validatedEntities, documents.map(d => d.id));
      const companyProfile = this.entitiesToCompanyProfile(validatedEntities);
      const marketClaims = this.entitiesToMarketClaims(validatedEntities);
      const teamProfile = this.entitiesToTeamProfile(validatedEntities);

      const processingTime = Date.now() - startTime;
      const confidence = this.calculateOverallConfidence(validatedEntities);

      logger.info(`Entity extraction completed in ${processingTime}ms with confidence ${confidence}`);

      return {
        entities: validatedEntities,
        metrics,
        companyProfile,
        marketClaims,
        teamProfile,
        confidence,
        processingTime,
      };

    } catch (error) {
      logger.error('Entity extraction failed:', error);
      throw error;
    }
  }

  /**
   * Extract entities using regex patterns
   */
  private extractWithPatterns(text: string, documents: ProcessedDocument[]): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const sourceDoc = documents[0]?.id || 'unknown';

    // Extract financial metrics
    this.extractPatternMatches(text, this.patterns.arr, 'financial', 'arr', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.mrr, 'financial', 'mrr', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.revenue, 'financial', 'revenue', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.growthRate, 'financial', 'growthRate', entities, sourceDoc);

    // Extract customer metrics
    this.extractPatternMatches(text, this.patterns.customers, 'financial', 'customers', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.churn, 'financial', 'churnRate', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.nps, 'financial', 'nps', entities, sourceDoc);

    // Extract team metrics
    this.extractPatternMatches(text, this.patterns.teamSize, 'team', 'teamSize', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.founders, 'team', 'foundersCount', entities, sourceDoc);

    // Extract funding metrics
    this.extractPatternMatches(text, this.patterns.raised, 'financial', 'totalRaised', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.valuation, 'financial', 'valuation', entities, sourceDoc);

    // Extract market metrics
    this.extractPatternMatches(text, this.patterns.tam, 'market', 'tam', entities, sourceDoc);
    this.extractPatternMatches(text, this.patterns.sam, 'market', 'sam', entities, sourceDoc);

    // Extract dates
    if (this.defaultOptions.extractDates) {
      this.extractPatternMatches(text, this.patterns.dates, 'company', 'foundedYear', entities, sourceDoc);
    }

    return entities;
  }

  /**
   * Extract pattern matches and convert to entities
   */
  private extractPatternMatches(
    text: string,
    pattern: RegExp,
    type: ExtractedEntity['type'],
    name: string,
    entities: ExtractedEntity[],
    sourceDoc: string
  ): void {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Handle multiple capture groups (for flexible patterns)
      let rawValue: string = '';
      let multiplier: string = '';
      
      // Find the first non-empty capture group pair
      for (let i = 1; i < match.length; i += 2) {
        if (match[i]) {
          rawValue = match[i];
          multiplier = match[i + 1] || '';
          break;
        }
      }
      
      // If no pair found, try simple pattern (just value and multiplier)
      if (!rawValue && match[1]) {
        rawValue = match[1];
        multiplier = match[2] || '';
      }
      
      if (!rawValue) continue;
      
      let value: number | string = rawValue;
      
      // Convert numeric values with multipliers
      if (!isNaN(Number(rawValue.replace(/,/g, '')))) {
        value = this.parseNumericValue(rawValue, multiplier);
      }

      // Get context around the match
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
      const sourceContext = text.substring(contextStart, contextEnd).trim();

      entities.push({
        type,
        name,
        value,
        confidence: 0.8, // Pattern matching has high confidence
        sourceContext,
        sourceDocument: sourceDoc,
        extractionMethod: 'pattern',
      });
    }
  }

  /**
   * Extract entities using AI analysis
   */
  private async extractWithAI(text: string, documents: ProcessedDocument[], context?: AnalysisContext): Promise<ExtractedEntity[]> {
    try {
      const analysisContext: AnalysisContext = {
        analysisType: AnalysisType.METRICS_ONLY,
        ...context,
      };

      // Use the existing AI analysis to extract structured data
      const aiResult = await this.geminiAnalyzer.extractEntities(text, analysisContext);
      
      return this.convertAIResultToEntities(aiResult, documents[0]?.id || 'unknown');

    } catch (error) {
      logger.warn('AI entity extraction failed, continuing with pattern-based results:', error);
      return [];
    }
  }

  /**
   * Convert AI analysis result to entity format
   */
  private convertAIResultToEntities(aiResult: any, sourceDoc: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Convert revenue metrics
    if (aiResult.revenue) {
      Object.entries(aiResult.revenue).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          entities.push({
            type: 'financial',
            name: key,
            value,
            confidence: 0.7,
            sourceContext: `AI extracted: ${key} = ${value}`,
            sourceDocument: sourceDoc,
            extractionMethod: 'ai',
          });
        }
      });
    }

    // Convert traction metrics
    if (aiResult.traction) {
      Object.entries(aiResult.traction).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          entities.push({
            type: 'financial',
            name: key,
            value,
            confidence: 0.7,
            sourceContext: `AI extracted: ${key} = ${value}`,
            sourceDocument: sourceDoc,
            extractionMethod: 'ai',
          });
        }
      });
    }

    // Convert team metrics
    if (aiResult.team) {
      Object.entries(aiResult.team).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          entities.push({
            type: 'team',
            name: key,
            value,
            confidence: 0.7,
            sourceContext: `AI extracted: ${key} = ${value}`,
            sourceDocument: sourceDoc,
            extractionMethod: 'ai',
          });
        }
      });
    }

    // Convert funding metrics
    if (aiResult.funding) {
      Object.entries(aiResult.funding).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          entities.push({
            type: 'financial',
            name: key,
            value,
            confidence: 0.7,
            sourceContext: `AI extracted: ${key} = ${value}`,
            sourceDocument: sourceDoc,
            extractionMethod: 'ai',
          });
        }
      });
    }

    return entities;
  }

  /**
   * Merge duplicate entities and resolve conflicts
   */
  private mergeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity[]>();

    // Group entities by name
    entities.forEach(entity => {
      const key = `${entity.type}_${entity.name}`;
      if (!entityMap.has(key)) {
        entityMap.set(key, []);
      }
      entityMap.get(key)!.push(entity);
    });

    const mergedEntities: ExtractedEntity[] = [];

    // Merge entities with the same name
    entityMap.forEach((entityGroup, key) => {
      if (entityGroup.length === 1) {
        mergedEntities.push(entityGroup[0]);
      } else {
        // Resolve conflicts by choosing the entity with highest confidence
        // or preferring AI extraction over pattern matching
        const bestEntity = entityGroup.reduce((best, current) => {
          if (current.confidence > best.confidence) return current;
          if (current.confidence === best.confidence && current.extractionMethod === 'ai') return current;
          return best;
        });

        // Combine source contexts
        bestEntity.sourceContext = entityGroup
          .map(e => e.sourceContext)
          .filter((context, index, arr) => arr.indexOf(context) === index)
          .join(' | ');

        mergedEntities.push(bestEntity);
      }
    });

    return mergedEntities;
  }

  /**
   * Validate extracted entities
   */
  private validateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    return entities.filter(entity => {
      // Filter by confidence threshold
      if (entity.confidence < this.defaultOptions.confidenceThreshold!) {
        return false;
      }

      // Validate numeric values
      if (this.defaultOptions.validateNumericValues && typeof entity.value === 'number') {
        if (isNaN(entity.value) || entity.value < 0) {
          return false;
        }

        // Sanity checks for specific metrics
        if (entity.name === 'churnRate' && entity.value > 100) return false;
        if (entity.name === 'nps' && (entity.value < -100 || entity.value > 100)) return false;
        if (entity.name === 'growthRate' && entity.value > 10000) return false; // 10000% seems unrealistic
      }

      return true;
    });
  }

  /**
   * Convert entities to investment metrics structure
   */
  private entitiesToMetrics(entities: ExtractedEntity[], sourceDocuments: string[]): InvestmentMetrics {
    const revenue: RevenueMetrics = {};
    const traction: TractionMetrics = {};
    const team: TeamMetrics = { size: 0, foundersCount: 0, keyHires: [] };
    const funding: FundingMetrics = {};

    entities.forEach(entity => {
      switch (entity.name) {
        // Revenue metrics
        case 'arr':
          revenue.arr = Number(entity.value);
          break;
        case 'mrr':
          revenue.mrr = Number(entity.value);
          break;
        case 'revenue':
          revenue.revenueRunRate = Number(entity.value);
          break;
        case 'growthRate':
          revenue.growthRate = Number(entity.value);
          break;

        // Traction metrics
        case 'customers':
          traction.customers = Number(entity.value);
          break;
        case 'churnRate':
          traction.churnRate = Number(entity.value);
          break;
        case 'nps':
          traction.nps = Number(entity.value);
          break;

        // Team metrics
        case 'teamSize':
        case 'size':
          team.size = Number(entity.value);
          break;
        case 'foundersCount':
          team.foundersCount = Number(entity.value);
          break;

        // Funding metrics
        case 'totalRaised':
        case 'raised':
          funding.totalRaised = Number(entity.value);
          break;
        case 'valuation':
          funding.valuation = Number(entity.value);
          break;
      }
    });

    return {
      id: `metrics_${Date.now()}`,
      revenue,
      traction,
      team,
      funding,
      extractionTimestamp: new Date(),
      sourceDocuments,
      confidence: this.calculateOverallConfidence(entities),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Convert entities to company profile structure
   */
  private entitiesToCompanyProfile(entities: ExtractedEntity[]): CompanyProfile {
    const profile: any = {
      id: `company_${Date.now()}`,
      name: '',
      oneLiner: '',
      sector: '',
      stage: FundingStage.PRE_SEED,
      foundedYear: new Date().getFullYear(),
      location: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    entities.forEach(entity => {
      switch (entity.name) {
        case 'foundedYear':
          profile.foundedYear = Number(entity.value);
          break;
      }
    });

    return profile;
  }

  /**
   * Convert entities to market claims structure
   */
  private entitiesToMarketClaims(entities: ExtractedEntity[]): MarketClaims {
    const marketClaims: MarketClaims = {};

    entities.forEach(entity => {
      switch (entity.name) {
        case 'tam':
          marketClaims.tam = Number(entity.value);
          break;
        case 'sam':
          marketClaims.sam = Number(entity.value);
          break;
      }
    });

    return marketClaims;
  }

  /**
   * Convert entities to team profile structure
   */
  private entitiesToTeamProfile(entities: ExtractedEntity[]): TeamProfile {
    const teamProfile: TeamProfile = {
      founders: [],
      keyEmployees: [],
      advisors: [],
      totalSize: 0,
      averageExperience: 0,
      domainExpertise: [],
    };

    entities.forEach(entity => {
      if (entity.type === 'team') {
        switch (entity.name) {
          case 'teamSize':
          case 'size':
            teamProfile.totalSize = Number(entity.value);
            break;
        }
      }
    });

    return teamProfile;
  }

  /**
   * Parse numeric value with multiplier (K, M, B)
   */
  private parseNumericValue(value: string, multiplier?: string): number {
    const numericValue = parseFloat(value.replace(/,/g, ''));
    
    if (!multiplier) return numericValue;

    switch (multiplier.toUpperCase()) {
      case 'K':
        return numericValue * 1000;
      case 'M':
        return numericValue * 1000000;
      case 'B':
        return numericValue * 1000000000;
      default:
        return numericValue;
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(entities: ExtractedEntity[]): number {
    if (entities.length === 0) return 0;

    const totalConfidence = entities.reduce((sum, entity) => sum + entity.confidence, 0);
    return totalConfidence / entities.length;
  }

  /**
   * Get extraction statistics
   */
  getExtractionStats(result: EntityExtractionResult): {
    totalEntities: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
    averageConfidence: number;
  } {
    const byType: Record<string, number> = {};
    const byMethod: Record<string, number> = {};

    result.entities.forEach(entity => {
      byType[entity.type] = (byType[entity.type] || 0) + 1;
      byMethod[entity.extractionMethod] = (byMethod[entity.extractionMethod] || 0) + 1;
    });

    return {
      totalEntities: result.entities.length,
      byType,
      byMethod,
      averageConfidence: result.confidence,
    };
  }
}