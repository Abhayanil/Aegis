'use client';

import { TrendingUpIcon, TrendingDownIcon, BarChart3Icon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/chart';
import { Benchmark } from '@/types';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils';

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
    
    if (isNaN(company) || isNaN(benchmark)) return <BarChart3Icon size={16} />;
    
    if (company > benchmark) return <TrendingUpIcon size={16} className="text-green-400" />;
    if (company < benchmark) return <TrendingDownIcon size={16} className="text-red-400" />;
    return <BarChart3Icon size={16} className="text-slate-400" />;
  };

  const getPercentileColor = (percentile: number): string => {
    if (percentile >= 75) return 'text-green-400';
    if (percentile >= 50) return 'text-amber-400';
    if (percentile >= 25) return 'text-blue-400';
    return 'text-red-400';
  };

  const getMetricComparisonColor = (companyValue: number, benchmarkValue: number): string => {
    if (companyValue > benchmarkValue) return 'text-green-400';
    if (companyValue < benchmarkValue) return 'text-red-400';
    return 'text-slate-400';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3Icon size={20} />
          Key Metrics Dashboard
          <span className="text-sm font-normal text-slate-400 ml-auto">
            vs. Sector Benchmarks
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
              <Card key={index} className="p-4 hover:border-blue-500/30 transition-colors duration-200">
                {/* Metric Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wide">
                    {benchmark.metric}
                  </h3>
                  <div className={comparisonColor}>
                    {getComparisonIcon(benchmark.companyValue, benchmark.sectorMedian)}
                  </div>
                </div>

                {/* Values Comparison */}
                <div className="space-y-3 mb-4">
                  {/* Company Value */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">This Company</span>
                    <span className={`font-bold text-lg ${comparisonColor}`}>
                      {formatMetricValue(benchmark.companyValue, benchmark.metric)}
                    </span>
                  </div>

                  {/* Benchmark Value */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Sector Median</span>
                    <span className="font-medium text-slate-300">
                      {formatMetricValue(benchmark.sectorMedian, benchmark.metric)}
                    </span>
                  </div>
                </div>

                {/* Percentile Rank */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Percentile Rank</span>
                    <span className={`text-sm font-semibold ${getPercentileColor(benchmark.percentileRank)}`}>
                      {benchmark.percentileRank}th
                    </span>
                  </div>
                  
                  <ProgressBar
                    value={benchmark.percentileRank}
                    color={
                      benchmark.percentileRank >= 75 ? 'green' :
                      benchmark.percentileRank >= 50 ? 'amber' :
                      benchmark.percentileRank >= 25 ? 'blue' : 'red'
                    }
                  />
                </div>

                {/* Interpretation */}
                <div className="text-xs text-slate-400 leading-relaxed">
                  {benchmark.interpretation}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Summary Stats */}
        <Card className="p-6 bg-gradient-to-r from-blue-500/5 to-green-500/5 border-blue-500/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {benchmarks.filter(b => b.percentileRank >= 75).length}
              </div>
              <div className="text-sm text-slate-400">
                Top Quartile Metrics
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">
                {benchmarks.filter(b => b.percentileRank >= 50 && b.percentileRank < 75).length}
              </div>
              <div className="text-sm text-slate-400">
                Above Median Metrics
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {Math.round(benchmarks.reduce((sum, b) => sum + b.percentileRank, 0) / benchmarks.length)}th
              </div>
              <div className="text-sm text-slate-400">
                Average Percentile
              </div>
            </div>
          </div>
        </Card>
      </CardContent>
    </Card>
  );
}