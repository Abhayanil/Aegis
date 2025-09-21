// Investment metrics data model
import { TeamMember, BaseEntity } from '../types/interfaces.js';
import { FundingStage } from '../types/enums.js';

export interface RevenueMetrics {
  arr?: number;
  mrr?: number;
  growthRate?: number;
  projectedArr?: number[];
  revenueRunRate?: number;
  grossMargin?: number;
  netRevenuRetention?: number;
}

export interface TractionMetrics {
  customers?: number;
  customerGrowthRate?: number;
  churnRate?: number;
  nps?: number;
  activeUsers?: number;
  conversionRate?: number;
  ltv?: number;
  cac?: number;
  ltvCacRatio?: number;
}

export interface TeamMetrics {
  size: number;
  foundersCount: number;
  keyHires: TeamMember[];
  engineeringTeamSize?: number;
  salesTeamSize?: number;
  burnRate?: number;
  runway?: number;
}

export interface FundingMetrics {
  totalRaised?: number;
  lastRoundSize?: number;
  lastRoundDate?: Date;
  currentAsk?: number;
  valuation?: number;
  preMoneyValuation?: number;
  postMoneyValuation?: number;
  stage?: FundingStage;
  leadInvestor?: string;
  useOfFunds?: string[];
}

export interface InvestmentMetrics extends BaseEntity {
  revenue: RevenueMetrics;
  traction: TractionMetrics;
  team: TeamMetrics;
  funding: FundingMetrics;
  extractionTimestamp: Date;
  sourceDocuments: string[];
  confidence: number;
}

export interface InvestmentMetricsInput {
  revenue: RevenueMetrics;
  traction: TractionMetrics;
  team: TeamMetrics;
  funding: FundingMetrics;
  sourceDocuments: string[];
  confidence?: number;
}