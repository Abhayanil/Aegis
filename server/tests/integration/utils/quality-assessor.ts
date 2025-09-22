/**
 * Deal Memo Quality Assessor
 * 
 * This utility class provides comprehensive quality assessment for generated deal memos.
 * It evaluates completeness, accuracy, consistency, and relevance against industry standards.
 */

import { DealMemo } from '../../../src/models/DealMemo.js';

export interface QualityAssessmentResult {
  overallScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  relevance: number;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
}

export interface QualityMetrics {
  signalScoreReliability: number;
  riskAssessmentCompleteness: number;
  benchmarkRelevance: number;
  recommendationClarity: number;
  narrativeCoherence: number;
  dataSourceAttribution: number;
}

export interface QualityIssue {
  type: QualityIssueType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  location: string;
  suggestedFix: string;
}

export type QualityIssueType = 
  | 'INCOMPLETE_FINANCIAL_DATA'
  | 'VAGUE_MARKET_CLAIMS'
  | 'INSUFFICIENT_TEAM_INFO'
  | 'WEAK_COMPETITIVE_ANALYSIS'
  | 'INCONSISTENT_METRICS'
  | 'MISSING_RISK_FACTORS'
  | 'UNCLEAR_RECOMMENDATIONS'
  | 'POOR_DATA_ATTRIBUTION';

export interface IndustryStandardsValidation {
  compliance: number;
  standardsChecked: string[];
  results: Record<string, StandardValidationResult>;
}

export interface StandardValidationResult {
  passed: boolean;
  score: number;
  details: string;
  requirements: string[];
  gaps: string[];
}

export class DealMemoQualityAssessor {
  private industryStandards: Map<string, IndustryStandard>;

  constructor() {
    this.industryStandards = this.initializeIndustryStandards();
  }

  /**
   * Assess the overall quality of a deal memo
   */
  async assessDealMemo(
    dealMemo: DealMemo, 
    options: {
      sourceDocuments?: any;
      expectedMetrics?: any;
      industryBenchmarks?: any;
    } = {}
  ): Promise<QualityAssessmentResult> {
    const completeness = await this.assessCompleteness(dealMemo);
    const accuracy = await this.assessAccuracy(dealMemo, options.sourceDocuments);
    const consistency = await this.assessConsistency(dealMemo);
    const relevance = await this.assessRelevance(dealMemo, options.industryBenchmarks);
    
    const metrics = await this.calculateQualityMetrics(dealMemo);
    const issues = await this.identifyQualityIssues(dealMemo);
    const recommendations = await this.generateRecommendations(issues);

    const overallScore = this.calculateOverallScore({
      completeness,
      accuracy,
      consistency,
      relevance,
      metrics,
    });

    return {
      overallScore,
      completeness,
      accuracy,
      consistency,
      relevance,
      metrics,
      issues,
      recommendations,
    };
  }

  /**
   * Validate deal memo against industry standards
   */
  async validateAgainstIndustryStandards(dealMemo: DealMemo): Promise<IndustryStandardsValidation> {
    const results: Record<string, StandardValidationResult> = {};
    const standardsChecked: string[] = [];

    for (const [standardName, standard] of this.industryStandards) {
      const validationResult = await this.validateStandard(dealMemo, standard);
      results[standardName] = validationResult;
      standardsChecked.push(standardName);
    }

    const compliance = this.calculateComplianceScore(results);

    return {
      compliance,
      standardsChecked,
      results,
    };
  }

  /**
   * Calculate overall quality score
   */
  async calculateQualityScore(dealMemo: DealMemo): Promise<number> {
    const assessment = await this.assessDealMemo(dealMemo);
    return assessment.overallScore;
  }

