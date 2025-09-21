// Financial metric anomaly detection service
import { InvestmentMetrics, RevenueMetrics, TractionMetrics } from '../../models/InvestmentMetrics.js';
import { RiskFlag, RiskFlagInput } from '../../models/RiskFlag.js';
import { RiskType, RiskSeverity } from '../../types/enums.js';
import { ValidationResult } from '../../types/interfaces.js';
import { v4 as uuidv4 } from 'uuid';

export interface AnomalyThresholds {
  churnRate: {
    saas: { warning: number; critical: number };
    ecommerce: { warning: number; critical: number };
    marketplace: { warning: number; critical: number };
    default: { warning: number; critical: number };
  };
  ltvCacRatio: {
    minimum: number; // Minimum acceptable LTV:CAC ratio
    healthy: number; // Healthy LTV:CAC ratio
  };
  grossMargin: {
    saas: { minimum: number; healthy: number };
    ecommerce: { minimum: number; healthy: number };
    marketplace: { minimum: number; healthy: number };
    default: { minimum: number; healthy: number };
  };
  growthConsistency: {
    maxVariance: number; // Maximum acceptable variance in growth rates
    minDataPoints: number; // Minimum data points needed for analysis
  };
  unitEconomics: {
    paybackPeriod: { warning: number; critical: number }; // In months
    burnMultiple: { warning: number; critical: number }; // Revenue multiple
  };
}

export interface CohortAnalysisData {
  cohortMonth: string;
  initialCustomers: number;
  retentionRates: number[]; // Monthly retention rates
  revenueRetention: number[]; // Revenue retention by month
  churnRate: number;
  expansionRate?: number;
}

export interface UnitEconomicsHealth {
  ltvCacRatio?: number;
  paybackPeriod?: number; // In months
  grossMargin?: number;
  burnMultiple?: number;
  healthScore: number; // 0-1 score
  redFlags: string[];
  warnings: string[];
}

export interface FinancialAnomalyReport {
  overallHealthScore: number;
  churnAnalysis: {
    isHealthy: boolean;
    currentRate?: number;
    benchmarkRate?: number;
    trend?: 'improving' | 'stable' | 'deteriorating';
    redFlags: string[];
  };
  unitEconomics: UnitEconomicsHealth;
  growthConsistency: {
    isConsistent: boolean;
    variance?: number;
    trend?: 'accelerating' | 'stable' | 'decelerating';
    redFlags: string[];
  };
  cohortHealth: {
    isHealthy: boolean;
    retentionTrend?: 'improving' | 'stable' | 'deteriorating';
    redFlags: string[];
  };
  anomalies: RiskFlag[];
}

export class MetricAnomalyDetector {
  private thresholds: AnomalyThresholds;

  constructor(thresholds?: Partial<AnomalyThresholds>) {
    this.thresholds = {
      churnRate: {
        saas: { warning: 0.05, critical: 0.10 }, // 5% warning, 10% critical
        ecommerce: { warning: 0.15, critical: 0.25 }, // 15% warning, 25% critical
        marketplace: { warning: 0.08, critical: 0.15 }, // 8% warning, 15% critical
        default: { warning: 0.10, critical: 0.20 }, // 10% warning, 20% critical
      },
      ltvCacRatio: {
        minimum: 3.0, // 3:1 minimum
        healthy: 5.0, // 5:1 healthy
      },
      grossMargin: {
        saas: { minimum: 0.70, healthy: 0.80 }, // 70% minimum, 80% healthy
        ecommerce: { minimum: 0.20, healthy: 0.40 }, // 20% minimum, 40% healthy
        marketplace: { minimum: 0.15, healthy: 0.25 }, // 15% minimum, 25% healthy
        default: { minimum: 0.30, healthy: 0.50 }, // 30% minimum, 50% healthy
      },
      growthConsistency: {
        maxVariance: 0.5, // 50% variance threshold
        minDataPoints: 3, // Need at least 3 data points
      },
      unitEconomics: {
        paybackPeriod: { warning: 18, critical: 36 }, // 18 months warning, 36 critical
        burnMultiple: { warning: 3.0, critical: 5.0 }, // 3x warning, 5x critical
      },
      ...thresholds,
    };
  }

