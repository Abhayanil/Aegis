'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock, AlertCircle, X } from 'lucide-react';

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
        return <CheckCircle className="w-5 h-5 text-success-400" />;
      case 'active':
        return (
          <div className="w-5 h-5 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
        );
      case 'error':
        return <AlertCircle className="w-5 h-5 text-danger-400" />;
      default:
        return <Clock className="w-5 h-5 text-primary-500" />;
    }
  };

  const getStepTextColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'complete':
        return 'text-success-400';
      case 'active':
        return 'text-accent-400';
      case 'error':
        return 'text-danger-400';
      default:
        return 'text-primary-500';
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary-100 mb-4">
          Analyzing Your Documents
        </h2>
        <p className="text-primary-400">
          Our AI is processing your documents to generate a comprehensive deal analysis.
          This typically takes 1-2 minutes.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary-300">Progress</span>
          <span className="text-sm font-medium text-primary-300">{progress}%</span>
        </div>
        <div className="progress-bar h-3">
          <div 
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Processing Steps */}
      <div className="card p-6 mb-8">
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
                  {step.status === 'active' && (
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-accent-400 rounded-full animate-pulse"></div>
                      <div className="w-1 h-1 bg-accent-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1 h-1 bg-accent-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-primary-500 mt-1">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Stage Info */}
      <div className="card p-4 mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-primary-300">
            Current stage: <span className="text-accent-400 font-medium">{stage}</span>
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-4">
          <h4 className="font-medium text-primary-200 mb-2">🔍 What we're analyzing</h4>
          <ul className="text-sm text-primary-400 space-y-1">
            <li>• Company metrics and financials</li>
            <li>• Market opportunity and competition</li>
            <li>• Team background and experience</li>
            <li>• Growth potential and risks</li>
          </ul>
        </div>

        <div className="card p-4">
          <h4 className="font-medium text-primary-200 mb-2">📊 What you'll get</h4>
          <ul className="text-sm text-primary-400 space-y-1">
            <li>• Signal score and recommendation</li>
            <li>• Industry benchmark comparisons</li>
            <li>• Risk assessment matrix</li>
            <li>• Due diligence questions</li>
          </ul>
        </div>
      </div>

      {/* Cancel Button */}
      <div className="text-center">
        <button
          onClick={onCancel}
          className="btn-ghost text-primary-400 hover:text-primary-300"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel Analysis
        </button>
      </div>

      {/* Background Animation */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-success-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
}