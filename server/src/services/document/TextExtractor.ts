// Text extraction utility with metadata preservation
import { DocumentProcessorFactory, DocumentProcessorOptions } from './DocumentProcessor.js';
import { ProcessedDocument, DocumentProcessingResult } from '../../models/ProcessedDocument.js';
import { DocumentType } from '../../types/enums.js';

export interface TextExtractionOptions {
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
  enableOCR?: boolean;
  ocrLanguageHints?: string[];
  ocrConfidenceThreshold?: number;
  maxFileSize?: number; // in bytes
  timeout?: number; // in milliseconds
}

export interface ExtractionMetrics {
  processingTime: number;
  fileSize: number;
  extractedTextLength: number;
  sectionsFound: number;
  qualityScore: number;
  warningsCount: number;
}

export class TextExtractor {
  private processor: DocumentProcessorFactory;
  private defaultOptions: TextExtractionOptions = {
    preserveFormatting: true,
    extractMetadata: true,
    enableOCR: false,
    ocrLanguageHints: ['en'],
    ocrConfidenceThreshold: 0.5,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    timeout: 30000, // 30 seconds
  };

  constructor(options?: Partial<TextExtractionOptions>) {
    const processorOptions: DocumentProcessorOptions = {
      enableOCR: options?.enableOCR || false,
      ocrLanguageHints: options?.ocrLanguageHints || ['en'],
      ocrConfidenceThreshold: options?.ocrConfidenceThreshold || 0.5,
    };
    
    this.processor = new DocumentProcessorFactory(processorOptions);
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Extracts text from a single document
   */
  async extractFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options?: Partial<TextExtractionOptions>
  ): Promise<DocumentProcessingResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Validate file size
    if (buffer.length > opts.maxFileSize!) {
      throw new Error(`File size (${buffer.length} bytes) exceeds maximum allowed size (${opts.maxFileSize} bytes)`);
    }

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Text extraction timeout')), opts.timeout);
    });

    try {
      // Race between processing and timeout
      const result = await Promise.race([
        this.processor.processDocument(buffer, filename, mimeType),
        timeoutPromise
      ]);

      return result;

    } catch (error) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extracts text from multiple documents
   */
  async extractFromMultiple(
    files: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    options?: Partial<TextExtractionOptions>
  ): Promise<DocumentProcessingResult[]> {
    const results: DocumentProcessingResult[] = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      try {
        // First validate the file
        const validation = this.validateFile(file.buffer, file.filename, file.mimeType);
        if (!validation.isValid) {
          throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
        }

        const result = await this.extractFromBuffer(
          file.buffer,
          file.filename,
          file.mimeType,
          options
        );
        
        // Only include results that have valid content
        if (result.validation.isValid) {
          results.push(result);
        } else {
          errors.push({
            filename: file.filename,
            error: `Document validation failed: ${result.validation.errors.join(', ')}`
          });
        }
      } catch (error) {
        errors.push({
          filename: file.filename,
          error: error.message
        });
      }
    }

    // If we have some results but also errors, add errors as warnings to the first result
    if (results.length > 0 && errors.length > 0) {
      results[0].warnings.push(
        ...errors.map(err => `Failed to process ${err.filename}: ${err.error}`)
      );
    }

    // If no results at all, throw error
    if (results.length === 0) {
      throw new Error(`Failed to process any documents: ${errors.map(e => e.error).join('; ')}`);
    }

    return results;
  }

  /**
   * Validates file type and size before processing
   */
  validateFile(buffer: Buffer, filename: string, mimeType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    if (buffer.length === 0) {
      errors.push('File is empty');
    }

    if (buffer.length > this.defaultOptions.maxFileSize!) {
      errors.push(`File size (${buffer.length} bytes) exceeds maximum allowed size (${this.defaultOptions.maxFileSize} bytes)`);
    }

    // Check if file type is supported
    try {
      this.processor.detectFileType(filename, mimeType);
    } catch (error) {
      errors.push(error.message);
    }

    // Check for potential binary files that might be misidentified
    if (mimeType === 'text/plain' && this.containsBinaryData(buffer)) {
      errors.push('File appears to contain binary data despite text MIME type');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets supported file types
   */
  getSupportedTypes(): DocumentType[] {
    return [DocumentType.PDF, DocumentType.DOCX, DocumentType.PPTX, DocumentType.TXT];
  }

  /**
   * Gets extraction metrics from processing result
   */
  getExtractionMetrics(result: DocumentProcessingResult): ExtractionMetrics {
    return {
      processingTime: result.document.processingDuration || 0,
      fileSize: result.document.metadata.fileSize,
      extractedTextLength: result.document.extractedText.length,
      sectionsFound: result.document.sections.length,
      qualityScore: this.calculateOverallQuality(result.document),
      warningsCount: result.warnings.length,
    };
  }

  /**
   * Merges multiple processed documents into a single document
   */
  mergeDocuments(
    documents: ProcessedDocument[],
    mergedFilename: string = 'merged_documents'
  ): ProcessedDocument {
    if (documents.length === 0) {
      throw new Error('No documents to merge');
    }

    if (documents.length === 1) {
      return documents[0];
    }

    // Combine all text
    const combinedText = documents
      .map(doc => doc.extractedText)
      .join('\n\n--- Document Separator ---\n\n');

    // Combine all sections with source attribution
    const combinedSections = documents.flatMap(doc => 
      doc.sections.map(section => ({
        ...section,
        sourceDocument: `${doc.metadata.filename} - ${section.sourceDocument}`,
      }))
    );

    // Calculate combined metadata
    const totalFileSize = documents.reduce((sum, doc) => sum + doc.metadata.fileSize, 0);
    const totalPages = documents.reduce((sum, doc) => sum + (doc.metadata.extractedPageCount || 0), 0);
    const totalProcessingTime = documents.reduce((sum, doc) => sum + (doc.processingDuration || 0), 0);

    return {
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceType: DocumentType.TXT, // Merged document is treated as text
      extractedText: combinedText,
      sections: combinedSections,
      metadata: {
        filename: mergedFilename,
        fileSize: totalFileSize,
        mimeType: 'text/plain',
        uploadedAt: new Date(),
        processingStatus: 'completed' as any,
        extractedPageCount: totalPages,
        ocrRequired: documents.some(doc => doc.metadata.ocrRequired),
      },
      processingTimestamp: new Date(),
      processingDuration: totalProcessingTime,
      wordCount: combinedText.split(/\s+/).length,
      language: this.detectDominantLanguage(documents),
      encoding: 'utf-8',
      extractionMethod: 'text',
      quality: this.calculateMergedQuality(documents),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Checks if buffer contains binary data
   */
  private containsBinaryData(buffer: Buffer): boolean {
    // Check first 1KB for null bytes or other binary indicators
    const sample = buffer.slice(0, Math.min(1024, buffer.length));
    let nullCount = 0;
    let controlCount = 0;

    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) nullCount++;
      if (sample[i] < 32 && sample[i] !== 9 && sample[i] !== 10 && sample[i] !== 13) {
        controlCount++;
      }
    }

    // If more than 1% null bytes or control characters, likely binary
    return (nullCount / sample.length) > 0.01 || (controlCount / sample.length) > 0.05;
  }

  /**
   * Calculates overall quality score for a document
   */
  private calculateOverallQuality(document: ProcessedDocument): number {
    if (!document.quality) return 0.5;

    const { textClarity, structurePreservation, completeness } = document.quality;
    
    // Weighted average with emphasis on completeness
    return (textClarity * 0.3 + structurePreservation * 0.2 + completeness * 0.5);
  }

  /**
   * Detects dominant language across multiple documents
   */
  private detectDominantLanguage(documents: ProcessedDocument[]): string {
    const languageCounts: Record<string, number> = {};
    
    documents.forEach(doc => {
      const lang = doc.language || 'unknown';
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    });

    // Return most common language
    return Object.entries(languageCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
  }

  /**
   * Calculates quality metrics for merged documents
   */
  private calculateMergedQuality(documents: ProcessedDocument[]): {
    textClarity: number;
    structurePreservation: number;
    completeness: number;
  } {
    if (documents.length === 0) {
      return { textClarity: 0, structurePreservation: 0, completeness: 0 };
    }

    // Average quality across all documents
    const qualities = documents
      .map(doc => doc.quality)
      .filter(quality => quality !== undefined);

    if (qualities.length === 0) {
      return { textClarity: 0.5, structurePreservation: 0.5, completeness: 0.5 };
    }

    return {
      textClarity: qualities.reduce((sum, q) => sum + q!.textClarity, 0) / qualities.length,
      structurePreservation: qualities.reduce((sum, q) => sum + q!.structurePreservation, 0) / qualities.length,
      completeness: qualities.reduce((sum, q) => sum + q!.completeness, 0) / qualities.length,
    };
  }
}