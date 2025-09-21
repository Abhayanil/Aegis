// Market size and TAM validation service
import { MarketClaims } from '../../models/AnalysisResult.js';
import { RiskFlag, RiskFlagInput } from '../../models/RiskFlag.js';
import { RiskType, RiskSeverity } from '../../types/enums.js';
import { ValidationResult } from '../../types/interfaces.js';
import { v4 as uuidv4 } from 'uuid';

export interface MarketSizeThresholds {
  tamToSamRatio: {
    min: number; // Minimum TAM/SAM ratio (SAM should be subset of TAM)
    max: number; // Maximum reasonable TAM/SAM ratio
  };
  samToSomRatio: {
    min: number; // Minimum SAM/SOM ratio
    max: number; // Maximum reasonable SAM/SOM ratio
  };
  marketGrowthRate: {
    min: number; // Minimum reasonable market growth rate
    max: number; // Maximum believable market growth rate
  };
  competitorThresholds: {
    minCompetitors: number; // Minimum expected competitors in a real market
    maxCompetitors: number; // Maximum competitors before market becomes too fragmented
  };
}

export interface ExternalMarketData {
  sector: string;
  estimatedTam: number;
  estimatedSam: number;
  growthRate: number;
  keyCompetitors: string[];
  marketMaturity: 'emerging' | 'growth' | 'mature' | 'declining';
  dataSource: string;
  confidence: number;
}

export interface CompetitiveLandscapeAssessment {
  completenessScore: number; // 0-1 score
  missingSegments: string[];
  overlookedCompetitors: string[];
  competitiveGaps: string[];
  marketCoverageScore: number;
}

export class MarketSizeValidator {
  private thresholds: MarketSizeThresholds;
  private externalDataSources: Map<string, ExternalMarketData>;

  constructor(thresholds?: Partial<MarketSizeThresholds>) {
    this.thresholds = {
      tamToSamRatio: {
        min: 2, // SAM should be at most 50% of TAM
        max: 100, // SAM should be at least 1% of TAM
      },
      samToSomRatio: {
        min: 2, // SOM should be at most 50% of SAM
        max: 50, // SOM should be at least 2% of SAM
      },
      marketGrowthRate: {
        min: -0.05, // -5% (declining markets)
        max: 1.0, // 100% (very high growth)
      },
      competitorThresholds: {
        minCompetitors: 2, // At least 2 competitors expected
        maxCompetitors: 50, // More than 50 suggests fragmented market
      },
      ...thresholds,
    };

    // Initialize with some common market data (in real implementation, this would come from external APIs)
    this.externalDataSources = new Map();
    this.initializeMarketData();
  }

  /**
   * Validates market size claims against external data and logical consistency
   */
  async validateMarketClaims(marketClaims: MarketClaims, sector?: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate TAM/SAM/SOM relationships
    const relationshipValidation = this.validateMarketSizeRelationships(marketClaims);
    errors.push(...relationshipValidation.errors);
    warnings.push(...relationshipValidation.warnings);

    // Validate against external data if available
    if (sector) {
      const externalValidation = await this.validateAgainstExternalData(marketClaims, sector);
      errors.push(...externalValidation.errors);
      warnings.push(...externalValidation.warnings);
    }

    // Validate market growth rate
    const growthValidation = this.validateMarketGrowthRate(marketClaims);
    errors.push(...growthValidation.errors);
    warnings.push(...growthValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates risk flags for market size validation issues
   */
  async generateMarketSizeRiskFlags(
    marketClaims: MarketClaims,
    sector?: string,
    sourceDocuments: string[] = []
  ): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];

    // Check for inflated TAM claims
    const tamFlags = await this.detectInflatedTamClaims(marketClaims, sector, sourceDocuments);
    flags.push(...tamFlags);

    // Check for unrealistic market growth assumptions
    const growthFlags = await this.detectUnrealisticGrowthAssumptions(marketClaims, sourceDocuments);
    flags.push(...growthFlags);

    // Check for insufficient market validation
    const validationFlags = await this.detectInsufficientMarketValidation(marketClaims, sourceDocuments);
    flags.push(...validationFlags);

    return flags;
  }

