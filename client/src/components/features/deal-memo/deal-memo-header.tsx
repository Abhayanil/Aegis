'use client';

import { Building2, TrendingUp } from 'lucide-react';
import { getSignalScoreColor, getRecommendationColor } from '@/lib/utils';

interface DealMemoHeaderProps {
  dealMemo: {
    summary: {
      companyName: string;
      oneLiner: string;
      signalScore: number;
      recommendation: string;
    };
  };
}

export function DealMemoHeader({ dealMemo }: DealMemoHeaderProps) {
  const { summary } = dealMemo;

  return (
    <div className="card p-8">
      <div className="flex items-start justify-between">
        {/* Company Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-primary-700 rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary-100 mb-2">
                {summary.companyName}
              </h1>
              <p className="text-lg text-primary-300 leading-relaxed">
                {summary.oneLiner}
              </p>
            </div>
          </div>
        </div>

        {/* Signal Score & Recommendation */}
        <div className="flex items-center space-x-6">
          {/* Signal Score */}
          <div className="text-center">
            <div className="text-sm font-medium text-primary-400 mb-2">
              Signal Score
            </div>
            <div className={`
              inline-flex items-center justify-center w-20 h-20 rounded-2xl font-bold text-2xl
              ${getSignalScoreColor(summary.signalScore)}
            `}>
              {summary.signalScore.toFixed(1)}
            </div>
            <div className="text-xs text-primary-500 mt-1">
              out of 10
            </div>
          </div>

          {/* Recommendation Badge */}
          <div className="text-center">
            <div className="text-sm font-medium text-primary-400 mb-2">
              Recommendation
            </div>
            <div className={`
              inline-flex items-center px-4 py-2 rounded-lg font-semibold text-sm
              ${getRecommendationColor(summary.recommendation)}
            `}>
              <TrendingUp className="w-4 h-4 mr-2" />
              {summary.recommendation.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="mt-6 pt-6 border-t border-primary-800">
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-400 mb-1">
              {summary.signalScore >= 8 ? 'High' : summary.signalScore >= 5 ? 'Medium' : 'Low'}
            </div>
            <div className="text-sm text-primary-500">
              Investment Priority
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-success-400 mb-1">
              Fast
            </div>
            <div className="text-sm text-primary-500">
              Analysis Speed
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-warning-400 mb-1">
              Complete
            </div>
            <div className="text-sm text-primary-500">
              Data Coverage
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-300 mb-1">
              AI-Powered
            </div>
            <div className="text-sm text-primary-500">
              Analysis Method
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}