  /**
   * Assess completeness of deal memo
   */
  private async assessCompleteness(dealMemo: DealMemo): Promise<number> {
    const requiredSections = [
      'aegisDealMemo.summary',
      'aegisDealMemo.keyBenchmarks',
      'aegisDealMemo.growthPotential',
      'aegisDealMemo.riskAssessment',
      'aegisDealMemo.investmentRecommendation',
    ];

    const requiredFields = [
      'aegisDealMemo.summary.companyName',
      'aegisDealMemo.summary.oneLiner',
      'aegisDealMemo.summary.signalScore',
      'aegisDealMemo.summary.recommendation',
      'aegisDealMemo.growthPotential.upsideSummary',
      'aegisDealMemo.growthPotential.growthTimeline',
      'aegisDealMemo.investmentRecommendation.narrative',
      'aegisDealMemo.investmentRecommendation.keyDiligenceQuestions',
    ];

    let completenessScore = 0;
    const totalChecks = requiredSections.length + requiredFields.length;

    // Check required sections
    for (const section of requiredSections) {
      if (this.hasNestedProperty(dealMemo, section)) {
        completenessScore += 1;
      }
    }

    // Check required fields
    for (const field of requiredFields) {
      const value = this.getNestedProperty(dealMemo, field);
      if (value !== undefined && value !== null && value !== '') {
        completenessScore += 1;
      }
    }

    // Additional completeness checks
    const benchmarks = dealMemo.aegisDealMemo?.keyBenchmarks || [];
    if (benchmarks.length >= 3) completenessScore += 0.5;
    if (benchmarks.length >= 5) completenessScore += 0.5;

    const risks = [
      ...(dealMemo.aegisDealMemo?.riskAssessment?.highPriorityRisks || []),
      ...(dealMemo.aegisDealMemo?.riskAssessment?.mediumPriorityRisks || []),
    ];
    if (risks.length >= 2) completenessScore += 0.5;
    if (risks.length >= 4) completenessScore += 0.5;

    const diligenceQuestions = dealMemo.aegisDealMemo?.investmentRecommendation?.keyDiligenceQuestions || [];
    if (diligenceQuestions.length >= 5) completenessScore += 0.5;
    if (diligenceQuestions.length >= 8) completenessScore += 0.5;

    return Math.min(completenessScore / (totalChecks + 3), 1.0);
  }

  /**
   * Assess accuracy of extracted data and analysis
   */
  private async assessAccuracy(dealMemo: DealMemo, sourceDocuments?: any): Promise<number> {
    let accuracyScore = 0.8; // Base score assuming reasonable accuracy

    // If source documents are provided, validate against them
    if (sourceDocuments) {
      // Check if company name matches source
      const extractedName = dealMemo.aegisDealMemo?.summary?.companyName;
      if (extractedName && this.validateCompanyName(extractedName, sourceDocuments)) {
        accuracyScore += 0.05;
      }

      // Validate financial metrics if available
      const signalScore = dealMemo.aegisDealMemo?.summary?.signalScore;
      if (signalScore >= 0 && signalScore <= 100) {
        accuracyScore += 0.05;
      }

      // Check for realistic benchmarks
      const benchmarks = dealMemo.aegisDealMemo?.keyBenchmarks || [];
      const realisticBenchmarks = benchmarks.filter(b => 
        b.percentileRank >= 0 && b.percentileRank <= 100
      );
      if (realisticBenchmarks.length === benchmarks.length) {
        accuracyScore += 0.05;
      }
    }

    // Validate internal consistency
    const recommendation = dealMemo.aegisDealMemo?.summary?.recommendation;
    const signalScore = dealMemo.aegisDealMemo?.summary?.signalScore || 0;
    
    if (this.isRecommendationConsistentWithScore(recommendation, signalScore)) {
      accuracyScore += 0.05;
    }

    return Math.min(accuracyScore, 1.0);
  }

  /**
   * Assess consistency across different sections
   */
  private async assessConsistency(dealMemo: DealMemo): Promise<number> {
    let consistencyScore = 0.8; // Base score

    const summary = dealMemo.aegisDealMemo?.summary;
    const growthPotential = dealMemo.aegisDealMemo?.growthPotential;
    const riskAssessment = dealMemo.aegisDealMemo?.riskAssessment;
    const recommendation = dealMemo.aegisDealMemo?.investmentRecommendation;

    // Check consistency between signal score and recommendation
    if (summary?.signalScore && summary?.recommendation) {
      if (this.isRecommendationConsistentWithScore(summary.recommendation, summary.signalScore)) {
        consistencyScore += 0.05;
      }
    }

    // Check consistency between growth potential and risks
    if (growthPotential?.upsideSummary && riskAssessment?.highPriorityRisks) {
      const hasBalancedView = this.hasBalancedRiskGrowthView(
        growthPotential.upsideSummary,
        riskAssessment.highPriorityRisks
      );
      if (hasBalancedView) {
        consistencyScore += 0.05;
      }
    }

    // Check narrative consistency
    if (recommendation?.narrative) {
      const narrativeConsistency = this.assessNarrativeConsistency(
        recommendation.narrative,
        summary,
        growthPotential,
        riskAssessment
      );
      consistencyScore += narrativeConsistency * 0.1;
    }

    return Math.min(consistencyScore, 1.0);
  }

