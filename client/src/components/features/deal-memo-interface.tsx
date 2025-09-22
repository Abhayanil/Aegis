'use client';

import { useState } from 'react';
import { DealMemo, AnalysisWeightings } from '@/types';
import { DealMemoHeader } from './deal-memo/deal-memo-header';
import { KeyMetricsDashboard } from './deal-memo/key-metrics-dashboard';
import { GrowthPotentialSection } from './deal-memo/growth-potential-section';
import { RiskAssessmentMatrix } from './deal-memo/risk-assessment-matrix';
import { InvestmentRecommendation } from './deal-memo/investment-recommendation';
import { DealMemoSidebar } from './deal-memo/deal-memo-sidebar';
import { ActionBar } from './deal-memo/action-bar';

interface DealMemoInterfaceProps {
  dealMemo: DealMemo;
  onWeightingChange: (weightings: AnalysisWeightings) => void;
}

export function DealMemoInterface({ dealMemo, onWeightingChange }: DealMemoInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [weightings, setWeightings] = useState<AnalysisWeightings>({
    marketOpportunity: 25,
    team: 25,
    traction: 20,
    product: 15,
    competitivePosition: 15,
  });

  const handleWeightingChange = (newWeightings: AnalysisWeightings) => {
    setWeightings(newWeightings);
    onWeightingChange(newWeightings);
  };

  return (
    <div className="flex h-screen bg-dark-950">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'mr-88' : 'mr-0'}`}>
        {/* Action Bar */}
        <ActionBar 
          dealMemo={dealMemo}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6 space-y-8">
            {/* Header Section */}
            <DealMemoHeader dealMemo={dealMemo.aegisDealMemo} />

            {/* Key Metrics Dashboard */}
            <KeyMetricsDashboard 
              benchmarks={dealMemo.aegisDealMemo.keyBenchmarks}
            />

            {/* Growth Potential */}
            <GrowthPotentialSection 
              growthPotential={dealMemo.aegisDealMemo.growthPotential}
            />

            {/* Risk Assessment Matrix */}
            <RiskAssessmentMatrix 
              riskAssessment={dealMemo.aegisDealMemo.riskAssessment}
              onSourceClick={(source) => setActiveDocument(source)}
            />

            {/* Investment Recommendation */}
            <InvestmentRecommendation 
              recommendation={dealMemo.aegisDealMemo.investmentRecommendation}
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <DealMemoSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        weightings={weightings}
        onWeightingChange={handleWeightingChange}
        activeDocument={activeDocument}
        onDocumentChange={setActiveDocument}
      />
    </div>
  );
}