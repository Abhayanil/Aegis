// Risk flag data model
import { RiskType, RiskSeverity } from '../types/enums.js';
import { BaseEntity } from '../types/interfaces.js';

export interface RiskFlag extends BaseEntity {
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  affectedMetrics: string[];
  suggestedMitigation: string;
  sourceDocuments: string[];
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  category: 'financial' | 'market' | 'team' | 'product' | 'competitive' | 'operational';
  detectedAt: Date;
  evidence: string[];
  relatedFlags?: string[];
}

export interface RiskFlagInput {
  type: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  affectedMetrics: string[];
  suggestedMitigation: string;
  sourceDocuments: string[];
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'low' | 'medium' | 'high';
  category: 'financial' | 'market' | 'team' | 'product' | 'competitive' | 'operational';
  evidence: string[];
  relatedFlags?: string[];
}

export interface RiskAssessment {
  totalRisks: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  overallRiskScore: number;
  riskCategories: Record<string, number>;
  flags: RiskFlag[];
  summary: string;
}