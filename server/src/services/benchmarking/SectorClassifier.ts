// Sector classification service for company profiling
import { CompanyProfile } from '../../models/CompanyProfile.js';
import { SectorClassification } from '../../models/BenchmarkData.js';
import { BigQueryConnector } from './BigQueryConnector.js';
import { logger } from '../../utils/logger.js';

export interface SectorKeywordMap {
  [sector: string]: {
    keywords: string[];
    weight: number;
    subSectors?: string[];
  };
}

export interface ClassificationRule {
  condition: (profile: CompanyProfile) => boolean;
  sector: string;
  confidence: number;
  reasoning: string;
}

export class SectorClassifier {
  private bigQueryConnector: BigQueryConnector;
  private sectorKeywords: SectorKeywordMap;
  private classificationRules: ClassificationRule[];

  constructor(bigQueryConnector: BigQueryConnector) {
    this.bigQueryConnector = bigQueryConnector;
    this.initializeSectorKeywords();
    this.initializeClassificationRules();
  }

  /**
   * Classify company into primary and secondary sectors
   */
  async classifyCompany(companyProfile: CompanyProfile): Promise<SectorClassification> {
    try {
      // First try BigQuery-based classification
      const bigQueryResult = await this.bigQueryConnector.getSectorClassification(companyProfile);
      
      if (bigQueryResult.confidence > 0.7) {
        logger.info(`High-confidence sector classification from BigQuery: ${bigQueryResult.primarySector}`);
        return bigQueryResult;
      }

      // Fallback to rule-based classification
      const ruleBasedResult = this.classifyByRules(companyProfile);
      
      if (ruleBasedResult.confidence > bigQueryResult.confidence) {
        logger.info(`Using rule-based classification: ${ruleBasedResult.primarySector}`);
        return ruleBasedResult;
      }

      // Use keyword-based classification as final fallback
      const keywordResult = this.classifyByKeywords(companyProfile);
      
      // Return the result with highest confidence
      const results = [bigQueryResult, ruleBasedResult, keywordResult];
      const bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      logger.info(`Final sector classification: ${bestResult.primarySector} (confidence: ${bestResult.confidence})`);
      return bestResult;

    } catch (error) {
      logger.error('Error in sector classification:', error);
      // Return keyword-based classification as ultimate fallback
      return this.classifyByKeywords(companyProfile);
    }
  }

  /**
   * Get detailed sector analysis with confidence breakdown
   */
  async getDetailedClassification(companyProfile: CompanyProfile): Promise<{
    classification: SectorClassification;
    analysis: {
      bigQueryMatch?: SectorClassification;
      ruleBasedMatch?: SectorClassification;
      keywordMatch: SectorClassification;
      confidenceBreakdown: Record<string, number>;
    };
  }> {
    const analysis: any = {
      confidenceBreakdown: {}
    };

    try {
      // Get all classification methods
      analysis.bigQueryMatch = await this.bigQueryConnector.getSectorClassification(companyProfile);
      analysis.confidenceBreakdown.bigQuery = analysis.bigQueryMatch.confidence;
    } catch (error) {
      logger.warn('BigQuery classification failed, using fallbacks');
    }

    analysis.ruleBasedMatch = this.classifyByRules(companyProfile);
    analysis.confidenceBreakdown.ruleBased = analysis.ruleBasedMatch.confidence;

    analysis.keywordMatch = this.classifyByKeywords(companyProfile);
    analysis.confidenceBreakdown.keyword = analysis.keywordMatch.confidence;

    // Select best classification
    const candidates = [
      analysis.bigQueryMatch,
      analysis.ruleBasedMatch,
      analysis.keywordMatch
    ].filter(Boolean);

    const classification = candidates.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return { classification, analysis };
  }

  /**
   * Classify using predefined business rules
   */
  private classifyByRules(companyProfile: CompanyProfile): SectorClassification {
    for (const rule of this.classificationRules) {
      if (rule.condition(companyProfile)) {
        return {
          primarySector: rule.sector,
          secondarySectors: [],
          confidence: rule.confidence,
          reasoning: rule.reasoning
        };
      }
    }

    return {
      primarySector: 'other',
      secondarySectors: [],
      confidence: 0.2,
      reasoning: 'No classification rules matched'
    };
  }

  /**
   * Classify using keyword matching
   */
  private classifyByKeywords(companyProfile: CompanyProfile): SectorClassification {
    const text = `${companyProfile.name} ${companyProfile.oneLiner} ${companyProfile.description || ''}`.toLowerCase();
    const sectorScores: Record<string, number> = {};

    // Calculate scores for each sector based on keyword matches
    for (const [sector, config] of Object.entries(this.sectorKeywords)) {
      let score = 0;
      for (const keyword of config.keywords) {
        const matches = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
        score += matches * config.weight;
      }
      sectorScores[sector] = score;
    }

    // Find the sector with highest score
    const sortedSectors = Object.entries(sectorScores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score > 0);

    if (sortedSectors.length === 0) {
      return {
        primarySector: 'other',
        secondarySectors: [],
        confidence: 0.1,
        reasoning: 'No keyword matches found'
      };
    }

    const [primarySector, primaryScore] = sortedSectors[0];
    const secondarySectors = sortedSectors
      .slice(1, 3)
      .filter(([, score]) => score > primaryScore * 0.5)
      .map(([sector]) => sector);

    // Calculate confidence based on score and keyword matches
    const maxPossibleScore = Math.max(...Object.values(this.sectorKeywords).map(c => c.keywords.length * c.weight));
    const confidence = Math.min(0.9, (primaryScore / maxPossibleScore) * 2);

    return {
      primarySector,
      secondarySectors,
      confidence,
      reasoning: `Keyword-based classification with ${sortedSectors.length} sector matches`
    };
  }

