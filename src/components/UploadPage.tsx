import React, { useState, useCallback } from 'react';
import { Upload, FileText, Mic, Archive, Settings } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { UploadedFile } from '../types';

interface UploadPageProps {
  onGenerateMemo: (files: UploadedFile[], includePublicData: boolean, analystFocus: string) => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onGenerateMemo }) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [includePublicData, setIncludePublicData] = useState(true);
  const [analystFocus, setAnalystFocus] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      type: getFileType(file.name),
      file,
      status: 'uploaded'
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const getFileType = (filename: string): UploadedFile['type'] => {
    const ext = filename.toLowerCase();
    if (ext.includes('.pdf') || ext.includes('.ppt')) return 'pitch-deck';
    if (ext.includes('.txt') || ext.includes('.doc')) return 'transcript';
    if (ext.includes('.zip')) return 'updates';
    return 'pitch-deck';
  };

  const getFileIcon = (type: UploadedFile['type']) => {
    switch (type) {
      case 'pitch-deck': return <FileText className="w-5 h-5 text-blue-600" />;
      case 'transcript': return <Mic className="w-5 h-5 text-green-600" />;
      case 'updates': return <Archive className="w-5 h-5 text-orange-600" />;
      default: return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
  };

  const handleGenerate = () => {
    if (uploadedFiles.length > 0) {
      onGenerateMemo(uploadedFiles, includePublicData, analystFocus);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Project Aegis
          </h1>
          <p className="text-xl text-gray-600 font-medium">
            AI Investment Analyst
          </p>
          <p className="text-gray-500 mt-2">
            Upload startup materials to generate comprehensive deal memos
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="h-fit">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Upload Materials</h2>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Support for PDF, PPT, TXT, DOC, ZIP files
              </p>
              
              <input
                type="file"
                multiple
                accept=".pdf,.ppt,.pptx,.txt,.doc,.docx,.zip"
                onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer">
                  Choose Files
                </Button>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-3">Uploaded Files</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file.type)}
                        <span className="text-sm text-gray-900">{file.name}</span>
                      </div>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Configuration Section */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Analysis Configuration</h2>
            
            <div className="space-y-6">
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={includePublicData}
                    onChange={(e) => setIncludePublicData(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Include Public Data</span>
                    <p className="text-xs text-gray-500">Market research, team backgrounds, news analysis</p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Analyst Focus (Optional)
                </label>
                <textarea
                  value={analystFocus}
                  onChange={(e) => setAnalystFocus(e.target.value)}
                  placeholder="e.g., Deep dive on unit economics and customer retention metrics"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                  rows={3}
                />
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleGenerate}
                  disabled={uploadedFiles.length === 0}
                  size="lg"
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Generate Deal Memo
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};