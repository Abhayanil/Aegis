'use client';

import { useState } from 'react';
import { AlertTriangleIcon, ChevronDownIcon, ChevronRightIcon, ShareIcon } from '@/components/ui/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Risk } from '@/types';

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
    return <AlertTriangleIcon size={16} className={
      severity === 'HIGH' ? 'text-red-400' :
      severity === 'MEDIUM' ? 'text-amber-400' : 'text-blue-400'
    } />;
  };

  const getRiskColor = (severity: string) => {
    return severity === 'HIGH' ? 'border-l-red-500' :
           severity === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-500';
  };

  const RiskCard = ({ risk, index, priority }: { risk: Risk; index: number; priority: 'high' | 'medium' }) => {
    const riskId = `${priority}-${index}`;
    const isExpanded = expandedRisks.has(riskId);

    return (
      <Card className={`border-l-4 ${getRiskColor(risk.severity)} transition-all duration-200`}>
        <div 
          className="p-4 cursor-pointer"
          onClick={() => toggleRisk(riskId)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getRiskIcon(risk.severity)}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-semibold text-slate-100">
                    {risk.type.replace(/_/g, ' ')}
                  </h4>
                  <Badge variant={
                    risk.severity === 'HIGH' ? 'destructive' :
                    risk.severity === 'MEDIUM' ? 'warning' : 'secondary'
                  }>
                    {risk.severity} PRIORITY
                  </Badge>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {risk.description}
                </p>
              </div>
            </div>
            
            <button className="ml-4 p-1 text-slate-400 hover:text-slate-200 transition-colors">
              {isExpanded ? (
                <ChevronDownIcon size={16} />
              ) : (
                <ChevronRightIcon size={16} />
              )}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-slate-700/50 mt-4 pt-4">
            {/* Affected Metrics */}
            {risk.affectedMetrics.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-slate-200 mb-2">
                  Affected Metrics
                </h5>
                <div className="flex flex-wrap gap-2">
                  {risk.affectedMetrics.map((metric, idx) => (
                    <Badge key={idx} variant="outline">
                      {metric}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Mitigation */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-slate-200 mb-2">
                Suggested Mitigation
              </h5>
              <p className="text-sm text-slate-400 leading-relaxed">
                {risk.suggestedMitigation}
              </p>
            </div>

            {/* Source Documents */}
            {risk.sourceDocuments.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-slate-200 mb-2">
                  Source References
                </h5>
                <div className="space-y-1">
                  {risk.sourceDocuments.map((source, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSourceClick(source)}
                      className="flex items-center space-x-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ShareIcon size={12} />
                      <span>{source}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  const allRisks = [...riskAssessment.highPriorityRisks, ...riskAssessment.mediumPriorityRisks];
  const riskCounts = {
    high: riskAssessment.highPriorityRisks.length,
    medium: riskAssessment.mediumPriorityRisks.length,
    total: allRisks.length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangleIcon size={20} className="text-amber-400" />
          Risk Assessment Matrix
          <div className="flex items-center space-x-4 text-sm ml-auto">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-slate-400">{riskCounts.high} High Priority</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span className="text-slate-400">{riskCounts.medium} Medium Priority</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk Summary */}
        <Card className="p-6 bg-gradient-to-r from-amber-500/5 to-red-500/5 border-amber-500/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400 mb-1">
                {riskCounts.high}
              </div>
              <div className="text-sm text-slate-400">
                High Priority Risks
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">
                {riskCounts.medium}
              </div>
              <div className="text-sm text-slate-400">
                Medium Priority Risks
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {riskCounts.total}
              </div>
              <div className="text-sm text-slate-400">
                Total Identified Risks
              </div>
            </div>
          </div>
        </Card>

        {/* High Priority Risks */}
        {riskAssessment.highPriorityRisks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-red-300 mb-4 flex items-center space-x-2">
              <AlertTriangleIcon size={20} />
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
            <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center space-x-2">
              <AlertTriangleIcon size={20} />
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
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangleIcon size={32} className="text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              No Significant Risks Identified
            </h3>
            <p className="text-slate-400">
              The analysis did not identify any high or medium priority risks based on the available information.
            </p>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}