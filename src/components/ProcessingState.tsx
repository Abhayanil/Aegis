import React, { useState, useEffect } from 'react';
import { ProgressBar } from './ui/ProgressBar';
import { Card } from './ui/Card';

interface ProcessingStateProps {
  onComplete: () => void;
  complete?: boolean; // when true, finish immediately and call onComplete
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({ onComplete, complete = false }) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    "Parsing uploaded documents...",
    "Extracting key metrics and data points...",
    "Benchmarking against sector data...",
    "Analyzing growth potential and risks...",
    "Generating investment recommendations...",
    "Finalizing deal memo structure..."
  ];

  useEffect(() => {
    if (complete) {
      setProgress(100);
      const t = setTimeout(onComplete, 300);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => {
      setProgress(prev => Math.min(99, prev + Math.random() * 15));
    }, 600);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, [onComplete, complete]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md text-center" padding="lg">
        <div className="mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Analyzing Materials
          </h2>
          
          <p className="text-gray-600 text-sm mb-6">
            {steps[currentStep]}
          </p>
        </div>

        <div className="space-y-4">
          <ProgressBar progress={progress} />
          <p className="text-sm text-gray-500">
            {Math.round(progress)}% complete
          </p>
        </div>

        <div className="mt-8 text-xs text-gray-400">
          This may take 2-3 minutes for comprehensive analysis
        </div>
      </Card>
    </div>
  );
};