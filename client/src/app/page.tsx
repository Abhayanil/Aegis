'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentUpload } from '@/components/features/document-upload';
import { ProcessingStatus } from '@/components/features/processing-status';
import { Header } from '@/components/layout/header';
import { UploadResponse } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);

  const handleUploadSuccess = (response: UploadResponse) => {
    // Navigate to deal memo page with session ID
    router.push(`/deal-memo?sessionId=${response.data.sessionId}`);
  };

  const handleProcessingUpdate = (stage: string, progress: number) => {
    setProcessingStage(stage);
    setProcessingProgress(progress);
  };

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {!isProcessing ? (
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold text-gradient mb-6">
                AI-Powered Deal Analysis
              </h1>
              <p className="text-xl text-primary-300 mb-8 max-w-2xl mx-auto">
                Upload your pitch deck or transcript and get an instant investment analysis 
                with benchmarking, risk assessment, and actionable recommendations.
              </p>
              <div className="flex items-center justify-center space-x-8 text-sm text-primary-400">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                  <span>PDF, DOCX, PPTX supported</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                  <span>Analysis in under 2 minutes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
                  <span>Industry benchmarking</span>
                </div>
              </div>
            </div>

            {/* Upload Component */}
            <DocumentUpload
              onUploadStart={() => setIsProcessing(true)}
              onUploadSuccess={handleUploadSuccess}
              onProcessingUpdate={handleProcessingUpdate}
              onError={() => setIsProcessing(false)}
            />

            {/* Features Preview */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="card p-6 text-center">
                <div className="w-12 h-12 bg-accent-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-lg font-semibold text-primary-100 mb-2">
                  Instant Analysis
                </h3>
                <p className="text-primary-400 text-sm">
                  Get comprehensive deal analysis in minutes, not hours. 
                  AI-powered extraction and benchmarking.
                </p>
              </div>

              <div className="card p-6 text-center">
                <div className="w-12 h-12 bg-success-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-lg font-semibold text-primary-100 mb-2">
                  Industry Benchmarks
                </h3>
                <p className="text-primary-400 text-sm">
                  Compare key metrics against sector medians and percentile rankings 
                  from our comprehensive database.
                </p>
              </div>

              <div className="card p-6 text-center">
                <div className="w-12 h-12 bg-warning-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-semibold text-primary-100 mb-2">
                  Risk Detection
                </h3>
                <p className="text-primary-400 text-sm">
                  Automatically identify inconsistencies, red flags, and areas 
                  requiring deeper due diligence.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ProcessingStatus
            stage={processingStage}
            progress={processingProgress}
            onCancel={() => setIsProcessing(false)}
          />
        )}
      </main>
    </div>
  );
}