  /**
   * Assesses competitive landscape completeness
   */
  async assessCompetitiveLandscape(
    marketClaims: MarketClaims,
    sector?: string
  ): Promise<CompetitiveLandscapeAssessment> {
    const competitors = marketClaims.competitiveLandscape || [];
    const competitorCount = marketClaims.competitorCount || competitors.length;

    let completenessScore = 0;
    const missingSegments: string[] = [];
    const overlookedCompetitors: string[] = [];
    const competitiveGaps: string[] = [];

    // Assess competitor count reasonableness
    if (competitorCount < this.thresholds.competitorThresholds.minCompetitors) {
      completenessScore -= 0.3;
      competitiveGaps.push('Insufficient competitor identification - market may be more competitive than claimed');
    } else if (competitorCount > this.thresholds.competitorThresholds.maxCompetitors) {
      completenessScore -= 0.2;
      competitiveGaps.push('Overly fragmented competitive landscape - may indicate market definition issues');
    } else {
      completenessScore += 0.3;
    }

    // Check for competitive landscape description quality
    if (!marketClaims.competitiveLandscape || marketClaims.competitiveLandscape.length === 0) {
      completenessScore -= 0.4;
      missingSegments.push('Direct competitors');
      missingSegments.push('Indirect competitors');
    } else {
      completenessScore += 0.4;
    }

    // Check for market barriers and opportunities analysis
    if (!marketClaims.barriers || marketClaims.barriers.length === 0) {
      completenessScore -= 0.2;
      missingSegments.push('Market entry barriers');
    } else {
      completenessScore += 0.1;
    }

    if (!marketClaims.opportunities || marketClaims.opportunities.length === 0) {
      completenessScore -= 0.1;
      missingSegments.push('Market opportunities');
    } else {
      completenessScore += 0.1;
    }

    // Check against external data if available
    if (sector) {
      const externalData = this.externalDataSources.get(sector);
      if (externalData) {
        const knownCompetitors = externalData.keyCompetitors;
        const mentionedCompetitors = competitors.map(c => c.toLowerCase());
        
        for (const knownCompetitor of knownCompetitors) {
          if (!mentionedCompetitors.some(mentioned => 
            mentioned.includes(knownCompetitor.toLowerCase()) || 
            knownCompetitor.toLowerCase().includes(mentioned)
          )) {
            overlookedCompetitors.push(knownCompetitor);
          }
        }

        if (overlookedCompetitors.length > 0) {
          completenessScore -= Math.min(0.3, overlookedCompetitors.length * 0.1);
        }
      }
    }

    // Ensure score is between 0 and 1
    completenessScore = Math.max(0, Math.min(1, completenessScore + 0.5));

    const marketCoverageScore = this.calculateMarketCoverageScore(marketClaims, sector);

    return {
      completenessScore,
      missingSegments,
      overlookedCompetitors,
      competitiveGaps,
      marketCoverageScore,
    };
  }

  /**
   * Validates TAM/SAM/SOM relationships for logical consistency
   */
  private validateMarketSizeRelationships(marketClaims: MarketClaims): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { tam, sam, som } = marketClaims;

    // Check TAM/SAM relationship
    if (tam && sam) {
      const tamToSamRatio = tam / sam;
      if (tamToSamRatio < this.thresholds.tamToSamRatio.min) {
        errors.push(`SAM (${(sam / 1e9).toFixed(1)}B) is unrealistically large compared to TAM (${(tam / 1e9).toFixed(1)}B)`);
      } else if (tamToSamRatio > this.thresholds.tamToSamRatio.max) {
        warnings.push(`SAM appears very small relative to TAM - may indicate overly narrow market definition`);
      }
    }

    // Check SAM/SOM relationship
    if (sam && som) {
      const samToSomRatio = sam / som;
      if (samToSomRatio < this.thresholds.samToSomRatio.min) {
        errors.push(`SOM (${(som / 1e9).toFixed(1)}B) is unrealistically large compared to SAM (${(sam / 1e9).toFixed(1)}B)`);
      } else if (samToSomRatio > this.thresholds.samToSomRatio.max) {
        warnings.push(`SOM appears very conservative relative to SAM - may indicate limited growth ambition`);
      }
    }

