// Signal score calculation engine with weighted metric evaluation
import { AnalysisWeightings } from '../../models/DealMemo.js';
import { InvestmentMetrics } from '../../models/InvestmentMetrics.js';
import { AnalysisResult, MarketClaims, TeamProfile, CompetitiveAnalysis } from '../../models/AnalysisResult.js';
import { BenchmarkData, PercentileRankings } from '../../models/BenchmarkData.js';

export interface ScoreComponents {
  marketOpportunity: number;
  team: number;
  traction: number;
  product: number;
  competitivePosition: number;
}

export interface ScoreBreakdown {
  totalScore: number;
  weightedComponents: ScoreComponents;
  rawComponents: ScoreComponents;
  weightings: AnalysisWeightings;
  confidence: number;
  methodology: string;
}

export interface ScoringContext {
  analysisResult: AnalysisResult;
  benchmarkData?: BenchmarkData;
  percentileRankings?: PercentileRankings;
}

export class ScoreCalculator {
  private static readonly MAX_SCORE = 100;
  private static readonly MIN_SCORE = 0;
  private static readonly DEFAULT_CONFIDENCE = 0.7;

  /**
   * Calculate overall signal score with weighted components
   */
  calculateSignalScore(
    context: ScoringContext,
    weightings: AnalysisWeightings
  ): ScoreBreakdown {
    const rawComponents = this.calculateRawComponents(context);
    const weightedComponents = this.applyWeightings(rawComponents, weightings);
    const totalScore = this.calculateTotalScore(weightedComponents);
    const confidence = this.calculateConfidence(context, rawComponents);

    return {
      totalScore: this.normalizeScore(totalScore),
      weightedComponents,
      rawComponents,
      weightings,
      confidence,
      methodology: this.getMethodologyDescription()
    };
  }

  /**
   * Calculate raw component scores (0-100 scale)
   */
  private calculateRawComponents(context: ScoringContext): ScoreComponents {
    const { analysisResult, benchmarkData, percentileRankings } = context;

    return {
      marketOpportunity: this.calculateMarketOpportunityScore(
        analysisResult.marketClaims,
        benchmarkData
      ),
      team: this.calculateTeamScore(
        analysisResult.teamAssessment,
        percentileRankings
      ),
      traction: this.calculateTractionScore(
        analysisResult.extractedMetrics,
        percentileRankings
      ),
      product: this.calculateProductScore(
        analysisResult.productProfile,
        analysisResult.extractedMetrics
      ),
      competitivePosition: this.calculateCompetitivePositionScore(
        analysisResult.competitiveAnalysis,
        analysisResult.marketClaims
      )
    };
  }

  /**
   * Calculate market opportunity score based on TAM, growth rate, and market dynamics
   */
  private calculateMarketOpportunityScore(
    marketClaims: MarketClaims,
    benchmarkData?: BenchmarkData
  ): number {
    let score = 0;
    let factors = 0;

    // TAM size evaluation (0-30 points)
    if (marketClaims.tam) {
      if (marketClaims.tam >= 10_000_000_000) { // $10B+
        score += 30;
      } else if (marketClaims.tam >= 1_000_000_000) { // $1B+
        score += 25;
      } else if (marketClaims.tam >= 100_000_000) { // $100M+
        score += 20;
      } else if (marketClaims.tam >= 10_000_000) { // $10M+
        score += 10;
      } else {
        score += 5;
      }
      factors++;
    }

    // Market growth rate (0-25 points)
    if (marketClaims.marketGrowthRate) {
      if (marketClaims.marketGrowthRate >= 30) {
        score += 25;
      } else if (marketClaims.marketGrowthRate >= 20) {
        score += 20;
      } else if (marketClaims.marketGrowthRate >= 10) {
        score += 15;
      } else if (marketClaims.marketGrowthRate >= 5) {
        score += 10;
      } else {
        score += 5;
      }
      factors++;
    }

    // Market trends and opportunities (0-20 points)
    if (marketClaims.marketTrends && marketClaims.opportunities) {
      const trendScore = Math.min(marketClaims.marketTrends.length * 3, 10);
      const opportunityScore = Math.min(marketClaims.opportunities.length * 2, 10);
      score += trendScore + opportunityScore;
      factors++;
    }

    // Competitive landscape density (0-15 points)
    if (marketClaims.competitorCount !== undefined) {
      if (marketClaims.competitorCount <= 3) {
        score += 15; // Blue ocean
      } else if (marketClaims.competitorCount <= 10) {
        score += 10; // Moderate competition
      } else if (marketClaims.competitorCount <= 20) {
        score += 5; // Crowded market
      } else {
        score += 2; // Highly saturated
      }
      factors++;
    }

    // Barriers to entry (0-10 points)
    if (marketClaims.barriers) {
      score += Math.min(marketClaims.barriers.length * 2, 10);
      factors++;
    }

    return factors > 0 ? Math.min(score, 100) : 50; // Default to neutral
  }

