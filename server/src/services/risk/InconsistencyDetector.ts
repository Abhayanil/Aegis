// Inconsistency detection service for cross-document validation
import { AnalysisResult, MarketClaims } from '../../models/AnalysisResult.js';
import { InvestmentMetrics } from '../../models/InvestmentMetrics.js';
import { RiskFlag, RiskFlagInput } from '../../models/RiskFlag.js';
import { RiskType, RiskSeverity } from '../../types/enums.js';
import { ConsistencyIssue } from '../../types/interfaces.js';
import { v4 as uuidv4 } from 'uuid';

export interface InconsistencyThresholds {
  financial: {
    revenueVariance: number; // Percentage variance threshold
    growthRateVariance: number;
    customerCountVariance: number;
  };
  market: {
    tamVariance: number;
    samVariance: number;
    competitorCountVariance: number;
  };
  team: {
    sizeVariance: number;
    founderCountVariance: number;
  };
}

export class InconsistencyDetector {
  private thresholds: InconsistencyThresholds;

  constructor(thresholds?: Partial<InconsistencyThresholds>) {
    this.thresholds = {
      financial: {
        revenueVariance: 0.15, // 15% variance threshold
        growthRateVariance: 0.20, // 20% variance threshold
        customerCountVariance: 0.10, // 10% variance threshold
      },
      market: {
        tamVariance: 0.25, // 25% variance threshold
        samVariance: 0.20, // 20% variance threshold
        competitorCountVariance: 0.30, // 30% variance threshold
      },
      team: {
        sizeVariance: 0.05, // 5% variance threshold (team size should be consistent)
        founderCountVariance: 0, // No variance allowed for founder count
      },
      ...thresholds,
    };
  }

  /**
   * Detects inconsistencies across multiple analysis results
   */
  async detectInconsistencies(analysisResults: AnalysisResult[]): Promise<RiskFlag[]> {
    if (analysisResults.length < 2) {
      return [];
    }

    const riskFlags: RiskFlag[] = [];

    // Detect financial metric inconsistencies
    const financialFlags = await this.detectFinancialInconsistencies(analysisResults);
    riskFlags.push(...financialFlags);

    // Detect market size inconsistencies
    const marketFlags = await this.detectMarketSizeInconsistencies(analysisResults);
    riskFlags.push(...marketFlags);

    // Detect team data inconsistencies
    const teamFlags = await this.detectTeamInconsistencies(analysisResults);
    riskFlags.push(...teamFlags);

    return riskFlags;
  }

