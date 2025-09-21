import { z } from 'zod';
import { ValidationError } from './errors.js';
import { 
  DocumentType, 
  FundingStage, 
  RecommendationType, 
  RiskType, 
  RiskSeverity,
  ProcessingStatus,
  AnalysisType 
} from '../types/enums.js';

// File upload validation schema
export const fileUploadSchema = z.object({
  fieldname: z.string(),
  originalname: z.string(),
  encoding: z.string(),
  mimetype: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
  ]),
  size: z.number().max(50 * 1024 * 1024), // 50MB limit
  buffer: z.instanceof(Buffer),
});

// Analysis weightings validation schema
export const analysisWeightingsSchema = z.object({
  marketOpportunity: z.number().min(0).max(100).default(25),
  team: z.number().min(0).max(100).default(25),
  traction: z.number().min(0).max(100).default(20),
  product: z.number().min(0).max(100).default(15),
  competitivePosition: z.number().min(0).max(100).default(15),
}).refine(
  (data) => {
    const total = Object.values(data).reduce((sum, value) => sum + value, 0);
    return Math.abs(total - 100) < 0.01; // Allow for floating point precision
  },
  {
    message: 'Weightings must sum to 100%',
  }
);

// Generic validation helper
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        errorMessage || 'Validation failed',
        {
          issues: error.issues,
          receivedData: data,
        }
      );
    }
    throw error;
  }
}

// File type validation helper
export function validateFileType(file: Express.Multer.File): void {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    throw new ValidationError(
      `Unsupported file type: ${file.mimetype}`,
      {
        allowedTypes,
        receivedType: file.mimetype,
        filename: file.originalname,
      }
    );
  }
}

// Base entity schema
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Team member schema
export const teamMemberSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  background: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  yearsExperience: z.number().min(0).max(50).optional(),
  education: z.string().optional(),
  previousCompanies: z.array(z.string()).optional(),
  expertise: z.array(z.string()).optional(),
  isFounder: z.boolean().optional(),
});

// Company profile schema
export const companyProfileSchema = z.object({
  name: z.string().min(1).max(200),
  oneLiner: z.string().min(10).max(500),
  sector: z.string().min(1).max(100),
  stage: z.nativeEnum(FundingStage),
  foundedYear: z.number().min(1900).max(new Date().getFullYear()),
  location: z.string().min(1).max(200),
  website: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  socialLinks: z.object({
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
    crunchbase: z.string().url().optional(),
  }).optional(),
}).merge(baseEntitySchema);

// Investment metrics schemas
export const revenueMetricsSchema = z.object({
  arr: z.number().min(0).optional(),
  mrr: z.number().min(0).optional(),
  growthRate: z.number().min(-100).max(10000).optional(),
  projectedArr: z.array(z.number().min(0)).optional(),
  revenueRunRate: z.number().min(0).optional(),
  grossMargin: z.number().min(0).max(100).optional(),
  netRevenuRetention: z.number().min(0).max(500).optional(),
});

export const tractionMetricsSchema = z.object({
  customers: z.number().min(0).optional(),
  customerGrowthRate: z.number().min(-100).max(10000).optional(),
  churnRate: z.number().min(0).max(100).optional(),
  nps: z.number().min(-100).max(100).optional(),
  activeUsers: z.number().min(0).optional(),
  conversionRate: z.number().min(0).max(100).optional(),
  ltv: z.number().min(0).optional(),
  cac: z.number().min(0).optional(),
  ltvCacRatio: z.number().min(0).optional(),
});

export const teamMetricsSchema = z.object({
  size: z.number().min(1).max(10000),
  foundersCount: z.number().min(1).max(20),
  keyHires: z.array(teamMemberSchema),
  engineeringTeamSize: z.number().min(0).optional(),
  salesTeamSize: z.number().min(0).optional(),
  burnRate: z.number().min(0).optional(),
  runway: z.number().min(0).optional(),
});

export const fundingMetricsSchema = z.object({
  totalRaised: z.number().min(0).optional(),
  lastRoundSize: z.number().min(0).optional(),
  lastRoundDate: z.date().optional(),
  currentAsk: z.number().min(0).optional(),
  valuation: z.number().min(0).optional(),
  preMoneyValuation: z.number().min(0).optional(),
  postMoneyValuation: z.number().min(0).optional(),
  stage: z.nativeEnum(FundingStage).optional(),
  leadInvestor: z.string().optional(),
  useOfFunds: z.array(z.string()).optional(),
});

export const investmentMetricsSchema = z.object({
  revenue: revenueMetricsSchema,
  traction: tractionMetricsSchema,
  team: teamMetricsSchema,
  funding: fundingMetricsSchema,
  extractionTimestamp: z.date(),
  sourceDocuments: z.array(z.string()),
  confidence: z.number().min(0).max(1),
}).merge(baseEntitySchema);

// Risk flag schema
export const riskFlagSchema = z.object({
  type: z.nativeEnum(RiskType),
  severity: z.nativeEnum(RiskSeverity),
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(1000),
  affectedMetrics: z.array(z.string()),
  suggestedMitigation: z.string().min(10).max(1000),
  sourceDocuments: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  likelihood: z.enum(['low', 'medium', 'high']),
  category: z.enum(['financial', 'market', 'team', 'product', 'competitive', 'operational']),
  detectedAt: z.date(),
  evidence: z.array(z.string()),
  relatedFlags: z.array(z.string()).optional(),
}).merge(baseEntitySchema);

// Benchmark data schema
export const metricDistributionSchema = z.object({
  min: z.number(),
  max: z.number(),
  median: z.number(),
  p25: z.number(),
  p75: z.number(),
  p90: z.number(),
  mean: z.number(),
  stdDev: z.number(),
  sampleSize: z.number().min(1),
});

