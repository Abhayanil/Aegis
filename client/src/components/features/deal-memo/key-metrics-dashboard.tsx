'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Benchmark } from '@/types';
import { formatCurrency, formatPercentage, formatNumber, getMetricComparisonColor, getMetricTrendIcon } from '@/lib/utils';

interface KeyMetricsDashboardProps {
  benchmarks: Benchmark[];
}

export function KeyMetricsDashboard({ benchmarks }: KeyMetricsDashboardProps) {
  const formatMetricValue = (value: number | string, metric: string): string => {
    if (typeof value === 'string') return value;
    
    const metricLower = metric.toLowerCase();
    
    if (metricLower.includes('revenue') || metricLower.includes('arr') || metricLower.includes('mrr')) {
      return formatCurrency(value, true);
    }
    
    if (metricLower.includes('rate') || metricLower.includes('growth') || metricLower.includes('margin')) {
      return formatPercentage(value);
    }
    
    return formatNumber(value, { notation: 'compact' });
  };

  const getComparisonIcon = (companyValue: number | string, benchmarkValue: number | string) => {
    const company = typeof companyValue === 'string' ? parseFloat(companyValue) : companyValue;
    const benchmark = typeof benchmarkValue === 'string' ? parseFloat(benchmarkValue) : benchmarkValue;
    
    if (isNaN(company) || isNaN(benchmark)) return <Minus className="w-4 h-4" />;
    
    if (company > benchmark) return <TrendingUp className="w-4 h-4" />;
    if (company < benchmark) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getPercentileColor = (percentile: number): string => {
    if (percentile >= 75) return 'text-success-400';
    if (percentile >= 50) return 'text-warning-400';
    if (percentile >= 25) return 'text-primary-300';
    return 'text-danger-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary-100">
          Key Metrics Dashboard
        </h2>
        <div className="text-sm text-primary-400">
          vs. Sector Benchmarks
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {benchmarks.map((benchmark, index) => {
          const companyNum = typeof benchmark.companyValue === 'string' 
            ? parseFloat(benchmark.companyValue) 
            : benchmark.companyValue;
          const benchmarkNum = typeof benchmark.sectorMedian === 'string' 
            ? parseFloat(benchmark.sectorMedian) 
            : benchmark.sectorMedian;
          
          const comparisonColor = getMetricComparisonColor(companyNum, benchmarkNum);
          
          return (
            <div key={index} className="card p-6 hover:border-accent-500/30 transition-colors duration-200">
              {/* Metric Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-primary-200 text-sm uppercase tracking-wide">
                  {benchmark.metric}
                </h3>
                <div className={`${comparisonColor}`}>
                  {getComparisonIcon(benchmark.companyValue, benchmark.sectorMedian)}
                </div>
              </div>

              {/* Values Comparison */}
              <div className="space-y-3 mb-4">
                {/* Company Value */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-400">This Company</span>
                  <span className={`font-bold text-lg ${comparisonColor}`}>
                    {formatMetricValue(benchmark.companyValue, benchmark.metric)}
                  </span>
                </div>

                {/* Benchmark Value */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-500">Sector Median</span>
                  <span className="font-medium text-primary-300">
                    {formatMetricValue(benchmark.sectorMedian, benchmark.metric)}
                  </span>
                </div>
              </div>

              {/* Percentile Rank */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-primary-500">Percentile Rank</span>
                  <span className={`text-sm font-semibold ${getPercentileColor(benchmark.percentileRank)}`}>
                    {benchmark.percentileRank}th
                  </span>
                </div>
                
                {/* Percentile Bar */}
                <div className="w-full bg-primary-800 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      benchmark.percentileRank >= 75 ? 'bg-success-500' :
                      benchmark.percentileRank >= 50 ? 'bg-warning-500' :
                      benchmark.percentileRank >= 25 ? 'bg-primary-500' : 'bg-danger-500'
                    }`}
                    style={{ width: `${benchmark.percentileRank}%` }}
                  />
                </div>
              </div>

              {/* Interpretation */}
              <div className="text-xs text-primary-400 leading-relaxed">
                {benchmark.interpretation}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="card p-6 bg-gradient-to-r from-accent-500/5 to-success-500/5 border-accent-500/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-success-400 mb-1">
              {benchmarks.filter(b => b.percentileRank >= 75).length}
            </div>
            <div className="text-sm text-primary-400">
              Top Quartile Metrics
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-warning-400 mb-1">
              {benchmarks.filter(b => b.percentileRank >= 50 && b.percentileRank < 75).length}
            </div>
            <div className="text-sm text-primary-400">
              Above Median Metrics
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-300 mb-1">
              {Math.round(benchmarks.reduce((sum, b) => sum + b.percentileRank, 0) / benchmarks.length)}th
            </div>
            <div className="text-sm text-primary-400">
              Average Percentile
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}