  /**
   * Detects financial metric anomalies and generates risk flags
   */
  async detectFinancialAnomalies(
    metrics: InvestmentMetrics,
    sector?: string,
    cohortData?: CohortAnalysisData[],
    sourceDocuments: string[] = []
  ): Promise<FinancialAnomalyReport> {
    const anomalies: RiskFlag[] = [];

    // Analyze churn rate
    const churnAnalysis = await this.analyzeChurnRate(metrics.traction, sector, sourceDocuments);
    anomalies.push(...churnAnalysis.flags);

    // Analyze unit economics
    const unitEconomics = await this.analyzeUnitEconomics(metrics, sector, sourceDocuments);
    anomalies.push(...unitEconomics.flags);

    // Analyze growth consistency
    const growthConsistency = await this.analyzeGrowthConsistency(metrics.revenue, sourceDocuments);
    anomalies.push(...growthConsistency.flags);

    // Analyze cohort health if data is available
    const cohortHealth = cohortData ? 
      await this.analyzeCohortHealth(cohortData, sourceDocuments) : 
      { isHealthy: true, redFlags: [] };

    // Calculate overall health score
    const overallHealthScore = this.calculateOverallHealthScore(
      churnAnalysis,
      unitEconomics.health,
      growthConsistency,
      cohortHealth
    );

    return {
      overallHealthScore,
      churnAnalysis: {
        isHealthy: churnAnalysis.isHealthy,
        currentRate: churnAnalysis.currentRate,
        benchmarkRate: churnAnalysis.benchmarkRate,
        trend: churnAnalysis.trend,
        redFlags: churnAnalysis.redFlags,
      },
      unitEconomics: unitEconomics.health,
      growthConsistency: {
        isConsistent: growthConsistency.isConsistent,
        variance: growthConsistency.variance,
        trend: growthConsistency.trend,
        redFlags: growthConsistency.redFlags,
      },
      cohortHealth,
      anomalies,
    };
  }

