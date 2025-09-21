// Recommendation generation system for investment thesis and due diligence
import { 
  DealMemo, 
  DealMemoSummary, 
  GrowthPotential, 
  InvestmentRecommendation, 
  AnalysisWeightings 
} from '../../models/DealMemo.js';
import { AnalysisResult } from '../../models/AnalysisResult.js';
import { RiskFlag } from '../../models/RiskFlag.js';
import { BenchmarkComparison } from '../../models/BenchmarkData.js';
import { ScoreBreakdown } from './ScoreCalculator.js';
import { RecommendationType, RiskSeverity } from '../../types/enums.js';

export interface RecommendationContext {
  analysisResult: AnalysisResult;
  scoreBreakdown: ScoreBreakdown;
  riskFlags: RiskFlag[];
  benchmarkComparisons: BenchmarkComparison[];
  weightings: AnalysisWeightings;
}

export interface NarrativeComponents {
  strengths: string[];
  concerns: string[];
  opportunities: string[];
  keyMetrics: string[];
}

export class RecommendationEngine {
  private static readonly SCORE_THRESHOLDS = {
    STRONG_BUY: 80,
    BUY: 65,
    HOLD: 50,
    PASS: 35
  };

  private static readonly VALUATION_MULTIPLES = {
    EARLY_STAGE: { min: 8, max: 15 },
    GROWTH_STAGE: { min: 5, max: 12 },
    MATURE_STAGE: { min: 3, max: 8 }
  };