export const benchmarkDataSchema = z.object({
  sector: z.string().min(1).max(100),
  subSector: z.string().max(100).optional(),
  stage: z.nativeEnum(FundingStage).optional(),
  geography: z.string().max(100).optional(),
  sampleSize: z.number().min(1),
  metrics: z.record(z.string(), metricDistributionSchema),
  lastUpdated: z.date(),
  dataSource: z.string().min(1).max(200),
  methodology: z.string().min(10).max(1000),
  confidence: z.number().min(0).max(1),
  timeRange: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
}).merge(baseEntitySchema);

// Deal memo schema
export const dealMemoSummarySchema = z.object({
  companyName: z.string().min(1).max(200),
  oneLiner: z.string().min(10).max(500),
  sector: z.string().min(1).max(100),
  stage: z.nativeEnum(FundingStage),
  signalScore: z.number().min(0).max(100),
  recommendation: z.nativeEnum(RecommendationType),
  confidenceLevel: z.number().min(0).max(1),
  lastUpdated: z.date(),
});

export const growthPotentialSchema = z.object({
  upsideSummary: z.string().min(50).max(2000),
  growthTimeline: z.string().min(20).max(1000),
  keyDrivers: z.array(z.string().min(5).max(200)),
  scalabilityFactors: z.array(z.string().min(5).max(200)),
  marketExpansionOpportunity: z.string().min(20).max(1000),
  revenueProjection: z.object({
    year1: z.number().min(0),
    year3: z.number().min(0),
    year5: z.number().min(0),
  }),
});

export const benchmarkComparisonSchema = z.object({
  metric: z.string().min(1).max(100),
  companyValue: z.number(),
  sectorMedian: z.number(),
  percentile: z.number().min(0).max(100),
  interpretation: z.string().min(10).max(500),
  context: z.string().min(10).max(500),
  recommendation: z.string().max(500).optional(),
});

export const riskAssessmentSchema = z.object({
  overallRiskScore: z.number().min(0).max(100),
  highPriorityRisks: z.array(riskFlagSchema),
  mediumPriorityRisks: z.array(riskFlagSchema),
  lowPriorityRisks: z.array(riskFlagSchema),
  riskMitigationPlan: z.array(z.string().min(10).max(500)),
});

export const investmentRecommendationSchema = z.object({
  narrative: z.string().min(100).max(3000),
  investmentThesis: z.string().min(50).max(2000),
  idealCheckSize: z.string().min(5).max(100),
  idealValuationCap: z.string().min(5).max(100),
  suggestedTerms: z.array(z.string().min(5).max(200)),
  keyDiligenceQuestions: z.array(z.string().min(10).max(300)),
  followUpActions: z.array(z.string().min(5).max(200)),
  timelineToDecision: z.string().min(5).max(100),
});

export const dealMemoSchema = z.object({
  aegisDealMemo: z.object({
    summary: dealMemoSummarySchema,
    keyBenchmarks: z.array(benchmarkComparisonSchema),
    growthPotential: growthPotentialSchema,
    riskAssessment: riskAssessmentSchema,
    investmentRecommendation: investmentRecommendationSchema,
    analysisWeightings: analysisWeightingsSchema,
    metadata: z.object({
      generatedBy: z.string().min(1).max(100),
      analysisVersion: z.string().min(1).max(20),
      sourceDocuments: z.array(z.string()),
      processingTime: z.number().min(0),
      dataQuality: z.number().min(0).max(1),
    }),
  }),
}).merge(baseEntitySchema);

// Validation helper functions
export function validateDealMemo(data: unknown): z.infer<typeof dealMemoSchema> {
  return validateSchema(dealMemoSchema, data, 'Invalid deal memo format');
}

export function validateCompanyProfile(data: unknown): z.infer<typeof companyProfileSchema> {
  return validateSchema(companyProfileSchema, data, 'Invalid company profile format');
}

export function validateInvestmentMetrics(data: unknown): z.infer<typeof investmentMetricsSchema> {
  return validateSchema(investmentMetricsSchema, data, 'Invalid investment metrics format');
}

export function validateRiskFlag(data: unknown): z.infer<typeof riskFlagSchema> {
  return validateSchema(riskFlagSchema, data, 'Invalid risk flag format');
}

export function validateBenchmarkData(data: unknown): z.infer<typeof benchmarkDataSchema> {
  return validateSchema(benchmarkDataSchema, data, 'Invalid benchmark data format');
}

// Normalize weightings to sum to 100%
export function normalizeWeightings(weightings: Record<string, number>): Record<string, number> {
  const total = Object.values(weightings).reduce((sum, value) => sum + value, 0);
  
  if (total === 0) {
    throw new ValidationError('All weightings cannot be zero');
  }
  
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weightings)) {
    normalized[key] = (value / total) * 100;
  }
  
  return normalized;
}

// Detailed validation with error reporting
export interface ValidationReport {
  isValid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: string;
    received?: any;
  }>;
  warnings: string[];
  summary: string;
}

export function validateWithReport<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): ValidationReport {
  try {
    schema.parse(data);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      summary: `${context || 'Data'} validation passed successfully`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
        received: issue.received,
      }));

      return {
        isValid: false,
        errors,
        warnings: [],
        summary: `${context || 'Data'} validation failed with ${errors.length} error(s)`,
      };
    }

    return {
      isValid: false,
      errors: [{
        path: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        code: 'unknown_error',
      }],
      warnings: [],
      summary: `${context || 'Data'} validation failed with unknown error`,
    };
  }
}

// Deal memo schema validation with detailed reporting
export function validateDealMemoSchema(data: unknown): ValidationReport {
  return validateWithReport(dealMemoSchema, data, 'Deal memo');
}