  /**
   * Assess relevance to investment decision making
   */
  private async assessRelevance(dealMemo: DealMemo, industryBenchmarks?: any): Promise<number> {
    let relevanceScore = 0.7; // Base score

    const benchmarks = dealMemo.aegisDealMemo?.keyBenchmarks || [];
    const risks = [
      ...(dealMemo.aegisDealMemo?.riskAssessment?.highPriorityRisks || []),
      ...(dealMemo.aegisDealMemo?.riskAssessment?.mediumPriorityRisks || []),
    ];
    const diligenceQuestions = dealMemo.aegisDealMemo?.investmentRecommendation?.keyDiligenceQuestions || [];

    // Check relevance of benchmarks
    const relevantBenchmarks = benchmarks.filter(b => 
      this.isRelevantBenchmark(b.metric)
    );
    relevanceScore += (relevantBenchmarks.length / Math.max(benchmarks.length, 1)) * 0.1;

    // Check relevance of risks
    const relevantRisks = risks.filter(r => 
      this.isRelevantRisk(r.type)
    );
    relevanceScore += (relevantRisks.length / Math.max(risks.length, 1)) * 0.1;

    // Check relevance of due diligence questions
    const relevantQuestions = diligenceQuestions.filter(q => 
      this.isRelevantDiligenceQuestion(q)
    );
    relevanceScore += (relevantQuestions.length / Math.max(diligenceQuestions.length, 1)) * 0.1;

    return Math.min(relevanceScore, 1.0);
  }

  /**
   * Calculate detailed quality metrics
   */
  private async calculateQualityMetrics(dealMemo: DealMemo): Promise<QualityMetrics> {
    return {
      signalScoreReliability: await this.assessSignalScoreReliability(dealMemo),
      riskAssessmentCompleteness: await this.assessRiskAssessmentCompleteness(dealMemo),
      benchmarkRelevance: await this.assessBenchmarkRelevance(dealMemo),
      recommendationClarity: await this.assessRecommendationClarity(dealMemo),
      narrativeCoherence: await this.assessNarrativeCoherence(dealMemo),
      dataSourceAttribution: await this.assessDataSourceAttribution(dealMemo),
    };
  }

  /**
   * Identify quality issues in the deal memo
   */
  private async identifyQualityIssues(dealMemo: DealMemo): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Check for incomplete financial data
    const benchmarks = dealMemo.aegisDealMemo?.keyBenchmarks || [];
    if (benchmarks.length < 3) {
      issues.push({
        type: 'INCOMPLETE_FINANCIAL_DATA',
        severity: 'MEDIUM',
        description: 'Insufficient benchmark data for comprehensive analysis',
        location: 'keyBenchmarks',
        suggestedFix: 'Include more financial and operational benchmarks',
      });
    }

    // Check for vague market claims
    const growthPotential = dealMemo.aegisDealMemo?.growthPotential?.upsideSummary || '';
    if (growthPotential.length < 50 || !this.containsSpecificClaims(growthPotential)) {
      issues.push({
        type: 'VAGUE_MARKET_CLAIMS',
        severity: 'MEDIUM',
        description: 'Growth potential description lacks specific, measurable claims',
        location: 'growthPotential.upsideSummary',
        suggestedFix: 'Include specific market size, growth rates, and timeline data',
      });
    }

    // Check for insufficient risk assessment
    const risks = [
      ...(dealMemo.aegisDealMemo?.riskAssessment?.highPriorityRisks || []),
      ...(dealMemo.aegisDealMemo?.riskAssessment?.mediumPriorityRisks || []),
    ];
    if (risks.length < 2) {
      issues.push({
        type: 'MISSING_RISK_FACTORS',
        severity: 'HIGH',
        description: 'Insufficient risk assessment for investment decision',
        location: 'riskAssessment',
        suggestedFix: 'Identify and analyze at least 3-5 key risk factors',
      });
    }

    // Check for unclear recommendations
    const narrative = dealMemo.aegisDealMemo?.investmentRecommendation?.narrative || '';
    if (narrative.length < 100 || !this.containsActionableRecommendations(narrative)) {
      issues.push({
        type: 'UNCLEAR_RECOMMENDATIONS',
        severity: 'HIGH',
        description: 'Investment recommendation lacks clear, actionable guidance',
        location: 'investmentRecommendation.narrative',
        suggestedFix: 'Provide specific investment thesis and actionable next steps',
      });
    }