  /**
   * Calculate team score based on experience, domain expertise, and track record
   */
  private calculateTeamScore(
    teamProfile: TeamProfile,
    percentileRankings?: PercentileRankings
  ): number {
    let score = 0;
    let factors = 0;

    // Founder experience (0-30 points)
    if (teamProfile.founders.length > 0) {
      const avgExperience = teamProfile.averageExperience || 0;
      if (avgExperience >= 15) {
        score += 30;
      } else if (avgExperience >= 10) {
        score += 25;
      } else if (avgExperience >= 5) {
        score += 20;
      } else if (avgExperience >= 2) {
        score += 15;
      } else {
        score += 10;
      }
      factors++;
    }

    // Domain expertise (0-25 points)
    if (teamProfile.domainExpertise && teamProfile.domainExpertise.length > 0) {
      score += Math.min(teamProfile.domainExpertise.length * 5, 25);
      factors++;
    }

    // Previous exits (0-20 points)
    if (teamProfile.previousExits !== undefined) {
      if (teamProfile.previousExits >= 2) {
        score += 20;
      } else if (teamProfile.previousExits >= 1) {
        score += 15;
      } else {
        score += 5; // First-time founders
      }
      factors++;
    }

    // Education background (0-15 points)
    if (teamProfile.educationBackground) {
      const topTierEducation = teamProfile.educationBackground.some(edu => 
        ['Stanford', 'MIT', 'Harvard', 'Berkeley', 'CMU'].some(school => 
          edu.toLowerCase().includes(school.toLowerCase())
        )
      );
      score += topTierEducation ? 15 : 10;
      factors++;
    }

    // Network strength (0-10 points)
    if (teamProfile.networkStrength !== undefined) {
      score += teamProfile.networkStrength * 10;
      factors++;
    }

    return factors > 0 ? Math.min(score, 100) : 50;
  }

