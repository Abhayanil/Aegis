export interface UploadedFile {
  id: string;
  name: string;
  type: 'pitch-deck' | 'transcript' | 'updates';
  file: File;
  status: 'pending' | 'uploaded' | 'error';
}

export interface DealMemo {
  summary: {
    companyName: string;
    oneLiner: string;
    signalScore: number;
    recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Pass';
  };
  benchmarks: Array<{
    metric: string;
    startupValue: string;
    sectorMedian: string;
    percentile: string;
  }>;
  growthPotential: {
    highlights: string[];
    timeline: Array<{
      period: string;
      milestone: string;
    }>;
  };
  riskAssessment: {
    high: string[];
    medium: string[];
  };
  investmentRecommendation: {
    narrative: string;
    checkSize: string;
    valuationCap: string;
    diligenceQuestions: string[];
  };
}

export type AppState = 'upload' | 'processing' | 'results';