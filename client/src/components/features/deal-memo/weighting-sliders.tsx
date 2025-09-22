'use client';

import { useState, useEffect } from 'react';
import { AnalysisWeightings } from '@/types';
import { RotateCcw, Info } from 'lucide-react';

interface WeightingSlidersProps {
  weightings: AnalysisWeightings;
  onWeightingChange: (weightings: AnalysisWeightings) => void;
}

export function WeightingSliders({ weightings, onWeightingChange }: WeightingSlidersProps) {
  const [localWeightings, setLocalWeightings] = useState<AnalysisWeightings>(weightings);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setLocalWeightings(weightings);
  }, [weightings]);

  const handleSliderChange = (metric: keyof AnalysisWeightings, value: number) => {
    const newWeightings = { ...localWeightings, [metric]: value };
    
    // Ensure total doesn't exceed 100
    const total = Object.values(newWeightings).reduce((sum, val) => sum + val, 0);
    if (total <= 100) {
      setLocalWeightings(newWeightings);
      
      // Debounced update to parent
      setIsUpdating(true);
      setTimeout(() => {
        onWeightingChange(newWeightings);
        setIsUpdating(false);
      }, 500);
    }
  };

  const resetToDefaults = () => {
    const defaultWeightings: AnalysisWeightings = {
      marketOpportunity: 25,
      team: 25,
      traction: 20,
      product: 15,
      competitivePosition: 15,
    };
    
    setLocalWeightings(defaultWeightings);
    onWeightingChange(defaultWeightings);
  };

  const totalWeight = Object.values(localWeightings).reduce((sum, val) => sum + val, 0);
  const isValidTotal = totalWeight === 100;

  const sliderConfigs = [
    {
      key: 'marketOpportunity' as keyof AnalysisWeightings,
      label: 'Market Opportunity',
      description: 'Market size, growth potential, and timing',
      color: 'accent',
    },
    {
      key: 'team' as keyof AnalysisWeightings,
      label: 'Team',
      description: 'Founder experience and team composition',
      color: 'success',
    },
    {
      key: 'traction' as keyof AnalysisWeightings,
      label: 'Traction',
      description: 'Revenue, customers, and growth metrics',
      color: 'warning',
    },
    {
      key: 'product' as keyof AnalysisWeightings,
      label: 'Product',
      description: 'Product-market fit and differentiation',
      color: 'primary',
    },
    {
      key: 'competitivePosition' as keyof AnalysisWeightings,
      label: 'Competitive Position',
      description: 'Competitive advantages and moats',
      color: 'danger',
    },
  ];

  const getSliderColor = (color: string) => {
    const colors = {
      accent: 'accent-500',
      success: 'success-500',
      warning: 'warning-500',
      primary: 'primary-500',
      danger: 'danger-500',
    };
    return colors[color as keyof typeof colors] || 'primary-500';
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary-100">
            Analysis Weightings
          </h3>
          <p className="text-sm text-primary-400 mt-1">
            Adjust the importance of each factor
          </p>
        </div>
        
        <button
          onClick={resetToDefaults}
          className="p-2 text-primary-400 hover:text-primary-200 hover:bg-primary-800 rounded-lg transition-colors duration-200"
          title="Reset to defaults"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Total Weight Indicator */}
      <div className={`
        p-3 rounded-lg border
        ${isValidTotal 
          ? 'bg-success-500/10 border-success-500/20 text-success-300' 
          : 'bg-warning-500/10 border-warning-500/20 text-warning-300'
        }
      `}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total Weight</span>
          <span className="font-bold">{totalWeight}%</span>
        </div>
        {!isValidTotal && (
          <p className="text-xs mt-1 opacity-80">
            Total must equal 100%
          </p>
        )}
      </div>

      {/* Sliders */}
      <div className="space-y-6">
        {sliderConfigs.map((config) => {
          const value = localWeightings[config.key];
          const colorClass = getSliderColor(config.color);
          
          return (
            <div key={config.key} className="space-y-3">
              {/* Label and Value */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-primary-200">
                    {config.label}
                  </label>
                  <p className="text-xs text-primary-500 mt-0.5">
                    {config.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary-100">
                    {value}%
                  </span>
                </div>
              </div>

              {/* Slider */}
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={value}
                  onChange={(e) => handleSliderChange(config.key, parseInt(e.target.value))}
                  className={`
                    w-full h-2 bg-primary-800 rounded-lg appearance-none cursor-pointer
                    slider-${config.color}
                  `}
                  style={{
                    background: `linear-gradient(to right, rgb(var(--color-${colorClass.replace('-500', '')})) 0%, rgb(var(--color-${colorClass.replace('-500', '')})) ${(value / 50) * 100}%, rgb(var(--color-primary-800)) ${(value / 50) * 100}%, rgb(var(--color-primary-800)) 100%)`,
                  }}
                />
                
                {/* Tick marks */}
                <div className="flex justify-between text-xs text-primary-600 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Update Status */}
      {isUpdating && (
        <div className="flex items-center space-x-2 text-sm text-accent-400">
          <div className="w-4 h-4 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />
          <span>Updating analysis...</span>
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 bg-primary-900/30 rounded-lg border border-primary-800">
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-primary-400 leading-relaxed">
            <p className="font-medium mb-1">How weightings work:</p>
            <p>
              Adjust sliders to reflect your investment thesis. Higher weights give more 
              influence to that factor in the overall signal score calculation.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Configurations */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-primary-200">
          Quick Presets
        </h4>
        
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => onWeightingChange({
              marketOpportunity: 40,
              team: 20,
              traction: 20,
              product: 10,
              competitivePosition: 10,
            })}
            className="p-2 text-left text-xs bg-primary-800/50 hover:bg-primary-700 rounded border border-primary-700 transition-colors duration-200"
          >
            <div className="font-medium text-primary-200">Market-Focused</div>
            <div className="text-primary-500">Emphasizes market opportunity</div>
          </button>
          
          <button
            onClick={() => onWeightingChange({
              marketOpportunity: 15,
              team: 40,
              traction: 25,
              product: 10,
              competitivePosition: 10,
            })}
            className="p-2 text-left text-xs bg-primary-800/50 hover:bg-primary-700 rounded border border-primary-700 transition-colors duration-200"
          >
            <div className="font-medium text-primary-200">Team-Focused</div>
            <div className="text-primary-500">Emphasizes founder strength</div>
          </button>
          
          <button
            onClick={() => onWeightingChange({
              marketOpportunity: 20,
              team: 20,
              traction: 40,
              product: 10,
              competitivePosition: 10,
            })}
            className="p-2 text-left text-xs bg-primary-800/50 hover:bg-primary-700 rounded border border-primary-700 transition-colors duration-200"
          >
            <div className="font-medium text-primary-200">Traction-Focused</div>
            <div className="text-primary-500">Emphasizes current metrics</div>
          </button>
        </div>
      </div>
    </div>
  );
}