/**
 * Deal Memo Model
 * 
 * Represents the structured output of the AI deal analysis system.
 */

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