'use client';

import { useState, useEffect } from 'react';
import { AnalysisWeightings } from '@/types';
import { SettingsIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

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

  const handleSliderChange = (metric: keyof AnalysisWeightings, values: number[]) => {
    const value = values[0];
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon size={20} />
            <div>
              <div>Analysis Weightings</div>
              <p className="text-sm font-normal text-slate-400 mt-1">
                Adjust the importance of each factor
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            title="Reset to defaults"
          >
            Reset
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Weight Indicator */}
        <Card className={`p-3 ${
          isValidTotal 
            ? 'bg-green-500/10 border-green-500/20' 
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Weight</span>
            <span className={`font-bold ${
              isValidTotal ? 'text-green-400' : 'text-amber-400'
            }`}>
              {totalWeight}%
            </span>
          </div>
          {!isValidTotal && (
            <p className="text-xs mt-1 text-amber-400">
              Total must equal 100%
            </p>
          )}
        </Card>

        {/* Sliders */}
        <div className="space-y-6">
          {sliderConfigs.map((config) => {
            const value = localWeightings[config.key];
            
            return (
              <div key={config.key} className="space-y-3">
                {/* Label and Value */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-slate-200">
                      {config.label}
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {config.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-100">
                      {value}%
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <Slider
                    value={[value]}
                    onValueChange={(values) => handleSliderChange(config.key, values)}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                  
                  {/* Tick marks */}
                  <div className="flex justify-between text-xs text-slate-600">
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
          <div className="flex items-center space-x-2 text-sm text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span>Updating analysis...</span>
          </div>
        )}

        {/* Info Box */}
        <Card className="p-3 bg-slate-900/30 border-slate-700">
          <div className="text-xs text-slate-400 leading-relaxed">
            <p className="font-medium mb-1 text-slate-300">How weightings work:</p>
            <p>
              Adjust sliders to reflect your investment thesis. Higher weights give more 
              influence to that factor in the overall signal score calculation.
            </p>
          </div>
        </Card>

        {/* Preset Configurations */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-200">
            Quick Presets
          </h4>
          
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              onClick={() => onWeightingChange({
                marketOpportunity: 40,
                team: 20,
                traction: 20,
                product: 10,
                competitivePosition: 10,
              })}
              className="justify-start h-auto p-3"
            >
              <div className="text-left">
                <div className="font-medium text-slate-200">Market-Focused</div>
                <div className="text-xs text-slate-500">Emphasizes market opportunity</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => onWeightingChange({
                marketOpportunity: 15,
                team: 40,
                traction: 25,
                product: 10,
                competitivePosition: 10,
              })}
              className="justify-start h-auto p-3"
            >
              <div className="text-left">
                <div className="font-medium text-slate-200">Team-Focused</div>
                <div className="text-xs text-slate-500">Emphasizes founder strength</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => onWeightingChange({
                marketOpportunity: 20,
                team: 20,
                traction: 40,
                product: 10,
                competitivePosition: 10,
              })}
              className="justify-start h-auto p-3"
            >
              <div className="text-left">
                <div className="font-medium text-slate-200">Traction-Focused</div>
                <div className="text-xs text-slate-500">Emphasizes current metrics</div>
              </div>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}