  /**
   * Initialize sector keyword mappings
   */
  private initializeSectorKeywords(): void {
    this.sectorKeywords = {
      'fintech': {
        keywords: [
          'finance', 'financial', 'banking', 'bank', 'payment', 'payments', 'lending', 'loan', 'credit',
          'crypto', 'cryptocurrency', 'blockchain', 'bitcoin', 'defi', 'neobank', 'insurtech', 'wealthtech',
          'regtech', 'trading', 'investment', 'portfolio', 'wallet', 'remittance', 'forex'
        ],
        weight: 1.0,
        subSectors: ['payments', 'lending', 'crypto', 'insurtech', 'wealthtech', 'regtech']
      },
      'healthtech': {
        keywords: [
          'health', 'healthcare', 'medical', 'medicine', 'hospital', 'clinic', 'patient', 'doctor',
          'biotech', 'pharma', 'pharmaceutical', 'drug', 'therapy', 'diagnostic', 'telemedicine',
          'medtech', 'digital health', 'wellness', 'fitness', 'mental health', 'genomics'
        ],
        weight: 1.0,
        subSectors: ['biotech', 'medtech', 'digital-health', 'telemedicine']
      },
      'edtech': {
        keywords: [
          'education', 'educational', 'learning', 'school', 'university', 'student', 'teacher',
          'training', 'course', 'curriculum', 'e-learning', 'online learning', 'mooc', 'lms',
          'skill', 'certification', 'academic', 'classroom', 'tutoring'
        ],
        weight: 1.0,
        subSectors: ['k12', 'higher-ed', 'corporate-training', 'language-learning']
      },
      'enterprise-software': {
        keywords: [
          'enterprise', 'b2b', 'business', 'saas', 'software', 'platform', 'api', 'cloud',
          'productivity', 'workflow', 'automation', 'crm', 'erp', 'hr', 'analytics',
          'dashboard', 'integration', 'collaboration', 'project management'
        ],
        weight: 0.8,
        subSectors: ['productivity', 'analytics', 'automation', 'collaboration']
      },
      'consumer': {
        keywords: [
          'consumer', 'b2c', 'marketplace', 'social', 'mobile', 'app', 'gaming', 'entertainment',
          'media', 'content', 'streaming', 'e-commerce', 'retail', 'shopping', 'lifestyle',
          'travel', 'food', 'delivery', 'dating', 'community'
        ],
        weight: 0.7,
        subSectors: ['marketplace', 'social', 'gaming', 'e-commerce', 'media']
      },
      'deeptech': {
        keywords: [
          'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning', 'neural',
          'robotics', 'robot', 'iot', 'internet of things', 'quantum', 'ar', 'vr',
          'augmented reality', 'virtual reality', 'computer vision', 'nlp', 'autonomous'
        ],
        weight: 1.2,
        subSectors: ['ai-ml', 'robotics', 'iot', 'ar-vr', 'quantum']
      },
      'mobility': {
        keywords: [
          'transportation', 'mobility', 'automotive', 'car', 'vehicle', 'ride', 'sharing',
          'autonomous vehicle', 'electric vehicle', 'ev', 'logistics', 'delivery', 'freight',
          'supply chain', 'fleet', 'navigation', 'traffic'
        ],
        weight: 1.0,
        subSectors: ['rideshare', 'logistics', 'autonomous', 'electric-vehicles']
      },
      'proptech': {
        keywords: [
          'real estate', 'property', 'housing', 'home', 'rent', 'rental', 'mortgage',
          'construction', 'architecture', 'building', 'smart home', 'proptech'
        ],
        weight: 1.0,
        subSectors: ['residential', 'commercial', 'construction', 'smart-buildings']
      }
    };
  }

  /**
   * Initialize classification rules
   */
  private initializeClassificationRules(): void {
    this.classificationRules = [
      {
        condition: (profile) => profile.website?.includes('bank') || profile.name.toLowerCase().includes('bank'),
        sector: 'fintech',
        confidence: 0.8,
        reasoning: 'Company name or website indicates banking focus'
      },
      {
        condition: (profile) => profile.website?.includes('health') || profile.name.toLowerCase().includes('health'),
        sector: 'healthtech',
        confidence: 0.8,
        reasoning: 'Company name or website indicates healthcare focus'
      },
      {
        condition: (profile) => profile.website?.includes('edu') || profile.name.toLowerCase().includes('edu'),
        sector: 'edtech',
        confidence: 0.8,
        reasoning: 'Company name or website indicates education focus'
      },
      {
        condition: (profile) => profile.oneLiner.toLowerCase().includes('b2b') || profile.oneLiner.toLowerCase().includes('enterprise'),
        sector: 'enterprise-software',
        confidence: 0.7,
        reasoning: 'Company description explicitly mentions B2B or enterprise focus'
      },
      {
        condition: (profile) => profile.oneLiner.toLowerCase().includes('marketplace') || profile.oneLiner.toLowerCase().includes('platform'),
        sector: 'consumer',
        confidence: 0.6,
        reasoning: 'Company description mentions marketplace or platform model'
      }
    ];
  }
}