  /**
   * Calculate traction score based on growth metrics and customer adoption
   */
  private calculateTractionScore(
    metrics: InvestmentMetrics,
    percentileRankings?: PercentileRankings
  ): number {
    let score = 0;
    let factors = 0;

    // Revenue growth (0-35 points)
    if (metrics.revenue.growthRate !== undefined) {
      const growthRate = metrics.revenue.growthRate;
      if (growthRate >= 300) { // 3x+ growth
        score += 35;
      } else if (growthRate >= 200) { // 2x+ growth
        score += 30;
      } else if (growthRate >= 100) { // 100%+ growth
        score += 25;
      } else if (growthRate >= 50) { // 50%+ growth
        score += 20;
      } else if (growthRate >= 20) { // 20%+ growth
        score += 15;
      } else if (growthRate >= 0) { // Positive growth
        score += 10;
      } else {
        score += 0; // Negative growth
      }
      factors++;
    }

    // Revenue scale (0-20 points)
    if (metrics.revenue.arr !== undefined) {
      const arr = metrics.revenue.arr;
      if (arr >= 10_000_000) { // $10M+ ARR
        score += 20;
      } else if (arr >= 1_000_000) { // $1M+ ARR
        score += 18;
      } else if (arr >= 100_000) { // $100K+ ARR
        score += 15;
      } else if (arr >= 10_000) { // $10K+ ARR
        score += 10;
      } else if (arr > 0) {
        score += 5;
      }
      factors++;
    }

    // Customer metrics (0-20 points)
    if (metrics.traction.customers !== undefined && metrics.traction.customerGrowthRate !== undefined) {
      const customerScore = Math.min(Math.log10(metrics.traction.customers) * 3, 10);
      const growthScore = Math.min(metrics.traction.customerGrowthRate / 10, 10);
      score += customerScore + growthScore;
      factors++;
    }

    // Unit economics (0-15 points)
    if (metrics.traction.ltvCacRatio !== undefined) {
      const ratio = metrics.traction.ltvCacRatio;
      if (ratio >= 5) {
        score += 15;
      } else if (ratio >= 3) {
        score += 12;
      } else if (ratio >= 2) {
        score += 8;
      } else if (ratio >= 1) {
        score += 5;
      } else {
        score += 0;
      }
      factors++;
    }

    // Retention metrics (0-10 points)
    if (metrics.traction.churnRate !== undefined) {
      const churnRate = metrics.traction.churnRate;
      if (churnRate <= 2) { // Monthly churn <= 2%
        score += 10;
      } else if (churnRate <= 5) {
        score += 8;
      } else if (churnRate <= 10) {
        score += 5;
      } else if (churnRate <= 20) {
        score += 2;
      } else {
        score += 0;
      }
      factors++;
    }

    return factors > 0 ? Math.min(score, 100) : 30; // Lower default for traction
  }

  /**
   * Calculate product score based on development stage and differentiation
   */
  private calculateProductScore(
    productProfile: any,
    metrics: InvestmentMetrics
  ): number {
    let score = 0;
    let factors = 0;

    // Product stage (0-30 points)
    if (productProfile?.stage) {
      switch (productProfile.stage) {
        case 'scale':
          score += 30;
          break;
        case 'production':
          score += 25;
          break;
        case 'beta':
          score += 20;
          break;
        case 'mvp':
          score += 15;
          break;
        case 'concept':
          score += 5;
          break;
      }
      factors++;
    }

    // Product differentiation (0-25 points)
    if (productProfile?.differentiators) {
      score += Math.min(productProfile.differentiators.length * 5, 25);
      factors++;
    }

    // Intellectual property (0-20 points)
    if (productProfile?.intellectualProperty) {
      score += Math.min(productProfile.intellectualProperty.length * 4, 20);
      factors++;
    }

    // Technology stack modernity (0-15 points)
    if (productProfile?.technologyStack) {
      const modernTech = ['AI', 'ML', 'blockchain', 'cloud', 'microservices', 'API'];
      const modernCount = productProfile.technologyStack.filter((tech: string) =>
        modernTech.some(modern => tech.toLowerCase().includes(modern.toLowerCase()))
      ).length;
      score += Math.min(modernCount * 3, 15);
      factors++;
    }

    // Product-market fit indicators (0-10 points)
    if (metrics.traction.nps !== undefined) {
      const nps = metrics.traction.nps;
      if (nps >= 70) {
        score += 10;
      } else if (nps >= 50) {
        score += 8;
      } else if (nps >= 30) {
        score += 6;
      } else if (nps >= 0) {
        score += 3;
      } else {
        score += 0;
      }
      factors++;
    }

    return factors > 0 ? Math.min(score, 100) : 40; // Neutral default
  }

