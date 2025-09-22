'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/lib/api';
import { DealMemoInterface } from '@/components/features/deal-memo-interface';
import { Header } from '@/components/layout/header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorMessage } from '@/components/ui/error-message';
import { DealMemo, AnalysisWeightings } from '@/types';

function DealMemoContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const dealMemoId = searchParams.get('dealMemoId');
  
  const [dealMemo, setDealMemo] = useState<DealMemo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // If we have a sessionId, we need to generate the deal memo
  // If we have a dealMemoId, we can fetch the existing deal memo
  const shouldGenerate = sessionId && !dealMemoId;
  const shouldFetch = dealMemoId;

  // Fetch existing deal memo
  const { data: existingDealMemo, error: fetchError } = useQuery({
    queryKey: queryKeys.dealMemo(dealMemoId!),
    queryFn: () => api.getDealMemo(dealMemoId!),
    enabled: !!shouldFetch,
  });

  // Generate deal memo from session
  useEffect(() => {
    if (shouldGenerate && !isGenerating && !dealMemo) {
      generateDealMemo();
    }
  }, [shouldGenerate, isGenerating, dealMemo]);

  // Set deal memo from fetch result
  useEffect(() => {
    if (existingDealMemo?.data?.dealMemo) {
      setDealMemo(existingDealMemo.data.dealMemo);
    }
  }, [existingDealMemo]);

  const generateDealMemo = async () => {
    if (!sessionId) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
      // For now, we'll assume all documents from the session should be analyzed
      // In a real implementation, you might want to let users select specific documents
      const response = await api.generateDealMemo(
        [], // We'll pass empty array and let backend use all documents from session
        sessionId,
        {
          analysisWeightings: {
            marketOpportunity: 25,
            team: 25,
            traction: 20,
            product: 15,
            competitivePosition: 15,
          },
          includeRiskAssessment: true,
          includeBenchmarking: true,
          includeCompetitiveAnalysis: true,
        }
      );

      setDealMemo(response.data.dealMemo);
      
      // Update URL to include deal memo ID for future reference
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('dealMemoId', response.data.dealMemoId);
      newUrl.searchParams.delete('sessionId');
      window.history.replaceState({}, '', newUrl.toString());
      
    } catch (error) {
      console.error('Failed to generate deal memo:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Failed to generate deal memo'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWeightingChange = async (newWeightings: AnalysisWeightings) => {
    if (!dealMemoId) return;

    try {
      const response = await api.updateDealMemoWeightings(dealMemoId, newWeightings);
      setDealMemo(response.data.dealMemo);
    } catch (error) {
      console.error('Failed to update weightings:', error);
    }
  };

  if (!sessionId && !dealMemoId) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <ErrorMessage 
          title="Invalid Request"
          message="No session ID or deal memo ID provided. Please start a new analysis."
          actionLabel="Start New Analysis"
          onAction={() => window.location.href = '/'}
        />
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <h2 className="text-xl font-semibold text-primary-100 mt-4 mb-2">
            Generating Deal Memo
          </h2>
          <p className="text-primary-400">
            Analyzing documents and generating comprehensive investment analysis...
          </p>
        </div>
      </div>
    );
  }

  if (generationError || fetchError) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <ErrorMessage 
          title="Analysis Failed"
          message={generationError || (fetchError as Error)?.message || 'Unknown error occurred'}
          actionLabel="Try Again"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!dealMemo) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />
      <DealMemoInterface 
        dealMemo={dealMemo}
        onWeightingChange={handleWeightingChange}
      />
    </div>
  );
}

export default function DealMemoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <DealMemoContent />
    </Suspense>
  );
}