  /**
   * Validates churn rate against sector benchmarks
   */
  async validateChurnRate(
    churnRate: number,
    sector?: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sectorKey = this.getSectorKey(sector);
    const thresholds = this.thresholds.churnRate[sectorKey];

    if (churnRate > thresholds.critical) {
      errors.push(`Churn rate of ${(churnRate * 100).toFixed(1)}% is critically high for ${sector || 'this sector'}`);
    } else if (churnRate > thresholds.warning) {
      warnings.push(`Churn rate of ${(churnRate * 100).toFixed(1)}% is above healthy levels for ${sector || 'this sector'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates unit economics health
   */
  async validateUnitEconomics(
    metrics: InvestmentMetrics,
    sector?: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { traction, revenue } = metrics;

    // Validate LTV:CAC ratio
    if (traction.ltv && traction.cac) {
      const ltvCacRatio = traction.ltv / traction.cac;
      if (ltvCacRatio < this.thresholds.ltvCacRatio.minimum) {
        errors.push(`LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}:1 is below minimum threshold of ${this.thresholds.ltvCacRatio.minimum}:1`);
      } else if (ltvCacRatio < this.thresholds.ltvCacRatio.healthy) {
        warnings.push(`LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}:1 is below healthy threshold of ${this.thresholds.ltvCacRatio.healthy}:1`);
      }
    }

    // Validate gross margin
    if (revenue.grossMargin !== undefined) {
      const sectorKey = this.getSectorKey(sector);
      const marginThresholds = this.thresholds.grossMargin[sectorKey];
      
      if (revenue.grossMargin < marginThresholds.minimum) {
        errors.push(`Gross margin of ${(revenue.grossMargin * 100).toFixed(1)}% is below minimum for ${sector || 'this sector'}`);
      } else if (revenue.grossMargin < marginThresholds.healthy) {
        warnings.push(`Gross margin of ${(revenue.grossMargin * 100).toFixed(1)}% is below healthy levels for ${sector || 'this sector'}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Analyzes churn rate patterns and trends
   */
  private async analyzeChurnRate(
    traction: TractionMetrics,
    sector?: string,
    sourceDocuments: string[] = []
  ): Promise<{
    isHealthy: boolean;
    currentRate?: number;
    benchmarkRate?: number;
    trend?: 'improving' | 'stable' | 'deteriorating';
    redFlags: string[];
    flags: RiskFlag[];
  }> {
    const flags: RiskFlag[] = [];
    const redFlags: string[] = [];
    
    if (!traction.churnRate) {
      redFlags.push('No churn rate data provided');
      flags.push(this.createRiskFlag({
        type: RiskType.FINANCIAL_ANOMALY,
        severity: RiskSeverity.MEDIUM,
        title: 'Missing Churn Rate Data',
        description: 'No churn rate information provided - critical metric for subscription businesses',
        affectedMetrics: ['traction.churnRate'],
        suggestedMitigation: 'Provide monthly and annual churn rates with cohort analysis',
        sourceDocuments,
        confidence: 0.9,
        impact: 'medium',
        likelihood: 'high',
        category: 'financial',
        evidence: ['No churn rate data found'],
      }));

      return {
        isHealthy: false,
        redFlags,
        flags,
      };
    }

    const sectorKey = this.getSectorKey(sector);
    const thresholds = this.thresholds.churnRate[sectorKey];
    const benchmarkRate = (thresholds.warning + thresholds.critical) / 2;

    let isHealthy = true;

    // Check if churn rate is within acceptable bounds
    if (traction.churnRate > thresholds.critical) {
      isHealthy = false;
      redFlags.push(`Churn rate of ${(traction.churnRate * 100).toFixed(1)}% is critically high`);
      flags.push(this.createRiskFlag({
        type: RiskType.FINANCIAL_ANOMALY,
        severity: RiskSeverity.HIGH,
        title: 'Critical Churn Rate',
        description: `Monthly churn rate of ${(traction.churnRate * 100).toFixed(1)}% is critically high for ${sector || 'this sector'}`,
        affectedMetrics: ['traction.churnRate'],
        suggestedMitigation: 'Immediate focus on customer retention initiatives and churn reduction strategies',
        sourceDocuments,
        confidence: 0.95,
        impact: 'critical',
        likelihood: 'high',
        category: 'financial',
        evidence: [
          `Churn Rate: ${(traction.churnRate * 100).toFixed(1)}%`,
          `Sector Benchmark: ${(benchmarkRate * 100).toFixed(1)}%`
        ],
      }));
    } else if (traction.churnRate > thresholds.warning) {
      isHealthy = false;
      redFlags.push(`Churn rate of ${(traction.churnRate * 100).toFixed(1)}% is above healthy levels`);
      flags.push(this.createRiskFlag({
        type: RiskType.FINANCIAL_ANOMALY,
        severity: RiskSeverity.MEDIUM,
        title: 'Elevated Churn Rate',
        description: `Monthly churn rate of ${(traction.churnRate * 100).toFixed(1)}% is above healthy levels for ${sector || 'this sector'}`,
        affectedMetrics: ['traction.churnRate'],
        suggestedMitigation: 'Investigate churn drivers and implement retention improvement programs',
        sourceDocuments,
        confidence: 0.85,
        impact: 'medium',
        likelihood: 'high',
        category: 'financial',
        evidence: [
          `Churn Rate: ${(traction.churnRate * 100).toFixed(1)}%`,
          `Warning Threshold: ${(thresholds.warning * 100).toFixed(1)}%`
        ],
      }));
    }

    return {
      isHealthy,
      currentRate: traction.churnRate,
      benchmarkRate,
      redFlags,
      flags,
    };
  }

  /**
   * Analyzes unit economics health
   */
  private async analyzeUnitEconomics(
    metrics: InvestmentMetrics,
    sector?: string,
    sourceDocuments: string[] = []
  ): Promise<{
    health: UnitEconomicsHealth;
    flags: RiskFlag[];
  }> {
    const flags: RiskFlag[] = [];
    const redFlags: string[] = [];
    const warnings: string[] = [];
    
    const { traction, revenue, team } = metrics;
    let healthScore = 1.0;

    // Analyze LTV:CAC ratio
    let ltvCacRatio: number | undefined;
    if (traction.ltv && traction.cac) {
      ltvCacRatio = traction.ltv / traction.cac;
      
      if (ltvCacRatio < this.thresholds.ltvCacRatio.minimum) {
        healthScore -= 0.4;
        redFlags.push(`LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}:1 is below minimum threshold`);
        flags.push(this.createRiskFlag({
          type: RiskType.FINANCIAL_ANOMALY,
          severity: RiskSeverity.HIGH,
          title: 'Poor Unit Economics',
          description: `LTV:CAC ratio of ${ltvCacRatio.toFixed(1)}:1 indicates unsustainable unit economics`,
          affectedMetrics: ['traction.ltv', 'traction.cac'],
          suggestedMitigation: 'Focus on increasing customer lifetime value or reducing customer acquisition costs',
          sourceDocuments,
          confidence: 0.9,
          impact: 'high',
          likelihood: 'high',
          category: 'financial',
          evidence: [
            `LTV: ${traction.ltv.toLocaleString()}`,
            `CAC: ${traction.cac.toLocaleString()}`,
            `Ratio: ${ltvCacRatio.toFixed(1)}:1`
          ],
        }));
      } else if (ltvCacRatio < this.thresholds.ltvCacRatio.healthy) {
        healthScore -= 0.2;
        warnings.push(`LTV:CAC ratio could be improved`);
      }
    } else {
      healthScore -= 0.3;
      warnings.push('Missing LTV or CAC data for unit economics analysis');
    }

    // Analyze gross margin
    if (revenue.grossMargin !== undefined) {
      const sectorKey = this.getSectorKey(sector);
      const marginThresholds = this.thresholds.grossMargin[sectorKey];
      
      if (revenue.grossMargin < marginThresholds.minimum) {
        healthScore -= 0.3;
        redFlags.push(`Gross margin of ${(revenue.grossMargin * 100).toFixed(1)}% is below sector minimum`);
        flags.push(this.createRiskFlag({
          type: RiskType.FINANCIAL_ANOMALY,
          severity: RiskSeverity.HIGH,
          title: 'Low Gross Margin',
          description: `Gross margin of ${(revenue.grossMargin * 100).toFixed(1)}% is below minimum for ${sector || 'this sector'}`,
          affectedMetrics: ['revenue.grossMargin'],
          suggestedMitigation: 'Review pricing strategy and cost structure to improve gross margins',
          sourceDocuments,
          confidence: 0.85,
          impact: 'high',
          likelihood: 'medium',
          category: 'financial',
          evidence: [
            `Gross Margin: ${(revenue.grossMargin * 100).toFixed(1)}%`,
            `Sector Minimum: ${(marginThresholds.minimum * 100).toFixed(1)}%`
          ],
        }));
      } else if (revenue.grossMargin < marginThresholds.healthy) {
        healthScore -= 0.1;
        warnings.push('Gross margin below healthy levels for sector');
      }
    } else {
      healthScore -= 0.2;
      warnings.push('Missing gross margin data');
    }

    // Calculate payback period if possible
    let paybackPeriod: number | undefined;
    if (traction.cac && revenue.mrr) {
      const monthlyGrossProfit = revenue.mrr * (revenue.grossMargin || 0.5);
      paybackPeriod = monthlyGrossProfit > 0 ? traction.cac / monthlyGrossProfit : undefined;
      
      if (paybackPeriod > this.thresholds.unitEconomics.paybackPeriod.critical) {
        healthScore -= 0.3;
        redFlags.push(`Payback period of ${paybackPeriod.toFixed(1)} months is too long`);
        flags.push(this.createRiskFlag({
          type: RiskType.FINANCIAL_ANOMALY,
          severity: RiskSeverity.HIGH,
          title: 'Long Payback Period',
          description: `Customer payback period of ${paybackPeriod.toFixed(1)} months is unsustainable`,
          affectedMetrics: ['traction.cac', 'revenue.mrr'],
          suggestedMitigation: 'Reduce CAC or increase monthly revenue per customer to improve payback period',
          sourceDocuments,
          confidence: 0.8,
          impact: 'high',
          likelihood: 'medium',
          category: 'financial',
          evidence: [
            `Payback Period: ${paybackPeriod.toFixed(1)} months`,
            `CAC: ${traction.cac.toLocaleString()}`,
            `Monthly Gross Profit: ${monthlyGrossProfit.toLocaleString()}`
          ],
        }));
      } else if (paybackPeriod > this.thresholds.unitEconomics.paybackPeriod.warning) {
        healthScore -= 0.1;
        warnings.push('Payback period is longer than ideal');
      }
    }

    // Calculate burn multiple if possible
    let burnMultiple: number | undefined;
    if (team.burnRate && revenue.arr && revenue.arr > 0) {
      burnMultiple = (team.burnRate * 12) / revenue.arr;
      
      if (burnMultiple > this.thresholds.unitEconomics.burnMultiple.critical) {
        healthScore -= 0.2;
        redFlags.push(`Burn multiple of ${burnMultiple.toFixed(1)}x is too high`);
        flags.push(this.createRiskFlag({
          type: RiskType.FINANCIAL_ANOMALY,
          severity: RiskSeverity.MEDIUM,
          title: 'High Burn Multiple',
          description: `Burn multiple of ${burnMultiple.toFixed(1)}x indicates inefficient growth`,
          affectedMetrics: ['team.burnRate', 'revenue.arr'],
          suggestedMitigation: 'Improve capital efficiency by optimizing growth investments',
          sourceDocuments,
          confidence: 0.75,
          impact: 'medium',
          likelihood: 'medium',
          category: 'financial',
          evidence: [
            `Annual Burn: ${(team.burnRate * 12).toLocaleString()}`,
            `ARR: ${revenue.arr.toLocaleString()}`,
            `Burn Multiple: ${burnMultiple.toFixed(1)}x`
          ],
        }));
      } else if (burnMultiple > this.thresholds.unitEconomics.burnMultiple.warning) {
        healthScore -= 0.1;
        warnings.push('Burn multiple could be improved');
      }
    }

    healthScore = Math.max(0, healthScore);

    return {
      health: {
        ltvCacRatio,
        paybackPeriod,
        grossMargin: revenue.grossMargin,
        burnMultiple,
        healthScore,
        redFlags,
        warnings,
      },
      flags,
    };
  }

  /**
   * Analyzes growth consistency and patterns
   */
  private async analyzeGrowthConsistency(
    revenue: RevenueMetrics,
    sourceDocuments: string[] = []
  ): Promise<{
    isConsistent: boolean;
    variance?: number;
    trend?: 'accelerating' | 'stable' | 'decelerating';
    redFlags: string[];
    flags: RiskFlag[];
  }> {
    const flags: RiskFlag[] = [];
    const redFlags: string[] = [];

    // Check if we have projected ARR data for analysis
    if (!revenue.projectedArr || revenue.projectedArr.length < this.thresholds.growthConsistency.minDataPoints) {
      redFlags.push('Insufficient growth data for consistency analysis');
      return {
        isConsistent: true, // Default to true if we can't analyze
        redFlags,
        flags,
      };
    }

    // Calculate month-over-month growth rates
    const growthRates: number[] = [];
    for (let i = 1; i < revenue.projectedArr.length; i++) {
      const growthRate = (revenue.projectedArr[i] - revenue.projectedArr[i - 1]) / revenue.projectedArr[i - 1];
      growthRates.push(growthRate);
    }

    // Calculate variance in growth rates
    const meanGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const variance = growthRates.reduce((sum, rate) => sum + Math.pow(rate - meanGrowthRate, 2), 0) / growthRates.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / Math.abs(meanGrowthRate);

    let isConsistent = true;
    let trend: 'accelerating' | 'stable' | 'decelerating' | undefined;

    // Determine trend
    const firstHalfAvg = growthRates.slice(0, Math.floor(growthRates.length / 2))
      .reduce((sum, rate) => sum + rate, 0) / Math.floor(growthRates.length / 2);
    const secondHalfAvg = growthRates.slice(Math.floor(growthRates.length / 2))
      .reduce((sum, rate) => sum + rate, 0) / (growthRates.length - Math.floor(growthRates.length / 2));

    if (secondHalfAvg > firstHalfAvg * 1.1) {
      trend = 'accelerating';
    } else if (secondHalfAvg < firstHalfAvg * 0.9) {
      trend = 'decelerating';
    } else {
      trend = 'stable';
    }

    // Check for excessive variance
    if (coefficientOfVariation > this.thresholds.growthConsistency.maxVariance) {
      isConsistent = false;
      redFlags.push(`Growth rate variance of ${(coefficientOfVariation * 100).toFixed(1)}% indicates inconsistent growth`);
      flags.push(this.createRiskFlag({
        type: RiskType.FINANCIAL_ANOMALY,
        severity: RiskSeverity.MEDIUM,
        title: 'Inconsistent Growth Pattern',
        description: `Growth rates show high variance (${(coefficientOfVariation * 100).toFixed(1)}%), indicating unpredictable growth`,
        affectedMetrics: ['revenue.projectedArr'],
        suggestedMitigation: 'Investigate causes of growth volatility and implement more predictable growth strategies',
        sourceDocuments,
        confidence: 0.8,
        impact: 'medium',
        likelihood: 'medium',
        category: 'financial',
        evidence: [
          `Growth Rate Variance: ${(coefficientOfVariation * 100).toFixed(1)}%`,
          `Mean Growth Rate: ${(meanGrowthRate * 100).toFixed(1)}%`,
          `Trend: ${trend}`
        ],
      }));
    }

    // Flag concerning deceleration
    if (trend === 'decelerating' && meanGrowthRate < 0.05) { // Less than 5% average growth
      redFlags.push('Growth is decelerating to concerning levels');
      flags.push(this.createRiskFlag({
        type: RiskType.FINANCIAL_ANOMALY,
        severity: RiskSeverity.HIGH,
        title: 'Decelerating Growth',
        description: `Growth is decelerating with average rate of ${(meanGrowthRate * 100).toFixed(1)}%`,
        affectedMetrics: ['revenue.projectedArr'],
        suggestedMitigation: 'Identify growth bottlenecks and implement growth acceleration initiatives',
        sourceDocuments,
        confidence: 0.85,
        impact: 'high',
        likelihood: 'medium',
        category: 'financial',
        evidence: [
          `Average Growth Rate: ${(meanGrowthRate * 100).toFixed(1)}%`,
          `Trend: ${trend}`,
          `Recent Growth Rates: ${growthRates.slice(-3).map(r => (r * 100).toFixed(1) + '%').join(', ')}`
        ],
      }));
    }

    return {
      isConsistent,
      variance: coefficientOfVariation,
      trend,
      redFlags,
      flags,
    };
  }

  /**
   * Analyzes cohort health and retention patterns
   */
  private async analyzeCohortHealth(
    cohortData: CohortAnalysisData[],
    sourceDocuments: string[] = []
  ): Promise<{
    isHealthy: boolean;
    retentionTrend?: 'improving' | 'stable' | 'deteriorating';
    redFlags: string[];
  }> {
    const redFlags: string[] = [];

    if (cohortData.length === 0) {
      redFlags.push('No cohort analysis data provided');
      return { isHealthy: false, redFlags };
    }

    // Analyze retention trends across cohorts - compare first cohort to last cohort
    let retentionTrend: 'improving' | 'stable' | 'deteriorating' | undefined;
    if (cohortData.length >= 2) {
      const firstCohortAvgRetention = cohortData[0].retentionRates.reduce((sum, rate) => sum + rate, 0) / cohortData[0].retentionRates.length;
      const lastCohortAvgRetention = cohortData[cohortData.length - 1].retentionRates.reduce((sum, rate) => sum + rate, 0) / cohortData[cohortData.length - 1].retentionRates.length;

      if (lastCohortAvgRetention > firstCohortAvgRetention * 1.05) {
        retentionTrend = 'improving';
      } else if (lastCohortAvgRetention < firstCohortAvgRetention * 0.95) {
        retentionTrend = 'deteriorating';
        redFlags.push('Cohort retention is deteriorating over time');
      } else {
        retentionTrend = 'stable';
      }
    }

    // Check for concerning churn patterns
    const avgChurnRate = cohortData.reduce((sum, cohort) => sum + cohort.churnRate, 0) / cohortData.length;
    if (avgChurnRate > 0.15) { // 15% average churn
      redFlags.push(`Average cohort churn rate of ${(avgChurnRate * 100).toFixed(1)}% is concerning`);
    }

    const isHealthy = redFlags.length === 0;

    return {
      isHealthy,
      retentionTrend,
      redFlags,
    };
  }

  /**
   * Calculates overall financial health score
   */
  private calculateOverallHealthScore(
    churnAnalysis: any,
    unitEconomics: UnitEconomicsHealth,
    growthConsistency: any,
    cohortHealth: any
  ): number {
    let score = 0;
    let components = 0;

    // Churn health (25% weight)
    if (churnAnalysis.isHealthy) {
      score += 0.25;
    }
    components++;

    // Unit economics health (35% weight)
    score += unitEconomics.healthScore * 0.35;
    components++;

    // Growth consistency (25% weight)
    if (growthConsistency.isConsistent) {
      score += 0.25;
    }
    components++;

    // Cohort health (15% weight)
    if (cohortHealth.isHealthy) {
      score += 0.15;
    }
    components++;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Gets sector key for threshold lookup
   */
  private getSectorKey(sector?: string): keyof AnomalyThresholds['churnRate'] {
    if (!sector) return 'default';
    
    const lowerSector = sector.toLowerCase();
    if (lowerSector.includes('saas') || lowerSector.includes('software')) return 'saas';
    if (lowerSector.includes('ecommerce') || lowerSector.includes('retail')) return 'ecommerce';
    if (lowerSector.includes('marketplace') || lowerSector.includes('platform')) return 'marketplace';
    
    return 'default';
  }

  /**
   * Creates a RiskFlag from input data
   */
  private createRiskFlag(input: RiskFlagInput): RiskFlag {
    return {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      detectedAt: new Date(),
      ...input,
    };
  }
}