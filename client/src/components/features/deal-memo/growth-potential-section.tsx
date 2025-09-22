'use client';

import { TrendingUp, Clock, Target } from 'lucide-react';

interface GrowthPotentialSectionProps {
  growthPotential: {
    upsideSummary: string;
    growthTimeline: string;
  };
}

export function GrowthPotentialSection({ growthPotential }: GrowthPotentialSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <TrendingUp className="w-6 h-6 text-success-400" />
        <h2 className="text-2xl font-bold text-primary-100">
          Growth Potential & Upside
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upside Summary */}
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-success-500/10 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-success-400" />
            </div>
            <h3 className="text-lg font-semibold text-primary-100">
              Upside Summary
            </h3>
          </div>
          
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-primary-300 leading-relaxed">
              {growthPotential.upsideSummary}
            </p>
          </div>
        </div>

        {/* Growth Timeline */}
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-accent-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent-400" />
            </div>
            <h3 className="text-lg font-semibold text-primary-100">
              Growth Timeline
            </h3>
          </div>
          
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-primary-300 leading-relaxed">
              {growthPotential.growthTimeline}
            </p>
          </div>
        </div>
      </div>

      {/* Growth Indicators */}
      <div className="card p-6 bg-gradient-to-r from-success-500/5 to-accent-500/5 border-success-500/20">
        <h3 className="text-lg font-semibold text-primary-100 mb-4">
          Growth Indicators
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-success-400" />
            </div>
            <h4 className="font-medium text-primary-200 mb-2">Market Expansion</h4>
            <p className="text-sm text-primary-400">
              Opportunity to scale into adjacent markets and customer segments
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-accent-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="w-6 h-6 text-accent-400" />
            </div>
            <h4 className="font-medium text-primary-200 mb-2">Product Evolution</h4>
            <p className="text-sm text-primary-400">
              Clear roadmap for feature development and product expansion
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-warning-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-warning-400" />
            </div>
            <h4 className="font-medium text-primary-200 mb-2">Timing Advantage</h4>
            <p className="text-sm text-primary-400">
              Well-positioned to capitalize on market timing and trends
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}