    // Check for missing market size data
    if (!tam && !sam) {
      warnings.push('No market size data provided - unable to assess market opportunity');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates market claims against external data sources
   */
  private async validateAgainstExternalData(
    marketClaims: MarketClaims,
    sector: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const externalData = this.externalDataSources.get(sector);
    if (!externalData) {
      warnings.push(`No external market data available for sector: ${sector}`);
      return { isValid: true, errors, warnings };
    }

    // Compare TAM claims
    if (marketClaims.tam && externalData.estimatedTam) {
      const variance = Math.abs(marketClaims.tam - externalData.estimatedTam) / externalData.estimatedTam;
      if (variance > 0.5) { // More than 50% variance
        if (marketClaims.tam > externalData.estimatedTam * 1.5) {
          errors.push(`TAM claim (${(marketClaims.tam / 1e9).toFixed(1)}B) significantly exceeds external estimates (${(externalData.estimatedTam / 1e9).toFixed(1)}B)`);
        } else {
          warnings.push(`TAM claim differs significantly from external estimates - verify market definition`);
        }
      }
    }

    // Compare growth rate claims
    if (marketClaims.marketGrowthRate && externalData.growthRate) {
      const growthVariance = Math.abs(marketClaims.marketGrowthRate - externalData.growthRate);
      if (growthVariance > 0.2) { // More than 20 percentage points difference
        if (marketClaims.marketGrowthRate > externalData.growthRate + 0.2) {
          warnings.push(`Market growth rate claim (${(marketClaims.marketGrowthRate * 100).toFixed(1)}%) exceeds external estimates (${(externalData.growthRate * 100).toFixed(1)}%)`);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates market growth rate assumptions
   */
  private validateMarketGrowthRate(marketClaims: MarketClaims): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const growthRate = marketClaims.marketGrowthRate;
    if (growthRate !== undefined) {
      if (growthRate < this.thresholds.marketGrowthRate.min) {
        warnings.push(`Market growth rate (${(growthRate * 100).toFixed(1)}%) indicates declining market`);
      } else if (growthRate > this.thresholds.marketGrowthRate.max) {
        errors.push(`Market growth rate (${(growthRate * 100).toFixed(1)}%) is unrealistically high`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Detects inflated TAM claims
   */
  private async detectInflatedTamClaims(
    marketClaims: MarketClaims,
    sector?: string,
    sourceDocuments: string[] = []
  ): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];

    if (!marketClaims.tam) {
      return flags;
    }

    // Check for extremely large TAM claims
    if (marketClaims.tam > 1e12) { // > $1 trillion
      flags.push(this.createRiskFlag({
        type: RiskType.MARKET_SIZE,
        severity: RiskSeverity.HIGH,
        title: 'Inflated TAM Claim',
        description: `TAM claim of ${(marketClaims.tam / 1e12).toFixed(1)} trillion appears unrealistically large`,
        affectedMetrics: ['marketClaims.tam'],
        suggestedMitigation: 'Request detailed TAM calculation methodology and validate against multiple external sources',
        sourceDocuments,
        confidence: 0.9,
        impact: 'high',
        likelihood: 'high',
        category: 'market',
        evidence: [`TAM: ${(marketClaims.tam / 1e12).toFixed(1)}T`],
      }));
    }

    // Check TAM/SAM ratio for reasonableness
    if (marketClaims.sam && marketClaims.tam) {
      const ratio = marketClaims.tam / marketClaims.sam;
      if (ratio > 100) {
        flags.push(this.createRiskFlag({
          type: RiskType.MARKET_SIZE,
          severity: RiskSeverity.MEDIUM,
          title: 'Questionable TAM/SAM Ratio',
          description: `TAM is ${ratio.toFixed(0)}x larger than SAM, suggesting overly broad market definition`,
          affectedMetrics: ['marketClaims.tam', 'marketClaims.sam'],
          suggestedMitigation: 'Refine market segmentation and validate addressable market assumptions',
          sourceDocuments,
          confidence: 0.8,
          impact: 'medium',
          likelihood: 'medium',
          category: 'market',
          evidence: [
            `TAM: ${(marketClaims.tam / 1e9).toFixed(1)}B`,
            `SAM: ${(marketClaims.sam / 1e9).toFixed(1)}B`,
            `Ratio: ${ratio.toFixed(0)}x`
          ],
        }));
      }
    }

    return flags;
  }

  /**
   * Detects unrealistic market growth assumptions
   */
  private async detectUnrealisticGrowthAssumptions(
    marketClaims: MarketClaims,
    sourceDocuments: string[] = []
  ): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];

    const growthRate = marketClaims.marketGrowthRate;
    if (growthRate && growthRate > 0.5) { // > 50% growth
      flags.push(this.createRiskFlag({
        type: RiskType.MARKET_SIZE,
        severity: RiskSeverity.MEDIUM,
        title: 'Unrealistic Market Growth Rate',
        description: `Market growth rate of ${(growthRate * 100).toFixed(1)}% appears optimistic`,
        affectedMetrics: ['marketClaims.marketGrowthRate'],
        suggestedMitigation: 'Validate growth rate against multiple industry sources and historical data',
        sourceDocuments,
        confidence: 0.75,
        impact: 'medium',
        likelihood: 'medium',
        category: 'market',
        evidence: [`Market Growth Rate: ${(growthRate * 100).toFixed(1)}%`],
      }));
    }

    return flags;
  }

  /**
   * Detects insufficient market validation
   */
  private async detectInsufficientMarketValidation(
    marketClaims: MarketClaims,
    sourceDocuments: string[] = []
  ): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];

    // Check for missing competitive analysis
    if (!marketClaims.competitiveLandscape || marketClaims.competitiveLandscape.length === 0) {
      flags.push(this.createRiskFlag({
        type: RiskType.MARKET_SIZE,
        severity: RiskSeverity.MEDIUM,
        title: 'Insufficient Competitive Analysis',
        description: 'No competitive landscape analysis provided',
        affectedMetrics: ['marketClaims.competitiveLandscape'],
        suggestedMitigation: 'Conduct thorough competitive analysis including direct and indirect competitors',
        sourceDocuments,
        confidence: 0.9,
        impact: 'medium',
        likelihood: 'high',
        category: 'market',
        evidence: ['No competitors identified'],
      }));
    }

    // Check for missing market barriers analysis
    if (!marketClaims.barriers || marketClaims.barriers.length === 0) {
      flags.push(this.createRiskFlag({
        type: RiskType.MARKET_SIZE,
        severity: RiskSeverity.LOW,
        title: 'Missing Market Barriers Analysis',
        description: 'No market entry barriers identified',
        affectedMetrics: ['marketClaims.barriers'],
        suggestedMitigation: 'Analyze potential market entry barriers and competitive moats',
        sourceDocuments,
        confidence: 0.8,
        impact: 'low',
        likelihood: 'medium',
        category: 'market',
        evidence: ['No market barriers identified'],
      }));
    }

    return flags;
  }

  /**
   * Calculates market coverage score based on competitive analysis completeness
   */
  private calculateMarketCoverageScore(marketClaims: MarketClaims, sector?: string): number {
    let score = 0;

    // Base score for having competitive landscape
    if (marketClaims.competitiveLandscape && marketClaims.competitiveLandscape.length > 0) {
      score += 0.3;
    }

    // Score for having market barriers analysis
    if (marketClaims.barriers && marketClaims.barriers.length > 0) {
      score += 0.2;
    }

    // Score for having opportunities analysis
    if (marketClaims.opportunities && marketClaims.opportunities.length > 0) {
      score += 0.2;
    }

    // Score for having market trends analysis
    if (marketClaims.marketTrends && marketClaims.marketTrends.length > 0) {
      score += 0.2;
    }

    // Score for reasonable competitor count
    const competitorCount = marketClaims.competitorCount || (marketClaims.competitiveLandscape?.length || 0);
    if (competitorCount >= this.thresholds.competitorThresholds.minCompetitors && 
        competitorCount <= this.thresholds.competitorThresholds.maxCompetitors) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  /**
   * Initialize sample market data (in production, this would come from external APIs)
   */
  private initializeMarketData(): void {
    // Sample data for common sectors
    this.externalDataSources.set('fintech', {
      sector: 'fintech',
      estimatedTam: 310e9, // $310B
      estimatedSam: 50e9,  // $50B
      growthRate: 0.25,    // 25%
      keyCompetitors: ['Stripe', 'Square', 'PayPal', 'Adyen', 'Plaid'],
      marketMaturity: 'growth',
      dataSource: 'Industry Reports',
      confidence: 0.8,
    });

    this.externalDataSources.set('saas', {
      sector: 'saas',
      estimatedTam: 195e9, // $195B
      estimatedSam: 30e9,  // $30B
      growthRate: 0.18,    // 18%
      keyCompetitors: ['Salesforce', 'Microsoft', 'ServiceNow', 'Workday', 'HubSpot'],
      marketMaturity: 'growth',
      dataSource: 'Industry Reports',
      confidence: 0.85,
    });

    this.externalDataSources.set('healthtech', {
      sector: 'healthtech',
      estimatedTam: 350e9, // $350B
      estimatedSam: 45e9,  // $45B
      growthRate: 0.15,    // 15%
      keyCompetitors: ['Teladoc', 'Veracyte', 'Epic Systems', 'Cerner', 'Allscripts'],
      marketMaturity: 'growth',
      dataSource: 'Industry Reports',
      confidence: 0.75,
    });
  }

  /**
   * Creates a RiskFlag from input data
   */
  private createRiskFlag(input: RiskFlagInput): RiskFlag {
    return {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      detectedAt: new Date(),
      ...input,
    };
  }
}