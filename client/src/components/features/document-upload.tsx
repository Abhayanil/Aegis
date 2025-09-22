'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatFileSize, isValidFileType, getFileTypeIcon } from '@/lib/utils';
import { UploadResponse } from '@/types';

interface DocumentUploadProps {
  onUploadStart: () => void;
  onUploadSuccess: (response: UploadResponse) => void;
  onProcessingUpdate: (stage: string, progress: number) => void;
  onError: (error: string) => void;
}

interface FileWithPreview extends File {
  id: string;
  preview?: string;
}

export function DocumentUpload({
  onUploadStart,
  onUploadSuccess,
  onProcessingUpdate,
  onError,
}: DocumentUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError(null);

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errorMessages = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map((e: any) => e.message).join(', ')}`
      );
      setUploadError(`Some files were rejected: ${errorMessages.join('; ')}`);
    }

    // Add accepted files
    const newFiles = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substr(2, 9),
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.ms-powerpoint': ['.ppt'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadError('Please select at least one file to upload');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    onUploadStart();

    try {
      // Simulate processing stages for better UX
      onProcessingUpdate('Uploading files...', 10);
      
      const response = await api.uploadDocuments(files, {
        enableOCR: true,
        ocrLanguageHints: ['en'],
        ocrConfidenceThreshold: 0.8,
      });

      onProcessingUpdate('Processing documents...', 40);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      onProcessingUpdate('Extracting data...', 70);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      onProcessingUpdate('Analyzing content...', 90);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      onProcessingUpdate('Complete!', 100);

      onUploadSuccess(response);
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          dropzone p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'dropzone-active' : ''}
          ${isDragReject ? 'dropzone-reject' : ''}
          ${files.length > 0 ? 'border-accent-500 bg-accent-500/5' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-accent-500/10 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-accent-500" />
          </div>
          
          {isDragActive ? (
            <div>
              <h3 className="text-xl font-semibold text-accent-400 mb-2">
                Drop files here
              </h3>
              <p className="text-primary-400">
                Release to upload your documents
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-semibold text-primary-100 mb-2">
                Drop pitch deck or transcript here
              </h3>
              <p className="text-primary-400 mb-4">
                or click to browse files
              </p>
              <div className="text-sm text-primary-500">
                Supports PDF, DOCX, PPTX, TXT • Max 50MB per file • Up to 10 files
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="mt-4 p-4 bg-danger-500/10 border border-danger-500/20 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-danger-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-danger-300 mb-1">Upload Error</h4>
            <p className="text-sm text-danger-400">{uploadError}</p>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-primary-100">
              Selected Files ({files.length})
            </h4>
            <div className="text-sm text-primary-400">
              Total: {formatFileSize(totalSize)}
            </div>
          </div>

          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-dark-800 rounded-lg border border-primary-700"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-lg">
                    {getFileTypeIcon(file.type)}
                  </div>
                  <div>
                    <div className="font-medium text-primary-100 text-sm">
                      {file.name}
                    </div>
                    <div className="text-xs text-primary-400">
                      {formatFileSize(file.size)} • {file.type.split('/')[1].toUpperCase()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 text-primary-400 hover:text-danger-400 transition-colors duration-200"
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
              className="btn-primary px-8 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Analyze Documents</span>
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Tips */}
      <div className="mt-8 p-4 bg-primary-900/20 rounded-lg border border-primary-800">
        <h4 className="font-medium text-primary-200 mb-2">💡 Tips for best results</h4>
        <ul className="text-sm text-primary-400 space-y-1">
          <li>• Include pitch decks, financial statements, and transcripts</li>
          <li>• Ensure documents contain key metrics (revenue, customers, team size)</li>
          <li>• Clear, high-quality PDFs work better than scanned images</li>
          <li>• Multiple documents provide more comprehensive analysis</li>
        </ul>
      </div>
    </div>
  );
}