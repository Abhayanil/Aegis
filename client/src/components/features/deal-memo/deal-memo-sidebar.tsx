'use client';

import { useState } from 'react';
import { X, FileText, Sliders, Eye, Settings } from 'lucide-react';
import { AnalysisWeightings } from '@/types';
import { WeightingSliders } from './weighting-sliders';
import { DocumentHub } from './document-hub';

interface DealMemoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  weightings: AnalysisWeightings;
  onWeightingChange: (weightings: AnalysisWeightings) => void;
  activeDocument: string | null;
  onDocumentChange: (documentId: string | null) => void;
}

type SidebarTab = 'documents' | 'weightings' | 'settings';

export function DealMemoSidebar({
  isOpen,
  onClose,
  weightings,
  onWeightingChange,
  activeDocument,
  onDocumentChange,
}: DealMemoSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('documents');

  if (!isOpen) return null;

  const tabs = [
    {
      id: 'documents' as SidebarTab,
      label: 'Documents',
      icon: FileText,
      count: 3, // This would be dynamic based on actual documents
    },
    {
      id: 'weightings' as SidebarTab,
      label: 'Weightings',
      icon: Sliders,
    },
    {
      id: 'settings' as SidebarTab,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-88 bg-dark-900 border-l border-primary-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-primary-800">
        <h2 className="text-lg font-semibold text-primary-100">
          Analysis Tools
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-primary-400 hover:text-primary-200 hover:bg-primary-800 rounded-lg transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-primary-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center space-x-2 py-3 px-2 text-sm font-medium transition-colors duration-200
                ${isActive 
                  ? 'text-accent-400 border-b-2 border-accent-400 bg-accent-500/5' 
                  : 'text-primary-400 hover:text-primary-200 hover:bg-primary-800/50'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count && (
                <span className="bg-primary-700 text-primary-300 text-xs px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'documents' && (
          <DocumentHub
            activeDocument={activeDocument}
            onDocumentChange={onDocumentChange}
          />
        )}
        
        {activeTab === 'weightings' && (
          <WeightingSliders
            weightings={weightings}
            onWeightingChange={onWeightingChange}
          />
        )}
        
        {activeTab === 'settings' && (
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-primary-200 mb-3">
                  Display Options
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Show percentile ranks</span>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Expand high-priority risks</span>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Show source references</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-primary-200 mb-3">
                  Analysis Options
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Include benchmarking</span>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Risk assessment</span>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Competitive analysis</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-primary-200 mb-3">
                  Export Settings
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Include source data</span>
                  </label>
                  
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded border-primary-600 bg-primary-800 text-accent-500 focus:ring-accent-500 focus:ring-offset-dark-900"
                    />
                    <span className="text-sm text-primary-300">Include charts</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-primary-800">
        <div className="text-xs text-primary-500 text-center">
          Analysis powered by Aegis AI
        </div>
      </div>
    </div>
  );
}