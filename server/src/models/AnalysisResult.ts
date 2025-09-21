// Analysis result data model
import { CompanyProfile } from './CompanyProfile.js';
import { InvestmentMetrics } from './InvestmentMetrics.js';
import { ConsistencyIssue, TeamMember, BaseEntity } from '../types/interfaces.js';
import { AnalysisType } from '../types/enums.js';

export interface MarketClaims {
  tam?: number;
  sam?: number;
  som?: number;
  marketGrowthRate?: number;
  competitorCount?: number;
  marketDescription?: string;
  targetMarket?: string;
  competitiveLandscape?: string[];
  marketTrends?: string[];
  barriers?: string[];
  opportunities?: string[];
}

export interface TeamProfile {
  founders: TeamMember[];
  keyEmployees: TeamMember[];
  advisors: TeamMember[];
  totalSize: number;
  averageExperience: number;
  domainExpertise: string[];
  previousExits?: number;
  educationBackground?: string[];
  networkStrength?: number;
}

export interface ProductProfile {
  description: string;
  stage: 'concept' | 'mvp' | 'beta' | 'production' | 'scale';
  features: string[];
  differentiators: string[];
  technologyStack?: string[];
  intellectualProperty?: string[];
  roadmap?: string[];
}

export interface CompetitiveAnalysis {
  directCompetitors: string[];
  indirectCompetitors: string[];
  competitiveAdvantages: string[];
  threats: string[];
  moatStrength: number;
  marketPosition: string;
}

export interface AnalysisResult extends BaseEntity {
  companyProfile: CompanyProfile;
  extractedMetrics: InvestmentMetrics;
  marketClaims: MarketClaims;
  teamAssessment: TeamProfile;
  productProfile?: ProductProfile;
  competitiveAnalysis?: CompetitiveAnalysis;
  consistencyFlags: ConsistencyIssue[];
  analysisType: AnalysisType;
  confidence: number;
  processingTime: number;
  sourceDocumentIds: string[];
}

export interface AnalysisResultInput {
  companyProfile: CompanyProfile;
  extractedMetrics: InvestmentMetrics;
  marketClaims: MarketClaims;
  teamAssessment: TeamProfile;
  productProfile?: ProductProfile;
  competitiveAnalysis?: CompetitiveAnalysis;
  consistencyFlags: ConsistencyIssue[];
  analysisType: AnalysisType;
  confidence: number;
  processingTime: number;
  sourceDocumentIds: string[];
}