  /**
   * Generate complete deal memo with recommendations
   */
  generateDealMemo(context: RecommendationContext): DealMemo {
    const summary = this.generateSummary(context);
    const growthPotential = this.generateGrowthPotential(context);
    const investmentRecommendation = this.generateInvestmentRecommendation(context);

    return {
      id: `deal-memo-${context.analysisResult.id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      aegisDealMemo: {
        summary,
        keyBenchmarks: context.benchmarkComparisons,
        growthPotential,
        riskAssessment: {
          overallRiskScore: this.calculateOverallRiskScore(context.riskFlags),
          highPriorityRisks: context.riskFlags.filter(r => r.severity === RiskSeverity.HIGH),
          mediumPriorityRisks: context.riskFlags.filter(r => r.severity === RiskSeverity.MEDIUM),
          lowPriorityRisks: context.riskFlags.filter(r => r.severity === RiskSeverity.LOW),
          riskMitigationPlan: this.generateRiskMitigationPlan(context.riskFlags)
        },
        investmentRecommendation,
        analysisWeightings: context.weightings,
        metadata: {
          generatedBy: 'Aegis AI Analysis Engine',
          analysisVersion: '1.0',
          sourceDocuments: context.analysisResult.sourceDocumentIds,
          processingTime: context.analysisResult.processingTime,
          dataQuality: context.scoreBreakdown.confidence
        }
      }
    };
  }

  /**
   * Generate deal memo summary
   */
  private generateSummary(context: RecommendationContext): DealMemoSummary {
    const { analysisResult, scoreBreakdown } = context;
    
    return {
      companyName: analysisResult.companyProfile.name,
      oneLiner: analysisResult.companyProfile.oneLiner,
      sector: analysisResult.companyProfile.sector,
      stage: analysisResult.companyProfile.stage,
      signalScore: scoreBreakdown.totalScore,
      recommendation: this.determineRecommendationType(scoreBreakdown.totalScore, context.riskFlags),
      confidenceLevel: scoreBreakdown.confidence,
      lastUpdated: new Date()
    };
  }

  /**
   * Generate growth potential analysis
   */
  private generateGrowthPotential(context: RecommendationContext): GrowthPotential {
    const { analysisResult, scoreBreakdown } = context;
    const metrics = analysisResult.extractedMetrics;

    const keyDrivers = this.identifyGrowthDrivers(context);
    const scalabilityFactors = this.identifyScalabilityFactors(context);
    const revenueProjection = this.generateRevenueProjection(metrics);

    return {
      upsideSummary: this.generateUpsideSummary(context, keyDrivers),
      growthTimeline: this.generateGrowthTimeline(context),
      keyDrivers,
      scalabilityFactors,
      marketExpansionOpportunity: this.generateMarketExpansionOpportunity(analysisResult),
      revenueProjection
    };
  }

  /**
   * Generate investment recommendation
   */
  private generateInvestmentRecommendation(context: RecommendationContext): InvestmentRecommendation {
    const narrative = this.generateInvestmentNarrative(context);
    const checkSize = this.suggestCheckSize(context);
    const valuationCap = this.suggestValuationCap(context);
    const diligenceQuestions = this.generateDiligenceQuestions(context);

    return {
      narrative,
      investmentThesis: this.generateInvestmentThesis(context),
      idealCheckSize: checkSize,
      idealValuationCap: valuationCap,
      suggestedTerms: this.generateSuggestedTerms(context),
      keyDiligenceQuestions: diligenceQuestions,
      followUpActions: this.generateFollowUpActions(context),
      timelineToDecision: this.suggestDecisionTimeline(context)
    };
  }

  /**
   * Determine recommendation type based on score and risks
   */
  private determineRecommendationType(score: number, riskFlags: RiskFlag[]): RecommendationType {
    const highRiskCount = riskFlags.filter(r => r.severity === RiskSeverity.HIGH).length;
    
    // Downgrade recommendation if high risks present
    if (highRiskCount >= 3) {
      return RecommendationType.PASS;
    }
    
    if (score >= RecommendationEngine.SCORE_THRESHOLDS.STRONG_BUY && highRiskCount === 0) {
      return RecommendationType.STRONG_BUY;
    } else if (score >= RecommendationEngine.SCORE_THRESHOLDS.BUY && highRiskCount <= 1) {
      return RecommendationType.BUY;
    } else if (score >= RecommendationEngine.SCORE_THRESHOLDS.HOLD) {
      return RecommendationType.HOLD;
    } else {
      return RecommendationType.PASS;
    }
  }

  /**
   * Generate investment narrative
   */
  private generateInvestmentNarrative(context: RecommendationContext): string {
    const components = this.extractNarrativeComponents(context);
    const { analysisResult, scoreBreakdown } = context;
    
    let narrative = `${analysisResult.companyProfile.name} presents `;
    
    if (scoreBreakdown.totalScore >= 70) {
      narrative += "a compelling investment opportunity ";
    } else if (scoreBreakdown.totalScore >= 50) {
      narrative += "a moderate investment opportunity ";
    } else {
      narrative += "a challenging investment case ";
    }
    
    narrative += `in the ${analysisResult.companyProfile.sector} sector. `;
    
    // Add key strengths
    if (components.strengths.length > 0) {
      narrative += `Key strengths include ${components.strengths.slice(0, 3).join(', ')}. `;
    }
    
    // Add market opportunity
    if (analysisResult.marketClaims.tam) {
      const tamBillions = analysisResult.marketClaims.tam / 1_000_000_000;
      narrative += `The company operates in a $${tamBillions.toFixed(1)}B market `;
      
      if (analysisResult.marketClaims.marketGrowthRate) {
        narrative += `growing at ${analysisResult.marketClaims.marketGrowthRate}% annually. `;
      } else {
        narrative += "with significant growth potential. ";
      }
    }
    
    // Add traction summary
    if (analysisResult.extractedMetrics.revenue.arr) {
      const arrMillions = analysisResult.extractedMetrics.revenue.arr / 1_000_000;
      narrative += `Current ARR of $${arrMillions.toFixed(1)}M `;
      
      if (analysisResult.extractedMetrics.revenue.growthRate) {
        narrative += `with ${analysisResult.extractedMetrics.revenue.growthRate}% growth `;
      }
      
      narrative += "demonstrates strong market traction. ";
    }
    
    // Add concerns if present
    if (components.concerns.length > 0) {
      narrative += `Key areas of focus include ${components.concerns.slice(0, 2).join(' and ')}. `;
    }
    
    return narrative.trim();
  }

  /**
   * Generate investment thesis
   */
  private generateInvestmentThesis(context: RecommendationContext): string {
    const { analysisResult, scoreBreakdown } = context;
    const topComponent = this.getTopScoringComponent(scoreBreakdown);
    
    let thesis = `Investment thesis centers on `;
    
    switch (topComponent) {
      case 'marketOpportunity':
        thesis += `the significant market opportunity in ${analysisResult.companyProfile.sector}`;
        break;
      case 'team':
        thesis += `the exceptional founding team with proven track record`;
        break;
      case 'traction':
        thesis += `strong market traction and growth momentum`;
        break;
      case 'product':
        thesis += `differentiated product offering and technology advantage`;
        break;
      case 'competitivePosition':
        thesis += `defensible competitive position and market moat`;
        break;
      default:
        thesis += `balanced strengths across multiple dimensions`;
    }
    
    thesis += `. The company is well-positioned to capture market share through `;
    
    const drivers = this.identifyGrowthDrivers(context);
    if (drivers.length > 0) {
      thesis += drivers.slice(0, 2).join(' and ');
    } else {
      thesis += "continued execution on current strategy";
    }
    
    thesis += ".";
    
    return thesis;
  }

  /**
   * Extract narrative components from analysis
   */
  private extractNarrativeComponents(context: RecommendationContext): NarrativeComponents {
    const { analysisResult, scoreBreakdown, riskFlags } = context;
    const strengths: string[] = [];
    const concerns: string[] = [];
    const opportunities: string[] = [];
    const keyMetrics: string[] = [];

    // Identify strengths based on high-scoring components
    if (scoreBreakdown.rawComponents.team >= 70) {
      strengths.push("experienced founding team");
    }
    if (scoreBreakdown.rawComponents.traction >= 70) {
      strengths.push("strong market traction");
    }
    if (scoreBreakdown.rawComponents.marketOpportunity >= 70) {
      strengths.push("large market opportunity");
    }
    if (scoreBreakdown.rawComponents.product >= 70) {
      strengths.push("differentiated product");
    }
    if (scoreBreakdown.rawComponents.competitivePosition >= 70) {
      strengths.push("defensible competitive position");
    }

    // Identify concerns from risk flags and low scores
    riskFlags.filter(r => r.severity === RiskSeverity.HIGH).forEach(risk => {
      concerns.push(risk.description.toLowerCase());
    });

    if (scoreBreakdown.rawComponents.traction < 40) {
      concerns.push("limited market traction");
    }
    if (scoreBreakdown.rawComponents.team < 40) {
      concerns.push("team experience gaps");
    }

    // Identify opportunities
    if (analysisResult.marketClaims.opportunities) {
      opportunities.push(...analysisResult.marketClaims.opportunities);
    }

    // Key metrics
    if (analysisResult.extractedMetrics.revenue.arr) {
      keyMetrics.push(`$${(analysisResult.extractedMetrics.revenue.arr / 1_000_000).toFixed(1)}M ARR`);
    }
    if (analysisResult.extractedMetrics.revenue.growthRate) {
      keyMetrics.push(`${analysisResult.extractedMetrics.revenue.growthRate}% growth`);
    }
    if (analysisResult.extractedMetrics.traction.customers) {
      keyMetrics.push(`${analysisResult.extractedMetrics.traction.customers} customers`);
    }

    return { strengths, concerns, opportunities, keyMetrics };
  }

  /**
   * Identify key growth drivers
   */
  private identifyGrowthDrivers(context: RecommendationContext): string[] {
    const { analysisResult, scoreBreakdown } = context;
    const drivers: string[] = [];

    // Market-driven growth
    if (scoreBreakdown.rawComponents.marketOpportunity >= 60) {
      if (analysisResult.marketClaims.marketGrowthRate && analysisResult.marketClaims.marketGrowthRate >= 20) {
        drivers.push("Market expansion and category growth");
      }
      if (analysisResult.marketClaims.opportunities) {
        drivers.push(...analysisResult.marketClaims.opportunities.slice(0, 2));
      }
    }

    // Product-driven growth
    if (scoreBreakdown.rawComponents.product >= 60) {
      drivers.push("Product innovation and feature expansion");
      if (analysisResult.productProfile?.roadmap) {
        drivers.push("Planned product roadmap execution");
      }
    }

    // Sales and marketing driven growth
    if (analysisResult.extractedMetrics.traction.customerGrowthRate && 
        analysisResult.extractedMetrics.traction.customerGrowthRate >= 20) {
      drivers.push("Customer acquisition and expansion");
    }

    // Geographic expansion
    if (analysisResult.marketClaims.opportunities?.some(opp => 
        opp.toLowerCase().includes('international') || opp.toLowerCase().includes('global'))) {
      drivers.push("International market expansion");
    }

    return drivers.slice(0, 4); // Limit to top 4 drivers
  }

  /**
   * Identify scalability factors
   */
  private identifyScalabilityFactors(context: RecommendationContext): string[] {
    const { analysisResult } = context;
    const factors: string[] = [];

    // Technology scalability
    if (analysisResult.productProfile?.technologyStack?.some(tech => 
        ['cloud', 'microservices', 'API', 'SaaS'].some(scalable => 
          tech.toLowerCase().includes(scalable.toLowerCase())))) {
      factors.push("Cloud-native architecture");
    }

    // Business model scalability
    if (analysisResult.extractedMetrics.revenue.arr) {
      factors.push("Recurring revenue model");
    }

    // Unit economics
    if (analysisResult.extractedMetrics.traction.ltvCacRatio && 
        analysisResult.extractedMetrics.traction.ltvCacRatio >= 3) {
      factors.push("Favorable unit economics");
    }

    // Network effects
    if (analysisResult.competitiveAnalysis?.competitiveAdvantages?.some(adv => 
        adv.toLowerCase().includes('network'))) {
      factors.push("Network effects");
    }

    // Operational leverage
    if (analysisResult.extractedMetrics.team.size < 50 && 
        analysisResult.extractedMetrics.revenue.arr && 
        analysisResult.extractedMetrics.revenue.arr > 1_000_000) {
      factors.push("High revenue per employee");
    }

    return factors;
  }

  /**
   * Generate revenue projection
   */
  private generateRevenueProjection(metrics: any): { year1: number; year3: number; year5: number } {
    const currentArr = metrics.revenue.arr || 0;
    const growthRate = metrics.revenue.growthRate || 50;
    
    // Conservative growth rate decay
    const year1Growth = Math.min(growthRate, 200) / 100;
    const year3Growth = Math.min(growthRate * 0.7, 100) / 100;
    const year5Growth = Math.min(growthRate * 0.5, 50) / 100;

    return {
      year1: Math.round(currentArr * (1 + year1Growth)),
      year3: Math.round(currentArr * Math.pow(1 + year3Growth, 3)),
      year5: Math.round(currentArr * Math.pow(1 + year5Growth, 5))
    };
  }

  /**
   * Generate due diligence questions
   */
  private generateDiligenceQuestions(context: RecommendationContext): string[] {
    const { analysisResult, riskFlags, scoreBreakdown } = context;
    const questions: string[] = [];

    // Risk-based questions
    riskFlags.filter(r => r.severity === RiskSeverity.HIGH).forEach(risk => {
      switch (risk.type) {
        case 'FINANCIAL_INCONSISTENCY':
          questions.push("Can you provide detailed financial statements and explain any metric discrepancies?");
          break;
        case 'MARKET_SIZE_CONCERN':
          questions.push("What is your methodology for calculating TAM/SAM and market size assumptions?");
          break;
        case 'COMPETITIVE_THREAT':
          questions.push("How do you plan to defend against competitive threats and maintain market position?");
          break;
        default:
          questions.push(`Please address: ${risk.description}`);
      }
    });

    // Component-specific questions based on low scores
    if (scoreBreakdown.rawComponents.traction < 50) {
      questions.push("What are your customer acquisition strategies and unit economics?");
      questions.push("Can you provide detailed cohort analysis and retention metrics?");
    }

    if (scoreBreakdown.rawComponents.team < 50) {
      questions.push("What are your plans for key hires and team scaling?");
      questions.push("How do you plan to retain key talent and maintain culture?");
    }

    if (scoreBreakdown.rawComponents.product < 50) {
      questions.push("What is your product development roadmap and competitive differentiation?");
      questions.push("How do you plan to maintain product-market fit as you scale?");
    }

    // Standard due diligence questions
    questions.push("What are your key assumptions for the next 18-24 months?");
    questions.push("How will you use the funding and what are the key milestones?");
    questions.push("What are the biggest risks to achieving your projections?");

    return questions.slice(0, 8); // Limit to 8 questions
  }

  /**
   * Generate suggested terms
   */
  private generateSuggestedTerms(context: RecommendationContext): string[] {
    const { scoreBreakdown, riskFlags } = context;
    const terms: string[] = [];

    // Board seat based on check size and risk
    if (scoreBreakdown.totalScore >= 70) {
      terms.push("Board observer rights minimum");
    } else {
      terms.push("Board seat recommended");
    }

    // Information rights
    terms.push("Monthly financial reporting");
    terms.push("Quarterly business reviews");

    // Protection based on risks
    const highRisks = riskFlags.filter(r => r.severity === RiskSeverity.HIGH);
    if (highRisks.length > 0) {
      terms.push("Enhanced information rights");
      terms.push("Milestone-based funding tranches");
    }

    // Anti-dilution
    if (scoreBreakdown.totalScore >= 60) {
      terms.push("Weighted average anti-dilution");
    } else {
      terms.push("Full ratchet anti-dilution");
    }

    return terms;
  }

  /**
   * Generate follow-up actions
   */
  private generateFollowUpActions(context: RecommendationContext): string[] {
    const { riskFlags, scoreBreakdown } = context;
    const actions: string[] = [];

    // Risk mitigation actions
    riskFlags.filter(r => r.severity === RiskSeverity.HIGH).forEach(risk => {
      if (risk.suggestedMitigation) {
        actions.push(risk.suggestedMitigation);
      }
    });

    // Standard actions based on score
    if (scoreBreakdown.totalScore >= 65) {
      actions.push("Schedule management presentation");
      actions.push("Conduct customer reference calls");
    } else {
      actions.push("Request additional financial documentation");
      actions.push("Conduct deeper technical due diligence");
    }

    actions.push("Verify key assumptions with third-party sources");
    actions.push("Review competitive landscape analysis");

    return actions.slice(0, 6);
  }

  /**
   * Helper methods
   */
  private calculateOverallRiskScore(riskFlags: RiskFlag[]): number {
    if (riskFlags.length === 0) return 0;
    
    const riskWeights = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const totalWeight = riskFlags.reduce((sum, risk) => 
      sum + (riskWeights[risk.severity] || 1), 0);
    
    return Math.min(totalWeight * 10, 100);
  }

  private generateRiskMitigationPlan(riskFlags: RiskFlag[]): string[] {
    return riskFlags
      .filter(r => r.suggestedMitigation)
      .map(r => r.suggestedMitigation)
      .slice(0, 5);
  }

  private getTopScoringComponent(scoreBreakdown: ScoreBreakdown): string {
    const components = scoreBreakdown.rawComponents;
    return Object.entries(components).reduce((a, b) => 
      components[a[0] as keyof typeof components] > components[b[0] as keyof typeof components] ? a : b)[0];
  }

  private generateUpsideSummary(context: RecommendationContext, keyDrivers: string[]): string {
    const { analysisResult } = context;
    let summary = `Strong upside potential driven by `;
    
    if (keyDrivers.length > 0) {
      summary += keyDrivers.slice(0, 2).join(' and ');
    } else {
      summary += "market opportunity and execution capability";
    }
    
    if (analysisResult.marketClaims.tam && analysisResult.marketClaims.tam >= 1_000_000_000) {
      summary += ` in a large addressable market`;
    }
    
    summary += ".";
    return summary;
  }

  private generateGrowthTimeline(context: RecommendationContext): string {
    const { analysisResult } = context;
    const stage = analysisResult.companyProfile.stage;
    
    switch (stage) {
      case 'SEED':
        return "12-18 months to Series A readiness with product-market fit validation";
      case 'SERIES_A':
        return "18-24 months to Series B with scaled go-to-market and proven unit economics";
      case 'SERIES_B':
        return "24-36 months to growth stage with market leadership and expansion";
      default:
        return "18-24 months to next major milestone with continued execution";
    }
  }

  private generateMarketExpansionOpportunity(analysisResult: AnalysisResult): string {
    if (analysisResult.marketClaims.opportunities) {
      const expansionOpps = analysisResult.marketClaims.opportunities
        .filter(opp => opp.toLowerCase().includes('expansion') || 
                      opp.toLowerCase().includes('international') ||
                      opp.toLowerCase().includes('market'));
      
      if (expansionOpps.length > 0) {
        return expansionOpps[0];
      }
    }
    
    return "Geographic and vertical market expansion opportunities";
  }

  private suggestCheckSize(context: RecommendationContext): string {
    const { analysisResult, scoreBreakdown } = context;
    const currentAsk = analysisResult.extractedMetrics.funding.currentAsk || 10_000_000;
    
    let suggestedPercentage: number;
    
    if (scoreBreakdown.totalScore >= 80) {
      suggestedPercentage = 0.25; // 25% of round
    } else if (scoreBreakdown.totalScore >= 65) {
      suggestedPercentage = 0.20; // 20% of round
    } else if (scoreBreakdown.totalScore >= 50) {
      suggestedPercentage = 0.15; // 15% of round
    } else {
      suggestedPercentage = 0.10; // 10% of round
    }
    
    const suggestedAmount = currentAsk * suggestedPercentage;
    return `$${(suggestedAmount / 1_000_000).toFixed(1)}M (${(suggestedPercentage * 100).toFixed(0)}% of round)`;
  }

  private suggestValuationCap(context: RecommendationContext): string {
    const { analysisResult, scoreBreakdown } = context;
    const arr = analysisResult.extractedMetrics.revenue.arr || 1_000_000;
    const stage = analysisResult.companyProfile.stage;
    
    let multiples = RecommendationEngine.VALUATION_MULTIPLES.GROWTH_STAGE;
    
    if (stage === 'SEED' || stage === 'PRE_SEED') {
      multiples = RecommendationEngine.VALUATION_MULTIPLES.EARLY_STAGE;
    } else if (stage === 'SERIES_C' || stage === 'SERIES_D') {
      multiples = RecommendationEngine.VALUATION_MULTIPLES.MATURE_STAGE;
    }
    
    // Adjust multiples based on score
    const scoreMultiplier = scoreBreakdown.totalScore / 70; // Normalize around 70
    const adjustedMin = multiples.min * scoreMultiplier;
    const adjustedMax = multiples.max * scoreMultiplier;
    
    const minValuation = arr * adjustedMin;
    const maxValuation = arr * adjustedMax;
    
    return `$${(minValuation / 1_000_000).toFixed(0)}M - $${(maxValuation / 1_000_000).toFixed(0)}M`;
  }

  private suggestDecisionTimeline(context: RecommendationContext): string {
    const { scoreBreakdown, riskFlags } = context;
    const highRisks = riskFlags.filter(r => r.severity === RiskSeverity.HIGH).length;
    
    if (scoreBreakdown.totalScore >= 75 && highRisks === 0) {
      return "2-3 weeks (fast track)";
    } else if (scoreBreakdown.totalScore >= 60 && highRisks <= 1) {
      return "4-6 weeks (standard process)";
    } else {
      return "6-8 weeks (extended due diligence)";
    }
  }
}