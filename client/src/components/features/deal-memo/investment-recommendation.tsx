'use client';

import { Target, DollarSign, HelpCircle, CheckCircle } from 'lucide-react';

interface InvestmentRecommendationProps {
  recommendation: {
    narrative: string;
    keyDiligenceQuestions: string[];
    idealCheckSize?: string;
    idealValuationCap?: string;
  };
}

export function InvestmentRecommendation({ recommendation }: InvestmentRecommendationProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Target className="w-6 h-6 text-accent-400" />
        <h2 className="text-2xl font-bold text-primary-100">
          Investment Recommendation
        </h2>
      </div>

      {/* Investment Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Investment Thesis */}
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-accent-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-accent-400" />
            </div>
            <h3 className="text-lg font-semibold text-primary-100">
              Investment Thesis
            </h3>
          </div>
          
          <div className="prose prose-invert prose-sm max-w-none">
            <p className="text-primary-300 leading-relaxed">
              {recommendation.narrative}
            </p>
          </div>
        </div>

        {/* Investment Terms */}
        <div className="card p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-success-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success-400" />
            </div>
            <h3 className="text-lg font-semibold text-primary-100">
              Suggested Terms
            </h3>
          </div>
          
          <div className="space-y-4">
            {recommendation.idealCheckSize && (
              <div className="flex items-center justify-between p-3 bg-primary-900/30 rounded-lg">
                <span className="text-sm text-primary-400">Ideal Check Size</span>
                <span className="font-semibold text-success-400">
                  {recommendation.idealCheckSize}
                </span>
              </div>
            )}
            
            {recommendation.idealValuationCap && (
              <div className="flex items-center justify-between p-3 bg-primary-900/30 rounded-lg">
                <span className="text-sm text-primary-400">Valuation Cap</span>
                <span className="font-semibold text-accent-400">
                  {recommendation.idealValuationCap}
                </span>
              </div>
            )}
            
            {!recommendation.idealCheckSize && !recommendation.idealValuationCap && (
              <div className="text-center py-4">
                <p className="text-sm text-primary-500">
                  Investment terms to be determined based on further due diligence
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Due Diligence Questions */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-warning-500/10 rounded-lg flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-warning-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary-100">
            Key Due Diligence Questions
          </h3>
        </div>

        {recommendation.keyDiligenceQuestions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendation.keyDiligenceQuestions.map((question, index) => (
              <div 
                key={index}
                className="p-4 bg-primary-900/20 rounded-lg border border-primary-800 hover:border-warning-500/30 transition-colors duration-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-warning-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-xs font-semibold text-warning-400">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-primary-300 leading-relaxed">
                    {question}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <HelpCircle className="w-12 h-12 text-primary-600 mx-auto mb-3" />
            <p className="text-primary-500">
              No specific due diligence questions identified
            </p>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="card p-6 bg-gradient-to-r from-accent-500/5 to-success-500/5 border-accent-500/20">
        <h3 className="text-lg font-semibold text-primary-100 mb-4">
          Recommended Next Steps
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-accent-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">📞</span>
            </div>
            <h4 className="font-medium text-primary-200 mb-2">Schedule Call</h4>
            <p className="text-sm text-primary-400">
              Set up founder meeting to discuss key questions and validate assumptions
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">📊</span>
            </div>
            <h4 className="font-medium text-primary-200 mb-2">Request Data</h4>
            <p className="text-sm text-primary-400">
              Gather additional financial data and customer references for validation
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-warning-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">👥</span>
            </div>
            <h4 className="font-medium text-primary-200 mb-2">Team Review</h4>
            <p className="text-sm text-primary-400">
              Present findings to investment committee for decision and next steps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}