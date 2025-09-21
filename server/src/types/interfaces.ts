// Common interface definitions

import { 
  DocumentType, 
  FundingStage, 
  RecommendationType, 
  RiskType, 
  RiskSeverity,
  ProcessingStatus,
  AnalysisType 
} from './enums.js';

// Base interfaces
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentMetadata {
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  processingStatus: ProcessingStatus;
  extractedPageCount?: number;
  ocrRequired?: boolean;
}

export interface DocumentSection {
  title: string;
  content: string;
  pageNumber?: number;
  confidence?: number;
  sourceDocument: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AnalysisContext {
  analysisType: AnalysisType;
  companyName?: string;
  sector?: string;
  stage?: FundingStage;
  customPrompts?: Record<string, string>;
}

export interface MetricDistribution {
  min: number;
  max: number;
  median: number;
  p25: number;
  p75: number;
  p90: number;
  mean: number;
  stdDev: number;
  sampleSize: number;
}

export interface PercentileRankings {
  [metricName: string]: {
    value: number;
    percentile: number;
    interpretation: string;
  };
}

export interface ConsistencyIssue {
  metric: string;
  sources: string[];
  values: any[];
  severity: RiskSeverity;
  description: string;
}

export interface TeamMember {
  name: string;
  role: string;
  background?: string;
  linkedinUrl?: string;
  yearsExperience?: number;
  education?: string;
  previousCompanies?: string[];
  expertise?: string[];
  isFounder?: boolean;
}

export interface SectorClassification {
  primarySector: string;
  secondarySectors: string[];
  confidence: number;
  reasoning: string;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    processingTime: number;
    timestamp: Date;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}