  /**
   * Detects inconsistencies in financial metrics across documents
   */
  private async detectFinancialInconsistencies(analysisResults: AnalysisResult[]): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];
    const metrics = analysisResults.map(result => result.extractedMetrics);

    // Check ARR/Revenue consistency
    const arrValues = metrics
      .map((m, index) => ({ value: m.revenue?.arr, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (arrValues.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        arrValues.map(item => item.value!),
        this.thresholds.financial.revenueVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: this.calculateSeverity(inconsistency.variance, this.thresholds.financial.revenueVariance),
          title: 'ARR/Revenue Inconsistency',
          description: `ARR values vary significantly across documents: ${arrValues.map(item => `$${item.value?.toLocaleString()}`).join(', ')}`,
          affectedMetrics: ['revenue.arr'],
          suggestedMitigation: 'Clarify which ARR figure is most current and accurate. Request monthly recurring revenue breakdown.',
          sourceDocuments: arrValues.map(item => item.source),
          confidence: 0.9,
          impact: inconsistency.variance > 0.3 ? 'high' : 'medium',
          likelihood: 'high',
          category: 'financial',
          evidence: arrValues.map(item => `ARR: $${item.value?.toLocaleString()} (Source: ${item.source})`),
        }));
      }
    }

    // Check growth rate consistency
    const growthRates = metrics
      .map((m, index) => ({ value: m.revenue?.growthRate, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (growthRates.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        growthRates.map(item => item.value!),
        this.thresholds.financial.growthRateVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: this.calculateSeverity(inconsistency.variance, this.thresholds.financial.growthRateVariance),
          title: 'Growth Rate Inconsistency',
          description: `Growth rates vary across documents: ${growthRates.map(item => `${(item.value! * 100).toFixed(1)}%`).join(', ')}`,
          affectedMetrics: ['revenue.growthRate'],
          suggestedMitigation: 'Verify the time period and calculation method for growth rate. Request detailed revenue progression.',
          sourceDocuments: growthRates.map(item => item.source),
          confidence: 0.85,
          impact: 'medium',
          likelihood: 'high',
          category: 'financial',
          evidence: growthRates.map(item => `Growth Rate: ${(item.value! * 100).toFixed(1)}% (Source: ${item.source})`),
        }));
      }
    }

    // Check customer count consistency
    const customerCounts = metrics
      .map((m, index) => ({ value: m.traction?.customers, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (customerCounts.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        customerCounts.map(item => item.value!),
        this.thresholds.financial.customerCountVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: this.calculateSeverity(inconsistency.variance, this.thresholds.financial.customerCountVariance),
          title: 'Customer Count Inconsistency',
          description: `Customer counts vary across documents: ${customerCounts.map(item => item.value?.toLocaleString()).join(', ')}`,
          affectedMetrics: ['traction.customers'],
          suggestedMitigation: 'Clarify customer definition and counting methodology. Request current customer breakdown by segment.',
          sourceDocuments: customerCounts.map(item => item.source),
          confidence: 0.8,
          impact: 'medium',
          likelihood: 'medium',
          category: 'financial',
          evidence: customerCounts.map(item => `Customers: ${item.value?.toLocaleString()} (Source: ${item.source})`),
        }));
      }
    }

    return flags;
  }

  /**
   * Detects inconsistencies in market size claims
   */
  private async detectMarketSizeInconsistencies(analysisResults: AnalysisResult[]): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];
    const marketClaims = analysisResults.map(result => result.marketClaims);

    // Check TAM consistency
    const tamValues = marketClaims
      .map((m, index) => ({ value: m?.tam, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (tamValues.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        tamValues.map(item => item.value!),
        this.thresholds.market.tamVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: this.calculateSeverity(inconsistency.variance, this.thresholds.market.tamVariance),
          title: 'TAM Size Inconsistency',
          description: `Total Addressable Market values vary significantly: ${tamValues.map(item => `$${(item.value! / 1e9).toFixed(1)}B`).join(', ')}`,
          affectedMetrics: ['marketClaims.tam'],
          suggestedMitigation: 'Request detailed TAM calculation methodology and data sources. Verify market definition consistency.',
          sourceDocuments: tamValues.map(item => item.source),
          confidence: 0.85,
          impact: 'high',
          likelihood: 'medium',
          category: 'market',
          evidence: tamValues.map(item => `TAM: $${(item.value! / 1e9).toFixed(1)}B (Source: ${item.source})`),
        }));
      }
    }

    // Check SAM consistency
    const samValues = marketClaims
      .map((m, index) => ({ value: m?.sam, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (samValues.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        samValues.map(item => item.value!),
        this.thresholds.market.samVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: this.calculateSeverity(inconsistency.variance, this.thresholds.market.samVariance),
          title: 'SAM Size Inconsistency',
          description: `Serviceable Addressable Market values vary: ${samValues.map(item => `$${(item.value! / 1e9).toFixed(1)}B`).join(', ')}`,
          affectedMetrics: ['marketClaims.sam'],
          suggestedMitigation: 'Clarify SAM calculation approach and geographic/segment scope. Request supporting market research.',
          sourceDocuments: samValues.map(item => item.source),
          confidence: 0.8,
          impact: 'medium',
          likelihood: 'medium',
          category: 'market',
          evidence: samValues.map(item => `SAM: $${(item.value! / 1e9).toFixed(1)}B (Source: ${item.source})`),
        }));
      }
    }

    return flags;
  }

  /**
   * Detects inconsistencies in team data
   */
  private async detectTeamInconsistencies(analysisResults: AnalysisResult[]): Promise<RiskFlag[]> {
    const flags: RiskFlag[] = [];
    const teamProfiles = analysisResults.map(result => result.teamAssessment);

    // Check team size consistency
    const teamSizes = teamProfiles
      .map((t, index) => ({ value: t?.totalSize, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (teamSizes.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        teamSizes.map(item => item.value!),
        this.thresholds.team.sizeVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: this.calculateSeverity(inconsistency.variance, this.thresholds.team.sizeVariance),
          title: 'Team Size Inconsistency',
          description: `Team sizes vary across documents: ${teamSizes.map(item => item.value).join(', ')} employees`,
          affectedMetrics: ['teamAssessment.totalSize'],
          suggestedMitigation: 'Clarify current team count and whether contractors/advisors are included. Request org chart.',
          sourceDocuments: teamSizes.map(item => item.source),
          confidence: 0.9,
          impact: 'low',
          likelihood: 'high',
          category: 'team',
          evidence: teamSizes.map(item => `Team Size: ${item.value} (Source: ${item.source})`),
        }));
      }
    }

    // Check founder count consistency
    const founderCounts = teamProfiles
      .map((t, index) => ({ value: t?.founders?.length, source: analysisResults[index].sourceDocumentIds[0] }))
      .filter(item => item.value !== undefined);

    if (founderCounts.length >= 2) {
      const inconsistency = this.checkNumericConsistency(
        founderCounts.map(item => item.value!),
        this.thresholds.team.founderCountVariance
      );

      if (inconsistency.isInconsistent) {
        flags.push(this.createRiskFlag({
          type: RiskType.INCONSISTENCY,
          severity: RiskSeverity.HIGH, // Founder count should never vary
          title: 'Founder Count Inconsistency',
          description: `Number of founders varies across documents: ${founderCounts.map(item => item.value).join(', ')}`,
          affectedMetrics: ['teamAssessment.founders'],
          suggestedMitigation: 'Clarify founding team structure and equity distribution. Verify co-founder vs advisor roles.',
          sourceDocuments: founderCounts.map(item => item.source),
          confidence: 0.95,
          impact: 'high',
          likelihood: 'high',
          category: 'team',
          evidence: founderCounts.map(item => `Founders: ${item.value} (Source: ${item.source})`),
        }));
      }
    }

    return flags;
  }

  /**
   * Checks if numeric values are consistent within threshold
   */
  private checkNumericConsistency(values: number[], threshold: number): { isInconsistent: boolean; variance: number } {
    if (values.length < 2) {
      return { isInconsistent: false, variance: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = (max - min) / min;

    return {
      isInconsistent: variance > threshold,
      variance,
    };
  }

  /**
   * Calculates risk severity based on variance and threshold
   */
  private calculateSeverity(variance: number, threshold: number): RiskSeverity {
    const severityRatio = variance / threshold;
    
    if (severityRatio >= 2.0) {
      return RiskSeverity.HIGH;
    } else if (severityRatio >= 1.5) {
      return RiskSeverity.MEDIUM;
    } else {
      return RiskSeverity.LOW;
    }
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