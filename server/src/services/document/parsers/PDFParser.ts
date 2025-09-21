// PDF document parser implementation
import pdf from 'pdf-parse';
import { BaseParser, ParseResult } from './BaseParser.js';
import { DocumentMetadata } from '../../../types/interfaces.js';
import { OCRProcessor } from '../OCRProcessor.js';

export class PDFParser extends BaseParser {
  private ocrProcessor?: OCRProcessor;

  constructor(enableOCR: boolean = false) {
    super();
    if (enableOCR) {
      this.ocrProcessor = new OCRProcessor();
    }
  }

  async parse(buffer: Buffer, metadata: DocumentMetadata): Promise<ParseResult> {
    try {
      const data = await pdf(buffer, {
        // PDF parsing options
        max: 0, // Parse all pages
        version: 'v1.10.100',
      });

      const cleanedText = this.cleanText(data.text);
      let sections = this.identifySections(cleanedText, metadata.filename);
      let quality = this.calculateQuality(cleanedText, 'text');
      let extractionMethod: 'text' | 'ocr' | 'hybrid' = 'text';
      let warnings = this.generateWarnings(data, cleanedText);

      // Check if OCR might be needed (very little text extracted)
      const ocrRequired = this.shouldUseOCR(data, buffer.length);

      // If OCR is available and needed, try OCR processing
      if (this.ocrProcessor && ocrRequired && cleanedText.length < 500) {
        try {
          const ocrResult = await this.ocrProcessor.processDocument(buffer, metadata);
          
          if (ocrResult.text.length > cleanedText.length) {
            // OCR produced better results
            const ocrText = this.cleanText(ocrResult.text);
            const ocrSections = this.ocrProcessor.convertToSections(ocrResult, metadata.filename);
            
            return {
              text: ocrText,
              sections: ocrSections,
              pageCount: Math.max(data.numpages, ocrResult.pages.length),
              ocrRequired: false, // OCR was already performed
              language: ocrResult.language || this.detectLanguage(ocrText),
              encoding: 'utf-8',
              extractionMethod: cleanedText.length > 0 ? 'hybrid' : 'ocr',
              quality: this.calculateQuality(ocrText, cleanedText.length > 0 ? 'hybrid' : 'ocr'),
              warnings: [...warnings, ...ocrResult.warnings],
            };
          } else {
            warnings.push('OCR processing did not improve text extraction');
          }
        } catch (ocrError) {
          warnings.push(`OCR processing failed: ${ocrError.message}`);
        }
      }

      return {
        text: cleanedText,
        sections,
        pageCount: data.numpages,
        ocrRequired,
        language: this.detectLanguage(cleanedText),
        encoding: 'utf-8',
        extractionMethod,
        quality,
        warnings,
      };

    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Determines if OCR processing might be beneficial
   */
  private shouldUseOCR(pdfData: any, fileSize: number): boolean {
    // If very little text was extracted but file is substantial, might need OCR
    const textDensity = pdfData.text.length / fileSize;
    const wordsPerPage = pdfData.text.split(/\s+/).length / (pdfData.numpages || 1);

    // Suggest OCR if:
    // - Very low text density (likely image-based PDF)
    // - Very few words per page
    // - File is large but extracted text is small
    return (
      textDensity < 0.01 ||
      wordsPerPage < 50 ||
      (fileSize > 100000 && pdfData.text.length < 1000)
    );
  }

  /**
   * Simple language detection based on character patterns
   */
  private detectLanguage(text: string): string {
    if (!text || text.length < 100) return 'unknown';

    // Simple heuristics for common languages
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const lowerText = text.toLowerCase();
    
    const englishMatches = englishWords.filter(word => 
      lowerText.includes(` ${word} `) || lowerText.startsWith(`${word} `)
    ).length;

    // If we find several English words, assume English
    if (englishMatches >= 3) return 'en';

    // Check for non-Latin scripts
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh'; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Japanese
    if (/[\u0400-\u04ff]/.test(text)) return 'ru'; // Russian
    if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic

    return 'unknown';
  }

  /**
   * Generates warnings based on parsing results
   */
  private generateWarnings(pdfData: any, cleanedText: string): string[] {
    const warnings: string[] = [];

    // Check for potential issues
    if (pdfData.numpages > 50) {
      warnings.push('Large document with many pages - processing may take longer');
    }

    if (cleanedText.length < 500) {
      warnings.push('Very little text extracted - document may be image-based or encrypted');
    }

    if (pdfData.info?.IsAcroFormPresent) {
      warnings.push('Document contains forms - form data may not be extracted');
    }

    if (pdfData.info?.IsXFAPresent) {
      warnings.push('Document contains XFA forms - content may not be fully extracted');
    }

    // Check for password protection indicators
    if (pdfData.info?.Security) {
      warnings.push('Document may have security restrictions');
    }

    // Check text quality
    const specialCharRatio = (cleanedText.match(/[^\w\s\.,!?;:()\-'"]/g) || []).length / cleanedText.length;
    if (specialCharRatio > 0.1) {
      warnings.push('High ratio of special characters detected - may indicate OCR or encoding issues');
    }

    return warnings;
  }
}