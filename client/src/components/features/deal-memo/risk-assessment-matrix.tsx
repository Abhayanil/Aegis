'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Risk } from '@/types';
import { getRiskColor } from '@/lib/utils';

interface RiskAssessmentMatrixProps {
  riskAssessment: {
    highPriorityRisks: Risk[];
    mediumPriorityRisks: Risk[];
  };
  onSourceClick: (source: string) => void;
}

export function RiskAssessmentMatrix({ riskAssessment, onSourceClick }: RiskAssessmentMatrixProps) {
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(
    new Set(riskAssessment.highPriorityRisks.map((_, index) => `high-${index}`))
  );

  const toggleRisk = (riskId: string) => {
    const newExpanded = new Set(expandedRisks);
    if (newExpanded.has(riskId)) {
      newExpanded.delete(riskId);
    } else {
      newExpanded.add(riskId);
    }
    setExpandedRisks(newExpanded);
  };

  const getRiskIcon = (severity: string) => {
    return <AlertTriangle className={`w-4 h-4 ${
      severity === 'HIGH' ? 'text-danger-400' :
      severity === 'MEDIUM' ? 'text-warning-400' : 'text-primary-400'
    }`} />;
  };

  const RiskCard = ({ risk, index, priority }: { risk: Risk; index: number; priority: 'high' | 'medium' }) => {
    const riskId = `${priority}-${index}`;
    const isExpanded = expandedRisks.has(riskId);

    return (
      <div className={`card border-l-4 ${getRiskColor(risk.severity)} transition-all duration-200`}>
        <div 
          className="p-4 cursor-pointer"
          onClick={() => toggleRisk(riskId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getRiskIcon(risk.severity)}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-semibold text-primary-100">
                    {risk.type.replace(/_/g, ' ')}
                  </h4>
                  <span className={`
                    px-2 py-1 text-xs font-medium rounded-full
                    ${risk.severity === 'HIGH' ? 'bg-danger-500/20 text-danger-300' :
                      risk.severity === 'MEDIUM' ? 'bg-warning-500/20 text-warning-300' :
                      'bg-primary-500/20 text-primary-300'}
                  `}>
                    {risk.severity} PRIORITY
                  </span>
                </div>
                <p className="text-sm text-primary-300 leading-relaxed">
                  {risk.description}
                </p>
              </div>
            </div>
            
            <button className="ml-4 p-1 text-primary-400 hover:text-primary-200 transition-colors">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-primary-800/50 mt-4 pt-4 animate-slide-up">
            {/* Affected Metrics */}
            {risk.affectedMetrics.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-primary-200 mb-2">
                  Affected Metrics
                </h5>
                <div className="flex flex-wrap gap-2">
                  {risk.affectedMetrics.map((metric, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-1 bg-primary-800 text-primary-300 text-xs rounded-md"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Mitigation */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-primary-200 mb-2">
                Suggested Mitigation
              </h5>
              <p className="text-sm text-primary-400 leading-relaxed">
                {risk.suggestedMitigation}
              </p>
            </div>

            {/* Source Documents */}
            {risk.sourceDocuments.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-primary-200 mb-2">
                  Source References
                </h5>
                <div className="space-y-1">
                  {risk.sourceDocuments.map((source, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSourceClick(source)}
                      className="flex items-center space-x-2 text-xs text-accent-400 hover:text-accent-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{source}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const allRisks = [...riskAssessment.highPriorityRisks, ...riskAssessment.mediumPriorityRisks];
  const riskCounts = {
    high: riskAssessment.highPriorityRisks.length,
    medium: riskAssessment.mediumPriorityRisks.length,
    total: allRisks.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="w-6 h-6 text-warning-400" />
          <h2 className="text-2xl font-bold text-primary-100">
            Risk Assessment Matrix
          </h2>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-danger-500 rounded-full"></div>
            <span className="text-primary-400">{riskCounts.high} High Priority</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-warning-500 rounded-full"></div>
            <span className="text-primary-400">{riskCounts.medium} Medium Priority</span>
          </div>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="card p-6 bg-gradient-to-r from-warning-500/5 to-danger-500/5 border-warning-500/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-danger-400 mb-1">
              {riskCounts.high}
            </div>
            <div className="text-sm text-primary-400">
              High Priority Risks
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-warning-400 mb-1">
              {riskCounts.medium}
            </div>
            <div className="text-sm text-primary-400">
              Medium Priority Risks
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-300 mb-1">
              {riskCounts.total}
            </div>
            <div className="text-sm text-primary-400">
              Total Identified Risks
            </div>
          </div>
        </div>
      </div>

      {/* High Priority Risks */}
      {riskAssessment.highPriorityRisks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-danger-300 mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>High Priority Risks</span>
          </h3>
          <div className="space-y-4">
            {riskAssessment.highPriorityRisks.map((risk, index) => (
              <RiskCard 
                key={`high-${index}`}
                risk={risk} 
                index={index} 
                priority="high" 
              />
            ))}
          </div>
        </div>
      )}

      {/* Medium Priority Risks */}
      {riskAssessment.mediumPriorityRisks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-warning-300 mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Medium Priority Risks</span>
          </h3>
          <div className="space-y-4">
            {riskAssessment.mediumPriorityRisks.map((risk, index) => (
              <RiskCard 
                key={`medium-${index}`}
                risk={risk} 
                index={index} 
                priority="medium" 
              />
            ))}
          </div>
        </div>
      )}

      {/* No Risks Message */}
      {allRisks.length === 0 && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-success-400" />
          </div>
          <h3 className="text-lg font-semibold text-primary-100 mb-2">
            No Significant Risks Identified
          </h3>
          <p className="text-primary-400">
            The analysis did not identify any high or medium priority risks based on the available information.
          </p>
        </div>
      )}
    </div>
  );
}