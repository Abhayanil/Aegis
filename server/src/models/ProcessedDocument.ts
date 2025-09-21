// Processed document data model
import { DocumentType, ProcessingStatus } from '../types/enums.js';
import { DocumentMetadata, DocumentSection, BaseEntity, ValidationResult } from '../types/interfaces.js';

export interface ProcessedDocument extends BaseEntity {
  sourceType: DocumentType;
  extractedText: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
  processingTimestamp: Date;
  processingDuration?: number;
  wordCount?: number;
  language?: string;
  encoding?: string;
  extractionMethod?: 'text' | 'ocr' | 'hybrid';
  quality?: {
    textClarity: number;
    structurePreservation: number;
    completeness: number;
  };
}

export interface ProcessedDocumentInput {
  sourceType: DocumentType;
  extractedText: string;
  sections: DocumentSection[];
  metadata: DocumentMetadata;
  processingDuration?: number;
  wordCount?: number;
  language?: string;
  encoding?: string;
  extractionMethod?: 'text' | 'ocr' | 'hybrid';
  quality?: {
    textClarity: number;
    structurePreservation: number;
    completeness: number;
  };
}

export interface DocumentProcessingResult {
  document: ProcessedDocument;
  validation: ValidationResult;
  processingLogs: string[];
  warnings: string[];
}