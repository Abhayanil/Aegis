'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner, LoadingBar, LoadingDots } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { XIcon } from '@/components/ui/icons';

interface ProcessingStatusProps {
  stage: string;
  progress: number;
  onCancel: () => void;
}

interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

export function ProcessingStatus({ stage, progress, onCancel }: ProcessingStatusProps) {
  const [steps, setSteps] = useState<ProcessingStep[]>([
    {
      id: 'upload',
      label: 'Processing Files',
      description: 'Uploading and validating documents',
      status: 'pending',
    },
    {
      id: 'extract',
      label: 'Extracting Data',
      description: 'Reading text and identifying key information',
      status: 'pending',
    },
    {
      id: 'analyze',
      label: 'Analyzing with AI',
      description: 'Processing content with Gemini AI model',
      status: 'pending',
    },
    {
      id: 'benchmark',
      label: 'Benchmarking',
      description: 'Comparing metrics against industry data',
      status: 'pending',
    },
    {
      id: 'generate',
      label: 'Generating Report',
      description: 'Creating comprehensive deal memo',
      status: 'pending',
    },
  ]);

  useEffect(() => {
    setSteps(prevSteps => {
      return prevSteps.map((step, index) => {
        const stepProgress = (index + 1) * 20; // Each step is 20% of total progress
        
        if (progress >= stepProgress) {
          return { ...step, status: 'complete' };
        } else if (progress >= stepProgress - 20) {
          return { ...step, status: 'active' };
        } else {
          return { ...step, status: 'pending' };
        }
      });
    });
  }, [progress]);

  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'complete':
        return (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <div className="w-3 h-3 text-white">✓</div>
          </div>
        );
      case 'active':
        return <LoadingSpinner size="sm" />;
      case 'error':
        return (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <div className="w-3 h-3 text-white">!</div>
          </div>
        );
      default:
        return (
          <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
          </div>
        );
    }
  };

  const getStepTextColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'complete':
        return 'text-green-400';
      case 'active':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-100 mb-4">
          Analyzing Your Documents
        </h2>
        <p className="text-slate-400">
          Our AI is processing your documents to generate a comprehensive deal analysis.
          This typically takes 1-2 minutes.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">Progress</span>
          <span className="text-sm font-medium text-slate-300">{progress}%</span>
        </div>
        <LoadingBar progress={progress} />
      </div>

      {/* Processing Steps */}
      <Card className="p-6 mb-8">
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1">
                {getStepIcon(step.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className={`font-medium ${getStepTextColor(step.status)}`}>
                    {step.label}
                  </h3>
                  {step.status === 'active' && <LoadingDots size="sm" />}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Current Stage Info */}
      <Card className="p-4 mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-slate-300">
            Current stage: <span className="text-blue-400 font-medium">{stage}</span>
          </span>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="p-4">
          <h4 className="font-medium text-slate-200 mb-2">🔍 What we're analyzing</h4>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Company metrics and financials</li>
            <li>• Market opportunity and competition</li>
            <li>• Team background and experience</li>
            <li>• Growth potential and risks</li>
          </ul>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium text-slate-200 mb-2">📊 What you'll get</h4>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Signal score and recommendation</li>
            <li>• Industry benchmark comparisons</li>
            <li>• Risk assessment matrix</li>
            <li>• Due diligence questions</li>
          </ul>
        </Card>
      </div>

      {/* Cancel Button */}
      <div className="text-center">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-300"
        >
          <XIcon size={16} className="mr-2" />
          Cancel Analysis
        </Button>
      </div>

      {/* Background Animation */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
}