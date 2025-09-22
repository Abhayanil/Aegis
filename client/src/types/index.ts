// Core types for the Aegis platform

export interface DealMemo {
  aegisDealMemo: {
    summary: {
      companyName: string;
      oneLiner: string;
      signalScore: number;
      recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'PASS';
    };
    keyBenchmarks: Benchmark[];
    growthPotential: {
      upsideSummary: string;
      growthTimeline: string;
    };
    riskAssessment: {
      highPriorityRisks: Risk[];
      mediumPriorityRisks: Risk[];
    };
    investmentRecommendation: {
      narrative: string;
      keyDiligenceQuestions: string[];
      idealCheckSize?: string;
      idealValuationCap?: string;
    };
  };
}

export interface Benchmark {
  metric: string;
  companyValue: number | string;
  sectorMedian: number | string;
  percentileRank: number;
  interpretation: string;
}

export interface Risk {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  affectedMetrics: string[];
  suggestedMitigation: string;
  sourceDocuments: string[];
}

export interface ProcessedDocument {
  id: string;
  sourceType: string;
  extractedText: string;
  sections: DocumentSection[];
  metadata: {
    filename: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    processingStatus: string;
  };
  processingTimestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSection {
  title: string;
  content: string;
  sourceDocument: string;
}

export interface UploadResponse {
  success: boolean;
  data: {
    sessionId: string;
    documents: ProcessedDocument[];
    summary: {
      successfullyProcessed: number;
      failed: number;
      totalSize: number;
    };
    processingTime: number;
    errors?: Array<{
      filename: string;
      error: string;
    }>;
    warnings?: string[];
  };
}

export interface DealMemoResponse {
  success: boolean;
  data: {
    dealMemo: DealMemo;
    dealMemoId: string;
    processingTime: number;
    warnings?: string[];
  };
}

export interface AnalysisWeightings {
  marketOpportunity: number;
  team: number;
  traction: number;
  product: number;
  competitivePosition: number;
}

export interface ProcessingStatus {
  stage: 'uploading' | 'processing' | 'analyzing' | 'benchmarking' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: string;
}

export interface CompanyMetric {
  name: string;
  value: number | string;
  benchmark: number | string;
  percentile: number;
  trend: 'up' | 'down' | 'neutral';
  unit?: string;
  format?: 'currency' | 'percentage' | 'number';
}

export interface DocumentThumbnail {
  id: string;
  filename: string;
  type: string;
  pageCount?: number;
  thumbnail?: string;
  highlights?: Array<{
    page: number;
    text: string;
    context: string;
  }>;
}

// UI State types
export interface UIState {
  sidebarOpen: boolean;
  activeDocument: string | null;
  weightings: AnalysisWeightings;
  processingStatus: ProcessingStatus | null;
}

// API Error types
export interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// Chart data types
export interface ChartData {
  name: string;
  company: number;
  benchmark: number;
  percentile: number;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  benchmark?: number;
}

// Export types
export interface ExportOptions {
  format: 'json' | 'pdf' | 'docx';
  includeSourceData: boolean;
  includeCharts: boolean;
  template?: string;
}

export interface ExportResponse {
  success: boolean;
  data: {
    exportData: any;
    downloadUrl?: string;
    filename: string;
  };
}