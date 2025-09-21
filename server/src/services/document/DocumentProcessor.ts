// Document processor factory for handling multiple file formats
import { DocumentType } from '../../types/enums.js';
import { ProcessedDocument, DocumentProcessingResult } from '../../models/ProcessedDocument.js';
import { DocumentMetadata, ValidationResult } from '../../types/interfaces.js';
import { PDFParser } from './parsers/PDFParser.js';
import { DOCXParser } from './parsers/DOCXParser.js';
import { PPTXParser } from './parsers/PPTXParser.js';
import { TXTParser } from './parsers/TXTParser.js';
import { BaseParser } from './parsers/BaseParser.js';

export interface DocumentProcessor {
  processDocument(file: Buffer, filename: string, mimeType: string): Promise<DocumentProcessingResult>;
  validateContent(document: ProcessedDocument): ValidationResult;
  detectFileType(filename: string, mimeType: string): DocumentType;
}

export interface DocumentProcessorOptions {
  enableOCR?: boolean;
  ocrLanguageHints?: string[];
  ocrConfidenceThreshold?: number;
}

export class DocumentProcessorFactory implements DocumentProcessor {
  private parsers: Map<DocumentType, BaseParser>;
  private options: DocumentProcessorOptions;

  constructor(options: DocumentProcessorOptions = {}) {
    this.options = {
      enableOCR: false,
      ocrLanguageHints: ['en'],
      ocrConfidenceThreshold: 0.5,
      ...options,
    };

    this.parsers = new Map([
      [DocumentType.PDF, new PDFParser(this.options.enableOCR)],
      [DocumentType.DOCX, new DOCXParser()],
      [DocumentType.PPTX, new PPTXParser()],
      [DocumentType.TXT, new TXTParser()],
    ]);
  }

  /**
   * Detects file type based on filename extension and MIME type
   */
  detectFileType(filename: string, mimeType: string): DocumentType {
    const extension = filename.toLowerCase().split('.').pop();
    
    // Primary detection by MIME type
    const mimeTypeMap: Record<string, DocumentType> = {
      'application/pdf': DocumentType.PDF,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentType.DOCX,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': DocumentType.PPTX,
      'text/plain': DocumentType.TXT,
      'application/msword': DocumentType.DOCX,
      'application/vnd.ms-powerpoint': DocumentType.PPTX,
    };

    if (mimeType && mimeTypeMap[mimeType]) {
      return mimeTypeMap[mimeType];
    }

    // Fallback to extension-based detection
    const extensionMap: Record<string, DocumentType> = {
      'pdf': DocumentType.PDF,
      'docx': DocumentType.DOCX,
      'doc': DocumentType.DOCX,
      'pptx': DocumentType.PPTX,
      'ppt': DocumentType.PPTX,
      'txt': DocumentType.TXT,
    };

    if (extension && extensionMap[extension]) {
      return extensionMap[extension];
    }

    throw new Error(`Unsupported file type: ${filename} (${mimeType})`);
  }

  /**
   * Processes a document using the appropriate parser
   */
  async processDocument(
    file: Buffer, 
    filename: string, 
    mimeType: string
  ): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    const processingLogs: string[] = [];
    const warnings: string[] = [];

    try {
      // Detect file type
      const fileType = this.detectFileType(filename, mimeType);
      processingLogs.push(`Detected file type: ${fileType}`);

      // Get appropriate parser
      const parser = this.parsers.get(fileType);
      if (!parser) {
        throw new Error(`No parser available for file type: ${fileType}`);
      }

      // Create metadata
      const metadata: DocumentMetadata = {
        filename,
        fileSize: file.length,
        mimeType,
        uploadedAt: new Date(),
        processingStatus: 'processing' as any,
      };

      // Parse document
      processingLogs.push(`Starting parsing with ${parser.constructor.name}`);
      const parseResult = await parser.parse(file, metadata);
      
      const processingDuration = Date.now() - startTime;
      processingLogs.push(`Parsing completed in ${processingDuration}ms`);

      // Create processed document
      const document: ProcessedDocument = {
        id: this.generateId(),
        sourceType: fileType,
        extractedText: parseResult.text,
        sections: parseResult.sections,
        metadata: {
          ...metadata,
          processingStatus: 'completed' as any,
          extractedPageCount: parseResult.pageCount,
          ocrRequired: parseResult.ocrRequired,
        },
        processingTimestamp: new Date(),
        processingDuration,
        wordCount: this.countWords(parseResult.text),
        language: parseResult.language || 'en',
        encoding: parseResult.encoding || 'utf-8',
        extractionMethod: parseResult.extractionMethod || 'text',
        quality: parseResult.quality,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate content
      const validation = this.validateContent(document);
      
      if (parseResult.warnings) {
        warnings.push(...parseResult.warnings);
      }

      return {
        document,
        validation,
        processingLogs,
        warnings,
      };

    } catch (error) {
      const processingDuration = Date.now() - startTime;
      processingLogs.push(`Processing failed after ${processingDuration}ms: ${error.message}`);
      
      throw new Error(`Document processing failed: ${error.message}`);
    }
  }

  /**
   * Validates processed document content
   */
  validateContent(document: ProcessedDocument): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty content
    if (!document.extractedText || document.extractedText.trim().length === 0) {
      errors.push('No text content extracted from document');
    }

    // Check minimum content length
    if (document.extractedText && document.extractedText.length < 50) {
      warnings.push('Document contains very little text content');
    }

    // Check for sections
    if (!document.sections || document.sections.length === 0) {
      warnings.push('No document sections identified');
    }

    // Check word count
    if (document.wordCount && document.wordCount < 10) {
      warnings.push('Document has very few words');
    }

    // Check quality metrics if available
    if (document.quality) {
      if (document.quality.textClarity < 0.7) {
        warnings.push('Low text clarity detected');
      }
      if (document.quality.completeness < 0.8) {
        warnings.push('Document may be incomplete');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates a unique ID for the document
   */
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Counts words in text
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}