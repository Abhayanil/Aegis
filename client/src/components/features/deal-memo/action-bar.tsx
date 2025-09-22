'use client';

import { useState } from 'react';
import { 
  Download, 
  Share2, 
  Save, 
  Menu, 
  X, 
  FileText, 
  Database,
  Printer,
  Copy
} from 'lucide-react';
import { DealMemo } from '@/types';
import { api } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';

interface ActionBarProps {
  dealMemo: DealMemo;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function ActionBar({ dealMemo, onToggleSidebar, sidebarOpen }: ActionBarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleExport = async (format: 'json' | 'pdf' | 'docx') => {
    setIsExporting(true);
    setExportMenuOpen(false);

    try {
      // For now, we'll use a mock deal memo ID
      // In a real implementation, this would come from the URL or state
      const dealMemoId = 'current-deal-memo';
      
      const response = await api.exportDealMemo(dealMemoId, {
        format,
        includeSourceData: true,
        includeCharts: true,
      });

      // Handle the export response
      if (response.data.downloadUrl) {
        // If we have a download URL, open it
        window.open(response.data.downloadUrl, '_blank');
      } else {
        // If we have export data, create a blob and download
        const blob = new Blob([JSON.stringify(response.data.exportData, null, 2)], {
          type: format === 'json' ? 'application/json' : 'application/octet-stream',
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      // You might want to show a toast notification here
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToCRM = () => {
    // This would integrate with CRM systems like Salesforce, HubSpot, etc.
    console.log('Save to CRM functionality would be implemented here');
  };

  const handleShare = async () => {
    const shareData = {
      title: `Deal Analysis: ${dealMemo.aegisDealMemo.summary.companyName}`,
      text: `${dealMemo.aegisDealMemo.summary.oneLiner} - Signal Score: ${dealMemo.aegisDealMemo.summary.signalScore}/10`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // Fallback to copying URL
        await copyToClipboard(window.location.href);
      }
    } else {
      // Fallback to copying URL
      await copyToClipboard(window.location.href);
    }
  };

  return (
    <div className="sticky top-0 z-40 bg-dark-900/95 backdrop-blur-sm border-b border-primary-800">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-primary-400 hover:text-primary-200 hover:bg-primary-800 rounded-lg transition-colors duration-200"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-primary-100">
              {dealMemo.aegisDealMemo.summary.companyName}
            </h1>
            <p className="text-sm text-primary-400">
              Deal Analysis Report
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3">
          {/* Save to CRM */}
          <button
            onClick={handleSaveToCRM}
            className="btn-ghost flex items-center space-x-2"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Save to CRM</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="btn-ghost flex items-center space-x-2"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="btn-primary flex items-center space-x-2"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export</span>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-dark-800 border border-primary-700 rounded-lg shadow-xl z-50">
                <div className="py-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2 text-left text-sm text-primary-300 hover:bg-primary-700 hover:text-primary-100 flex items-center space-x-3"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Export as PDF</span>
                  </button>
                  
                  <button
                    onClick={() => handleExport('docx')}
                    className="w-full px-4 py-2 text-left text-sm text-primary-300 hover:bg-primary-700 hover:text-primary-100 flex items-center space-x-3"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Export as DOCX</span>
                  </button>
                  
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm text-primary-300 hover:bg-primary-700 hover:text-primary-100 flex items-center space-x-3"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Export as JSON</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close export menu */}
      {exportMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setExportMenuOpen(false)}
        />
      )}
    </div>
  );
}