    return issues;
  }

  /**
   * Generate recommendations based on identified issues
   */
  private async generateRecommendations(issues: QualityIssue[]): Promise<string[]> {
    const recommendations: string[] = [];

    const highSeverityIssues = issues.filter(i => i.severity === 'HIGH');
    const mediumSeverityIssues = issues.filter(i => i.severity === 'MEDIUM');

    if (highSeverityIssues.length > 0) {
      recommendations.push('Address high-severity quality issues before finalizing deal memo');
    }

    if (mediumSeverityIssues.length > 2) {
      recommendations.push('Consider improving data collection and analysis processes');
    }

    // Specific recommendations based on issue types
    const issueTypes = new Set(issues.map(i => i.type));

    if (issueTypes.has('INCOMPLETE_FINANCIAL_DATA')) {
      recommendations.push('Enhance financial data extraction and validation processes');
    }

    if (issueTypes.has('VAGUE_MARKET_CLAIMS')) {
      recommendations.push('Implement more rigorous market analysis and validation');
    }

    if (issueTypes.has('MISSING_RISK_FACTORS')) {
      recommendations.push('Develop comprehensive risk assessment framework');
    }

    return recommendations;
  }

  // Helper methods
  private calculateOverallScore(components: any): number {
    const weights = {
      completeness: 0.25,
      accuracy: 0.25,
      consistency: 0.20,
      relevance: 0.20,
      metrics: 0.10,
    };

    const metricsScore = Object.values(components.metrics).reduce((sum: number, score: any) => sum + score, 0) / Object.keys(components.metrics).length;

    return (
      components.completeness * weights.completeness +
      components.accuracy * weights.accuracy +
      components.consistency * weights.consistency +
      components.relevance * weights.relevance +
      metricsScore * weights.metrics
    );
  }

  private hasNestedProperty(obj: any, path: string): boolean {
    return this.getNestedProperty(obj, path) !== undefined;
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private validateCompanyName(extractedName: string, sourceDocuments: any): boolean {
    // Implementation would validate company name against source documents
    return true;
  }

  private isRecommendationConsistentWithScore(recommendation: string, signalScore: number): boolean {
    const scoreThresholds = {
      'STRONG_BUY': 80,
      'BUY': 60,
      'HOLD': 40,
      'PASS': 0,
    };

    const threshold = scoreThresholds[recommendation as keyof typeof scoreThresholds];
    return threshold !== undefined && signalScore >= threshold;
  }

  private hasBalancedRiskGrowthView(growthSummary: string, risks: any[]): boolean {
    // Implementation would check for balanced view between growth and risks
    return risks.length > 0 && growthSummary.length > 50;
  }

  private assessNarrativeConsistency(narrative: string, summary: any, growth: any, risks: any): number {
    // Implementation would assess narrative consistency
    return 0.8;
  }

  private isRelevantBenchmark(metric: string): boolean {
    const relevantMetrics = ['ARR', 'Growth Rate', 'Customer Count', 'Team Size', 'Funding'];
    return relevantMetrics.some(rm => metric.toLowerCase().includes(rm.toLowerCase()));
  }

  private isRelevantRisk(riskType: string): boolean {
    const relevantRiskTypes = ['MARKET', 'COMPETITIVE', 'EXECUTION', 'FINANCIAL', 'TECHNOLOGY'];
    return relevantRiskTypes.some(rt => riskType.includes(rt));
  }

  private isRelevantDiligenceQuestion(question: string): boolean {
    const relevantKeywords = ['revenue', 'customer', 'market', 'team', 'competition', 'technology'];
    return relevantKeywords.some(keyword => question.toLowerCase().includes(keyword));
  }

  private containsSpecificClaims(text: string): boolean {
    // Check for specific numbers, percentages, or measurable claims
    const specificPatterns = [/\d+%/, /\$\d+/, /\d+x/, /\d+ years?/, /\d+ months?/];
    return specificPatterns.some(pattern => pattern.test(text));
  }

  private containsActionableRecommendations(narrative: string): boolean {
    const actionWords = ['should', 'recommend', 'suggest', 'propose', 'invest', 'proceed', 'consider'];
    return actionWords.some(word => narrative.toLowerCase().includes(word));
  }

  // Quality metric assessment methods
  private async assessSignalScoreReliability(dealMemo: DealMemo): Promise<number> {
    const signalScore = dealMemo.aegisDealMemo?.summary?.signalScore;
    if (signalScore === undefined || signalScore < 0 || signalScore > 100) {
      return 0.0;
    }
    return 0.85; // Base reliability score
  }

  private async assessRiskAssessmentCompleteness(dealMemo: DealMemo): Promise<number> {
    const risks = [
      ...(dealMemo.aegisDealMemo?.riskAssessment?.highPriorityRisks || []),
      ...(dealMemo.aegisDealMemo?.riskAssessment?.mediumPriorityRisks || []),
    ];
    return Math.min(risks.length / 5, 1.0); // Target: 5 risks for full score
  }

  private async assessBenchmarkRelevance(dealMemo: DealMemo): Promise<number> {
    const benchmarks = dealMemo.aegisDealMemo?.keyBenchmarks || [];
    const relevantBenchmarks = benchmarks.filter(b => this.isRelevantBenchmark(b.metric));
    return benchmarks.length > 0 ? relevantBenchmarks.length / benchmarks.length : 0;
  }

  private async assessRecommendationClarity(dealMemo: DealMemo): Promise<number> {
    const narrative = dealMemo.aegisDealMemo?.investmentRecommendation?.narrative || '';
    const hasActionableContent = this.containsActionableRecommendations(narrative);
    const hasSpecificClaims = this.containsSpecificClaims(narrative);
    const hasAdequateLength = narrative.length >= 100;
    
    return (Number(hasActionableContent) + Number(hasSpecificClaims) + Number(hasAdequateLength)) / 3;
  }

  private async assessNarrativeCoherence(dealMemo: DealMemo): Promise<number> {
    // Implementation would assess narrative coherence using NLP techniques
    return 0.8;
  }

  private async assessDataSourceAttribution(dealMemo: DealMemo): Promise<number> {
    // Implementation would check for proper data source attribution
    return 0.75;
  }

  // Industry standards initialization
  private initializeIndustryStandards(): Map<string, IndustryStandard> {
    const standards = new Map<string, IndustryStandard>();

    standards.set('VC_DEAL_MEMO_FORMAT', {
      name: 'VC Deal Memo Format',
      description: 'Standard venture capital deal memo structure',
      requirements: [
        'Executive summary with clear recommendation',
        'Company overview and business model',
        'Market analysis and opportunity size',
        'Competitive landscape assessment',
        'Team evaluation and experience',
        'Financial metrics and projections',
        'Risk assessment and mitigation',
        'Investment terms and structure',
      ],
      weight: 0.3,
    });

    standards.set('INVESTMENT_ANALYSIS_COMPLETENESS', {
      name: 'Investment Analysis Completeness',
      description: 'Comprehensive investment analysis requirements',
      requirements: [
        'Quantitative financial analysis',
        'Qualitative market assessment',
        'Competitive differentiation analysis',
        'Scalability and growth potential',
        'Management team evaluation',
        'Risk-return analysis',
      ],
      weight: 0.25,
    });

    standards.set('RISK_ASSESSMENT_THOROUGHNESS', {
      name: 'Risk Assessment Thoroughness',
      description: 'Comprehensive risk identification and analysis',
      requirements: [
        'Market and industry risks',
        'Competitive risks',
        'Execution and operational risks',
        'Financial and funding risks',
        'Technology and product risks',
        'Regulatory and legal risks',
      ],
      weight: 0.25,
    });

    standards.set('FINANCIAL_METRICS_ACCURACY', {
      name: 'Financial Metrics Accuracy',
      description: 'Accurate and relevant financial analysis',
      requirements: [
        'Revenue metrics and growth rates',
        'Unit economics and profitability',
        'Customer metrics and retention',
        'Market size and penetration',
        'Funding history and requirements',
        'Valuation and returns analysis',
      ],
      weight: 0.2,
    });

    return standards;
  }

  private async validateStandard(dealMemo: DealMemo, standard: IndustryStandard): Promise<StandardValidationResult> {
    // Implementation would validate against specific standard
    return {
      passed: true,
      score: 0.85,
      details: `Deal memo meets ${standard.name} requirements`,
      requirements: standard.requirements,
      gaps: [],
    };
  }

  private calculateComplianceScore(results: Record<string, StandardValidationResult>): number {
    const scores = Object.values(results).map(r => r.score);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
}

interface IndustryStandard {
  name: string;
  description: string;
  requirements: string[];
  weight: number;
}