  /**
   * Calculate competitive position score based on moat strength and market position
   */
  private calculateCompetitivePositionScore(
    competitiveAnalysis: CompetitiveAnalysis | undefined,
    marketClaims: MarketClaims
  ): number {
    let score = 0;
    let factors = 0;

    // Moat strength (0-40 points)
    if (competitiveAnalysis?.moatStrength !== undefined) {
      score += competitiveAnalysis.moatStrength * 40;
      factors++;
    }

    // Competitive advantages (0-30 points)
    if (competitiveAnalysis?.competitiveAdvantages) {
      score += Math.min(competitiveAnalysis.competitiveAdvantages.length * 6, 30);
      factors++;
    }

    // Market position (0-20 points)
    if (competitiveAnalysis?.marketPosition) {
      switch (competitiveAnalysis.marketPosition.toLowerCase()) {
        case 'leader':
          score += 20;
          break;
        case 'challenger':
          score += 15;
          break;
        case 'follower':
          score += 10;
          break;
        case 'niche':
          score += 12;
          break;
        default:
          score += 8;
      }
      factors++;
    }

    // Threat assessment (0-10 points, inverted)
    if (competitiveAnalysis?.threats) {
      const threatPenalty = Math.min(competitiveAnalysis.threats.length * 2, 10);
      score += 10 - threatPenalty;
      factors++;
    }

    return factors > 0 ? Math.min(score, 100) : 45; // Slightly below neutral
  }

  /**
   * Apply weightings to raw component scores
   */
  private applyWeightings(
    rawComponents: ScoreComponents,
    weightings: AnalysisWeightings
  ): ScoreComponents {
    return {
      marketOpportunity: (rawComponents.marketOpportunity * weightings.marketOpportunity) / 100,
      team: (rawComponents.team * weightings.team) / 100,
      traction: (rawComponents.traction * weightings.traction) / 100,
      product: (rawComponents.product * weightings.product) / 100,
      competitivePosition: (rawComponents.competitivePosition * weightings.competitivePosition) / 100
    };
  }

  /**
   * Calculate total weighted score
   */
  private calculateTotalScore(weightedComponents: ScoreComponents): number {
    return Object.values(weightedComponents).reduce((sum, score) => sum + score, 0);
  }

  /**
   * Calculate confidence score based on data availability and quality
   */
  private calculateConfidence(
    context: ScoringContext,
    rawComponents: ScoreComponents
  ): number {
    let confidence = ScoreCalculator.DEFAULT_CONFIDENCE;
    const { analysisResult } = context;

    // Boost confidence for complete data
    if (analysisResult.extractedMetrics.revenue.arr && 
        analysisResult.extractedMetrics.revenue.growthRate) {
      confidence += 0.1;
    }

    if (analysisResult.teamAssessment.founders.length > 0 && 
        analysisResult.teamAssessment.averageExperience) {
      confidence += 0.1;
    }

    if (analysisResult.marketClaims.tam && 
        analysisResult.marketClaims.marketGrowthRate) {
      confidence += 0.1;
    }

    // Reduce confidence for missing critical data
    if (!analysisResult.extractedMetrics.revenue.arr) {
      confidence -= 0.15;
    }

    if (analysisResult.teamAssessment.founders.length === 0) {
      confidence -= 0.1;
    }

    // Factor in analysis confidence
    confidence = (confidence + analysisResult.confidence) / 2;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Normalize score to 0-100 range
   */
  private normalizeScore(score: number): number {
    return Math.max(
      ScoreCalculator.MIN_SCORE,
      Math.min(ScoreCalculator.MAX_SCORE, Math.round(score * 100) / 100)
    );
  }

  /**
   * Get methodology description
   */
  private getMethodologyDescription(): string {
    return `Signal score calculated using weighted evaluation across five key dimensions: 
    Market Opportunity (TAM, growth rate, competitive density), 
    Team (experience, domain expertise, track record), 
    Traction (revenue growth, customer metrics, unit economics), 
    Product (development stage, differentiation, IP), and 
    Competitive Position (moat strength, market position, advantages). 
    Each dimension scored 0-100, then weighted according to investment strategy profile.`;
  }

  /**
   * Validate scoring inputs
   */
  validateScoringInputs(context: ScoringContext, weightings: AnalysisWeightings): string[] {
    const errors: string[] = [];

    if (!context.analysisResult) {
      errors.push('Analysis result is required for scoring');
    }

    if (!weightings) {
      errors.push('Weightings are required for scoring');
    }

    const totalWeight = Object.values(weightings).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 100) > 1) {
      errors.push(`Weightings must sum to 100%, got ${totalWeight}%`);
    }

    return errors;
  }
}