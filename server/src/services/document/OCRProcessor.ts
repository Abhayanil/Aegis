// OCR processing service using Google Cloud Vision API
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { initializeVision } from '../../utils/googleCloud.js';
import { logger } from '../../utils/logger.js';
import { DocumentMetadata, DocumentSection } from '../../types/interfaces.js';

export interface OCRResult {
  text: string;
  confidence: number;
  pages: OCRPage[];
  language?: string;
  warnings: string[];
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCROptions {
  enableTextDetection?: boolean;
  enableDocumentTextDetection?: boolean;
  languageHints?: string[];
  maxRetries?: number;
  retryDelay?: number;
  confidenceThreshold?: number;
}

export class OCRProcessor {
  private visionClient: ImageAnnotatorClient;
  private defaultOptions: OCROptions = {
    enableTextDetection: true,
    enableDocumentTextDetection: true,
    languageHints: ['en'],
    maxRetries: 3,
    retryDelay: 1000,
    confidenceThreshold: 0.5,
  };

  constructor(options?: Partial<OCROptions>) {
    this.visionClient = initializeVision();
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Processes a document buffer with OCR
   */
  async processDocument(
    buffer: Buffer,
    metadata: DocumentMetadata,
    options?: Partial<OCROptions>
  ): Promise<OCRResult> {
    const opts = { ...this.defaultOptions, ...options };
    const warnings: string[] = [];

    try {
      logger.info(`Starting OCR processing for ${metadata.filename}`);
      
      // Try document text detection first (better for documents)
      if (opts.enableDocumentTextDetection) {
        try {
          const result = await this.performDocumentTextDetection(buffer, opts);
          if (result.text.length > 0) {
            logger.info(`Document text detection successful for ${metadata.filename}`);
            return result;
          } else {
            warnings.push('Document text detection returned no results');
          }
        } catch (error) {
          logger.warn(`Document text detection failed for ${metadata.filename}:`, error.message);
          warnings.push(`Document text detection failed: ${error.message}`);
        }
      }

      // Fall back to regular text detection
      if (opts.enableTextDetection) {
        try {
          const result = await this.performTextDetection(buffer, opts);
          if (result.text.length > 0) {
            logger.info(`Text detection successful for ${metadata.filename}`);
            return { ...result, warnings };
          } else {
            warnings.push('Text detection returned no results');
          }
        } catch (error) {
          logger.warn(`Text detection failed for ${metadata.filename}:`, error.message);
          warnings.push(`Text detection failed: ${error.message}`);
        }
      }

      // If both methods failed, return empty result
      return {
        text: '',
        confidence: 0,
        pages: [],
        warnings: [...warnings, 'All OCR methods failed to extract text'],
      };

    } catch (error) {
      logger.error(`OCR processing failed for ${metadata.filename}:`, error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extracts images from a document buffer for OCR processing
   */
  async extractImagesFromDocument(buffer: Buffer, documentType: string): Promise<Buffer[]> {
    const images: Buffer[] = [];

    try {
      switch (documentType.toLowerCase()) {
        case 'pdf':
          // For PDFs, we'll process the entire document as one image
          // In a production system, you might want to convert PDF pages to images first
          images.push(buffer);
          break;
        
        case 'docx':
        case 'pptx':
          // For Office documents, extract embedded images
          // This is a simplified approach - in production you'd use proper image extraction
          images.push(buffer);
          break;
        
        default:
          // For other formats, treat the entire buffer as an image
          images.push(buffer);
      }

      return images;

    } catch (error) {
      logger.error('Failed to extract images from document:', error);
      throw new Error(`Image extraction failed: ${error.message}`);
    }
  }

  /**
   * Performs document text detection using Google Cloud Vision API
   */
  private async performDocumentTextDetection(
    buffer: Buffer,
    options: OCROptions
  ): Promise<OCRResult> {
    const request = {
      image: { content: buffer },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' as const }],
      imageContext: {
        languageHints: options.languageHints,
      },
    };

    const result = await this.executeWithRetry(
      () => this.visionClient.annotateImage(request),
      options.maxRetries!,
      options.retryDelay!
    );

    const [response] = result;
    const annotation = response.fullTextAnnotation;

    if (!annotation) {
      return {
        text: '',
        confidence: 0,
        pages: [],
        warnings: ['No text annotation found in document'],
      };
    }

    // Process pages
    const pages: OCRPage[] = [];
    if (annotation.pages) {
      annotation.pages.forEach((page, index) => {
        const pageBlocks: OCRBlock[] = [];
        let pageText = '';
        let pageConfidence = 0;
        let blockCount = 0;

        if (page.blocks) {
          page.blocks.forEach(block => {
            if (block.paragraphs) {
              block.paragraphs.forEach(paragraph => {
                if (paragraph.words) {
                  const blockText = paragraph.words
                    .map(word => 
                      word.symbols?.map(symbol => symbol.text).join('') || ''
                    )
                    .join(' ');
                  
                  if (blockText.trim()) {
                    pageText += blockText + ' ';
                    
                    const blockConfidence = paragraph.confidence || 0;
                    pageConfidence += blockConfidence;
                    blockCount++;

                    // Create bounding box from block vertices
                    const boundingBox = this.createBoundingBox(block.boundingBox?.vertices);
                    
                    pageBlocks.push({
                      text: blockText.trim(),
                      confidence: blockConfidence,
                      boundingBox,
                    });
                  }
                }
              });
            }
          });
        }

        pages.push({
          pageNumber: index + 1,
          text: pageText.trim(),
          confidence: blockCount > 0 ? pageConfidence / blockCount : 0,
          blocks: pageBlocks,
        });
      });
    }

    const overallConfidence = pages.length > 0 
      ? pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length
      : 0;

    return {
      text: annotation.text || '',
      confidence: overallConfidence,
      pages,
      language: this.detectLanguageFromAnnotation(annotation),
      warnings: overallConfidence < options.confidenceThreshold! 
        ? [`Low OCR confidence: ${overallConfidence.toFixed(2)}`]
        : [],
    };
  }

  /**
   * Performs basic text detection using Google Cloud Vision API
   */
  private async performTextDetection(
    buffer: Buffer,
    options: OCROptions
  ): Promise<OCRResult> {
    const request = {
      image: { content: buffer },
      features: [{ type: 'TEXT_DETECTION' as const }],
      imageContext: {
        languageHints: options.languageHints,
      },
    };

    const result = await this.executeWithRetry(
      () => this.visionClient.annotateImage(request),
      options.maxRetries!,
      options.retryDelay!
    );

    const [response] = result;
    const textAnnotations = response.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      return {
        text: '',
        confidence: 0,
        pages: [],
        warnings: ['No text annotations found'],
      };
    }

    // First annotation contains the full text
    const fullText = textAnnotations[0];
    const confidence = fullText.confidence || 0;

    // Create blocks from individual text annotations (skip the first one which is the full text)
    const blocks: OCRBlock[] = textAnnotations.slice(1).map(annotation => ({
      text: annotation.description || '',
      confidence: annotation.confidence || 0,
      boundingBox: this.createBoundingBox(annotation.boundingPoly?.vertices),
    }));

    // Create a single page with all blocks
    const page: OCRPage = {
      pageNumber: 1,
      text: fullText.description || '',
      confidence,
      blocks,
    };

    return {
      text: fullText.description || '',
      confidence,
      pages: [page],
      language: this.detectLanguageFromText(fullText.description || ''),
      warnings: confidence < options.confidenceThreshold! 
        ? [`Low OCR confidence: ${confidence.toFixed(2)}`]
        : [],
    };
  }

  /**
   * Creates a bounding box from vertices
   */
  private createBoundingBox(vertices?: Array<{ x?: number; y?: number }>): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (!vertices || vertices.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xs = vertices.map(v => v.x || 0);
    const ys = vertices.map(v => v.y || 0);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Detects language from Vision API annotation
   */
  private detectLanguageFromAnnotation(annotation: any): string {
    // Try to get language from the annotation properties
    if (annotation.pages && annotation.pages[0]?.property?.detectedLanguages) {
      const languages = annotation.pages[0].property.detectedLanguages;
      if (languages.length > 0) {
        return languages[0].languageCode || 'unknown';
      }
    }

    // Fall back to text-based detection
    return this.detectLanguageFromText(annotation.text || '');
  }

  /**
   * Simple language detection from text
   */
  private detectLanguageFromText(text: string): string {
    if (!text || text.length < 50) return 'unknown';

    // Simple heuristics for common languages
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const lowerText = text.toLowerCase();
    
    const englishMatches = englishWords.filter(word => 
      lowerText.includes(` ${word} `) || lowerText.startsWith(`${word} `)
    ).length;

    if (englishMatches >= 3) return 'en';

    // Check for non-Latin scripts
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';

    return 'unknown';
  }

  /**
   * Executes a function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`OCR attempt ${attempt} failed:`, error.message);

        if (attempt < maxRetries) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError!;
  }

  /**
   * Utility function to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Converts OCR result to document sections
   */
  convertToSections(ocrResult: OCRResult, sourceDocument: string): DocumentSection[] {
    const sections: DocumentSection[] = [];

    ocrResult.pages.forEach(page => {
      // Group blocks into logical sections based on positioning and content
      const pageBlocks = page.blocks.sort((a, b) => {
        // Sort by Y position first, then X position
        if (Math.abs(a.boundingBox.y - b.boundingBox.y) > 20) {
          return a.boundingBox.y - b.boundingBox.y;
        }
        return a.boundingBox.x - b.boundingBox.x;
      });

      let currentSection: DocumentSection | null = null;
      let currentContent: string[] = [];

      pageBlocks.forEach(block => {
        const blockText = block.text.trim();
        if (!blockText) return;

        // Check if this block looks like a header
        if (this.isLikelyHeader(block, pageBlocks)) {
          // Save previous section
          if (currentSection && currentContent.length > 0) {
            currentSection.content = currentContent.join('\n').trim();
            sections.push(currentSection);
          }

          // Start new section
          currentSection = {
            title: blockText,
            content: '',
            pageNumber: page.pageNumber,
            sourceDocument,
            confidence: block.confidence,
          };
          currentContent = [];
        } else if (currentSection) {
          // Add to current section
          currentContent.push(blockText);
        } else {
          // No section yet, create default one
          currentSection = {
            title: `Page ${page.pageNumber}`,
            content: '',
            pageNumber: page.pageNumber,
            sourceDocument,
            confidence: block.confidence,
          };
          currentContent = [blockText];
        }
      });

      // Add final section
      if (currentSection && currentContent.length > 0) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }
    });

    // If no sections were created, create one with all text
    if (sections.length === 0 && ocrResult.text.trim()) {
      sections.push({
        title: 'OCR Content',
        content: ocrResult.text.trim(),
        sourceDocument,
        confidence: ocrResult.confidence,
      });
    }

    return sections;
  }

  /**
   * Determines if a block is likely a header based on position and formatting
   */
  private isLikelyHeader(block: OCRBlock, allBlocks: OCRBlock[]): boolean {
    const text = block.text.trim();
    
    // Must be relatively short
    if (text.length > 100) return false;

    // Check for header patterns
    const headerPatterns = [
      /^[A-Z][A-Z\s]{2,}$/,  // ALL CAPS
      /^\d+\.\s+[A-Z]/,      // Numbered sections
      /^[A-Z][a-z]+(\s[A-Z][a-z]+)*:?$/,  // Title Case
    ];

    if (!headerPatterns.some(pattern => pattern.test(text))) {
      return false;
    }

    // Check if it's positioned like a header (top of page or isolated)
    const isAtTop = block.boundingBox.y < 100; // Near top of page
    const hasSpaceBelow = allBlocks.some(other => 
      other.boundingBox.y > block.boundingBox.y + block.boundingBox.height + 10
    );

    return isAtTop || hasSpaceBelow;
  }
}