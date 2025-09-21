// Enumeration types for the application

export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  PPTX = 'pptx',
  TXT = 'txt',
  ZIP = 'zip',
}

export enum FundingStage {
  PRE_SEED = 'pre-seed',
  SEED = 'seed',
  SERIES_A = 'series-a',
  SERIES_B = 'series-b',
  SERIES_C = 'series-c',
  LATER_STAGE = 'later-stage',
}

export enum RecommendationType {
  STRONG_BUY = 'strong-buy',
  BUY = 'buy',
  HOLD = 'hold',
  PASS = 'pass',
  STRONG_PASS = 'strong-pass',
}

export enum RiskType {
  INCONSISTENCY = 'inconsistency',
  MARKET_SIZE = 'market-size',
  FINANCIAL_ANOMALY = 'financial-anomaly',
  COMPETITIVE_RISK = 'competitive-risk',
  TEAM_RISK = 'team-risk',
  TECHNICAL_RISK = 'technical-risk',
}

export enum RiskSeverity {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum AnalysisType {
  ENTITY_EXTRACTION = 'entity-extraction',
  CONSISTENCY_CHECK = 'consistency-check',
  SECTOR_BENCHMARKING = 'sector-benchmarking',
  RISK_ASSESSMENT = 'risk-assessment',
  DEAL_MEMO_GENERATION = 'deal-memo-generation',
}