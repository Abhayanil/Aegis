// Deal memo data model
import { RecommendationType, FundingStage } from '../types/enums.js';
import { RiskFlag } from './RiskFlag.js';
import { BenchmarkComparison } from './BenchmarkData.js';
import { BaseEntity } from '../types/interfaces.js';

export interface DealMemoSummary {
  companyName: string;
  oneLiner: string;
  sector: string;
  stage: FundingStage;
  signalScore: number;
  recommendation: RecommendationType;
  confidenceLevel: number;
  lastUpdated: Date;
}

export interface GrowthPotential {
  upsideSummary: string;
  growthTimeline: string;
  keyDrivers: string[];
  scalabilityFactors: string[];
  marketExpansionOpportunity: string;
  revenueProjection: {
    year1: number;
    year3: number;
    year5: number;
  };
}

export interface RiskAssessment {
  overallRiskScore: number;
  highPriorityRisks: RiskFlag[];
  mediumPriorityRisks: RiskFlag[];
  lowPriorityRisks: RiskFlag[];
  riskMitigationPlan: string[];
}

export interface InvestmentRecommendation {
  narrative: string;
  investmentThesis: string;
  idealCheckSize: string;
  idealValuationCap: string;
  suggestedTerms: string[];
  keyDiligenceQuestions: string[];
  followUpActions: string[];
  timelineToDecision: string;
}

export interface AnalysisWeightings {
  marketOpportunity: number;  // Default: 25%
  team: number;              // Default: 25%
  traction: number;          // Default: 20%
  product: number;           // Default: 15%
  competitivePosition: number; // Default: 15%
}

export interface DealMemo extends BaseEntity {
  aegisDealMemo: {
    summary: DealMemoSummary;
    keyBenchmarks: BenchmarkComparison[];
    growthPotential: GrowthPotential;
    riskAssessment: RiskAssessment;
    investmentRecommendation: InvestmentRecommendation;
    analysisWeightings: AnalysisWeightings;
    metadata: {
      generatedBy: string;
      analysisVersion: string;
      sourceDocuments: string[];
      processingTime: number;
      dataQuality: number;
    };
  };
}

export interface DealMemoInput {
  summary: DealMemoSummary;
  keyBenchmarks: BenchmarkComparison[];
  growthPotential: GrowthPotential;
  riskAssessment: RiskAssessment;
  investmentRecommendation: InvestmentRecommendation;
  analysisWeightings: AnalysisWeightings;
  metadata: {
    generatedBy: string;
    analysisVersion: string;
    sourceDocuments: string[];
    processingTime: number;
    dataQuality: number;
  };
}