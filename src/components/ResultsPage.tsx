import React, { useState } from 'react';
import { Download, Copy, Code, ChevronDown, ChevronRight, Star, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { DealMemo } from '../types';
import { exportMemoJSON } from '../lib/api';

interface ResultsPageProps {
  dealMemo: DealMemo;
  onStartOver: () => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ dealMemo, onStartOver }) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [expandedRiskSection, setExpandedRiskSection] = useState<'high' | 'medium' | null>('high');

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'Strong Buy': return 'bg-green-100 text-green-800 border-green-200';
      case 'Buy': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Pass': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSignalScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const downloadJson = async () => {
    // Call backend export endpoint to generate a downloadable file
    const blob = await exportMemoJSON({ aegisDealMemo: dealMemo });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dealMemo.summary.companyName.replace(/\s+/g, '_')}_deal_memo.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deal Memo Generated</h1>
            <p className="text-gray-600">AI analysis completed successfully</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => copyToClipboard(JSON.stringify(dealMemo, null, 2))}>
              <Copy className="w-4 h-4 mr-2" />
              Copy JSON
            </Button>
            <Button variant="outline" onClick={downloadJson}>
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button onClick={onStartOver}>
              Analyze New Startup
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Summary Card */}
          <Card className="lg:col-span-1">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {dealMemo.summary.companyName}
              </h2>
              <p className="text-gray-600 mb-4">{dealMemo.summary.oneLiner}</p>
              
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Star className={`w-5 h-5 ${getSignalScoreColor(dealMemo.summary.signalScore)}`} />
                <span className={`text-2xl font-bold ${getSignalScoreColor(dealMemo.summary.signalScore)}`}>
                  {dealMemo.summary.signalScore}
                </span>
                <span className="text-sm text-gray-500">Signal Score</span>
              </div>

              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getRecommendationColor(dealMemo.summary.recommendation)}`}>
                {dealMemo.summary.recommendation}
              </div>
            </div>
          </Card>

          {/* Key Metrics Overview */}
          <Card className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Key Benchmarks
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Metric</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Startup</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Sector Median</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Percentile</th>
                  </tr>
                </thead>
                <tbody>
                  {dealMemo.benchmarks.map((benchmark, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 text-sm text-gray-900 font-medium">{benchmark.metric}</td>
                      <td className="py-3 text-sm text-gray-900">{benchmark.startupValue}</td>
                      <td className="py-3 text-sm text-gray-500">{benchmark.sectorMedian}</td>
                      <td className="py-3 text-sm text-green-600 font-medium">{benchmark.percentile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Growth Potential */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Growth Potential</h3>
            
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Key Highlights</h4>
              <ul className="space-y-2">
                {dealMemo.growthPotential.highlights.map((highlight, index) => (
                  <li key={index} className="flex items-start">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-sm text-gray-600">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Timeline</h4>
              <div className="space-y-3">
                {dealMemo.growthPotential.timeline.map((item, index) => (
                  <div key={index} className="flex">
                    <div className="w-20 text-xs text-gray-500 font-medium mr-4 flex-shrink-0">
                      {item.period}
                    </div>
                    <div className="text-sm text-gray-600">{item.milestone}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Risk Assessment */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
              Risk Assessment
            </h3>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => setExpandedRiskSection(expandedRiskSection === 'high' ? null : 'high')}
                  className="flex items-center justify-between w-full text-left p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <span className="text-sm font-medium text-red-800">High Risk ({dealMemo.riskAssessment.high.length})</span>
                  {expandedRiskSection === 'high' ? 
                    <ChevronDown className="w-4 h-4 text-red-600" /> : 
                    <ChevronRight className="w-4 h-4 text-red-600" />
                  }
                </button>
                {expandedRiskSection === 'high' && (
                  <div className="mt-2 space-y-2">
                    {dealMemo.riskAssessment.high.map((risk, index) => (
                      <div key={index} className="p-3 bg-white border-l-4 border-red-400">
                        <p className="text-sm text-gray-700">{risk}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => setExpandedRiskSection(expandedRiskSection === 'medium' ? null : 'medium')}
                  className="flex items-center justify-between w-full text-left p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                >
                  <span className="text-sm font-medium text-yellow-800">Medium Risk ({dealMemo.riskAssessment.medium.length})</span>
                  {expandedRiskSection === 'medium' ? 
                    <ChevronDown className="w-4 h-4 text-yellow-600" /> : 
                    <ChevronRight className="w-4 h-4 text-yellow-600" />
                  }
                </button>
                {expandedRiskSection === 'medium' && (
                  <div className="mt-2 space-y-2">
                    {dealMemo.riskAssessment.medium.map((risk, index) => (
                      <div key={index} className="p-3 bg-white border-l-4 border-yellow-400">
                        <p className="text-sm text-gray-700">{risk}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Investment Recommendation */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Recommendation</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <p className="text-gray-700 mb-6">{dealMemo.investmentRecommendation.narrative}</p>
              
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Diligence Questions</h4>
                <ul className="space-y-2">
                  {dealMemo.investmentRecommendation.diligenceQuestions.map((question, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 mr-3 font-bold text-sm">{index + 1}.</span>
                      <span className="text-sm text-gray-600">{question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-1">Suggested Check Size</div>
                <div className="text-lg font-semibold text-blue-900">{dealMemo.investmentRecommendation.checkSize}</div>
              </div>
              
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800 mb-1">Valuation Cap</div>
                <div className="text-lg font-semibold text-green-900">{dealMemo.investmentRecommendation.valuationCap}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Raw JSON Toggle */}
        <Card>
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="text-sm font-medium text-gray-700 flex items-center">
              <Code className="w-4 h-4 mr-2" />
              View Raw JSON
            </span>
            {showRawJson ? 
              <ChevronDown className="w-4 h-4 text-gray-500" /> : 
              <ChevronRight className="w-4 h-4 text-gray-500" />
            }
          </button>
          
          {showRawJson && (
            <div className="mt-4">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(dealMemo, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};