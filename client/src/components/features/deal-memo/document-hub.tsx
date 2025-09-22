'use client';

import { useState } from 'react';
import { FileText, Eye, Download, Search, Filter } from 'lucide-react';
import { DocumentThumbnail } from '@/types';
import { formatFileSize, getFileTypeIcon } from '@/lib/utils';

interface DocumentHubProps {
  activeDocument: string | null;
  onDocumentChange: (documentId: string | null) => void;
}

export function DocumentHub({ activeDocument, onDocumentChange }: DocumentHubProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Mock documents - in a real app, these would come from props or API
  const documents: DocumentThumbnail[] = [
    {
      id: 'doc-1',
      filename: 'TestCorp_Pitch_Deck.pdf',
      type: 'application/pdf',
      pageCount: 15,
      highlights: [
        {
          page: 3,
          text: '$2M ARR with 15% month-over-month growth',
          context: 'Revenue metrics slide showing strong growth trajectory',
        },
        {
          page: 7,
          text: 'Team of 25 people including experienced founders',
          context: 'Team overview with founder backgrounds',
        },
        {
          page: 12,
          text: '$50B total addressable market',
          context: 'Market size analysis and opportunity assessment',
        },
      ],
    },
    {
      id: 'doc-2',
      filename: 'Founder_Interview_Transcript.txt',
      type: 'text/plain',
      highlights: [
        {
          page: 1,
          text: 'We currently have 150 enterprise customers',
          context: 'Customer traction discussion at 04:32',
        },
        {
          page: 1,
          text: 'Raising $5M Series A to expand sales team',
          context: 'Funding discussion at 12:15',
        },
      ],
    },
    {
      id: 'doc-3',
      filename: 'Financial_Statements_Q3.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pageCount: 8,
      highlights: [
        {
          page: 2,
          text: '95% customer retention rate',
          context: 'Customer metrics and churn analysis',
        },
        {
          page: 5,
          text: '$180K customer lifetime value',
          context: 'Unit economics and profitability metrics',
        },
      ],
    },
  ];

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.highlights?.some(h => h.text.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'pdf' && doc.type.includes('pdf')) ||
                         (filterType === 'text' && doc.type.includes('text')) ||
                         (filterType === 'word' && doc.type.includes('word'));
    
    return matchesSearch && matchesFilter;
  });

  const handleDocumentClick = (documentId: string) => {
    onDocumentChange(documentId === activeDocument ? null : documentId);
  };

  const handleHighlightClick = (documentId: string, page: number) => {
    onDocumentChange(documentId);
    // In a real implementation, this would scroll to the specific page/location
    console.log(`Navigate to document ${documentId}, page ${page}`);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-primary-100 mb-1">
          Source Documents
        </h3>
        <p className="text-sm text-primary-400">
          {documents.length} documents analyzed
        </p>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary-500" />
          <input
            type="text"
            placeholder="Search documents or highlights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-primary-800 border border-primary-700 rounded-lg text-primary-100 placeholder-primary-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-primary-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-primary-800 border border-primary-700 rounded text-sm text-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="all">All Types</option>
            <option value="pdf">PDF Files</option>
            <option value="word">Word Documents</option>
            <option value="text">Text Files</option>
          </select>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-3">
        {filteredDocuments.map((doc) => (
          <div key={doc.id} className="space-y-2">
            {/* Document Card */}
            <div
              className={`
                p-3 rounded-lg border cursor-pointer transition-all duration-200
                ${activeDocument === doc.id
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-primary-700 bg-primary-800/50 hover:border-primary-600 hover:bg-primary-800'
                }
              `}
              onClick={() => handleDocumentClick(doc.id)}
            >
              <div className="flex items-start space-x-3">
                <div className="text-lg flex-shrink-0">
                  {getFileTypeIcon(doc.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-primary-200 text-sm truncate">
                    {doc.filename}
                  </h4>
                  
                  <div className="flex items-center space-x-3 mt-1 text-xs text-primary-500">
                    {doc.pageCount && (
                      <span>{doc.pageCount} pages</span>
                    )}
                    <span>{doc.highlights?.length || 0} highlights</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDocumentClick(doc.id);
                    }}
                    className="p-1 text-primary-400 hover:text-accent-400 transition-colors"
                    title="View document"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle download
                    }}
                    className="p-1 text-primary-400 hover:text-success-400 transition-colors"
                    title="Download document"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Highlights (shown when document is active) */}
            {activeDocument === doc.id && doc.highlights && doc.highlights.length > 0 && (
              <div className="ml-4 space-y-2 animate-slide-up">
                <h5 className="text-xs font-medium text-primary-300 uppercase tracking-wide">
                  Key Highlights
                </h5>
                
                {doc.highlights.map((highlight, index) => (
                  <button
                    key={index}
                    onClick={() => handleHighlightClick(doc.id, highlight.page)}
                    className="w-full p-3 text-left bg-primary-900/30 border border-primary-800 rounded-lg hover:border-accent-500/30 hover:bg-accent-500/5 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-accent-400 font-medium">
                        {doc.pageCount ? `Page ${highlight.page}` : `Line ${highlight.page}`}
                      </span>
                    </div>
                    
                    <p className="text-sm text-primary-200 font-medium mb-1">
                      "{highlight.text}"
                    </p>
                    
                    <p className="text-xs text-primary-500">
                      {highlight.context}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredDocuments.length === 0 && (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-primary-600 mx-auto mb-3" />
          <p className="text-primary-500 text-sm">
            {searchQuery ? 'No documents match your search' : 'No documents found'}
          </p>
        </div>
      )}

      {/* Document Stats */}
      <div className="pt-4 border-t border-primary-800">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-accent-400">
              {documents.reduce((sum, doc) => sum + (doc.highlights?.length || 0), 0)}
            </div>
            <div className="text-xs text-primary-500">
              Total Highlights
            </div>
          </div>
          
          <div>
            <div className="text-lg font-bold text-success-400">
              {documents.reduce((sum, doc) => sum + (doc.pageCount || 1), 0)}
            </div>
            <div className="text-xs text-primary-500">
              Total Pages
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}