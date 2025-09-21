// DOCX document parser implementation
import mammoth from 'mammoth';
import { BaseParser, ParseResult } from './BaseParser.js';
import { DocumentMetadata } from '../../../types/interfaces.js';

export class DOCXParser extends BaseParser {
  async parse(buffer: Buffer, metadata: DocumentMetadata): Promise<ParseResult> {
    try {
      // Extract text with basic formatting preservation
      const result = await mammoth.extractRawText(buffer);
      
      const cleanedText = this.cleanText(result.value);
      const sections = this.identifySections(cleanedText, metadata.filename);
      const quality = this.calculateQuality(cleanedText, 'text');

      // Also try to extract with HTML to get better structure
      let structuredSections = sections;
      try {
        const htmlResult = await mammoth.convertToHtml(buffer);
        structuredSections = this.extractSectionsFromHtml(htmlResult.value, metadata.filename);
      } catch (htmlError) {
        // Fall back to text-based section detection
        console.warn('HTML extraction failed, using text-based sections:', htmlError.message);
      }

      return {
        text: cleanedText,
        sections: structuredSections.length > sections.length ? structuredSections : sections,
        pageCount: this.estimatePageCount(cleanedText),
        ocrRequired: false, // DOCX is already text-based
        language: this.detectLanguage(cleanedText),
        encoding: 'utf-8',
        extractionMethod: 'text',
        quality,
        warnings: this.generateWarnings(result, cleanedText),
      };

    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  /**
   * Extracts sections from HTML structure
   */
  private extractSectionsFromHtml(html: string, sourceDocument: string) {
    const sections = [];
    
    // Simple HTML parsing to identify headers and content
    const headerRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    const parts = html.split(headerRegex);
    
    let currentTitle = 'Introduction';
    let currentContent = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (i % 3 === 0) {
        // This is content
        currentContent += this.stripHtml(part);
      } else if (i % 3 === 2) {
        // This is a header title
        if (currentContent.trim()) {
          sections.push({
            title: currentTitle,
            content: currentContent.trim(),
            sourceDocument,
            confidence: 0.8,
          });
        }
        currentTitle = this.stripHtml(part);
        currentContent = '';
      }
      // i % 3 === 1 is the header level, which we ignore for now
    }
    
    // Add final section
    if (currentContent.trim()) {
      sections.push({
        title: currentTitle,
        content: currentContent.trim(),
        sourceDocument,
        confidence: 0.8,
      });
    }
    
    return sections;
  }

  /**
   * Strips HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Estimates page count based on text length
   */
  private estimatePageCount(text: string): number {
    // Rough estimate: ~500 words per page
    const wordCount = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 500));
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
  private generateWarnings(result: any, cleanedText: string): string[] {
    const warnings: string[] = [];

    // Check mammoth-specific warnings
    if (result.messages && result.messages.length > 0) {
      const errorMessages = result.messages.filter(msg => msg.type === 'error');
      const warningMessages = result.messages.filter(msg => msg.type === 'warning');
      
      if (errorMessages.length > 0) {
        warnings.push(`Document parsing encountered ${errorMessages.length} errors`);
      }
      
      if (warningMessages.length > 0) {
        warnings.push(`Document parsing encountered ${warningMessages.length} warnings`);
      }
    }

    // Check for very short content
    if (cleanedText.length < 500) {
      warnings.push('Document contains very little text content');
    }

    // Check for potential formatting issues
    if (cleanedText.includes('�')) {
      warnings.push('Document may contain encoding issues or unsupported characters');
    }

    // Check for tables or complex formatting
    if (result.value && result.value.includes('\t')) {
      warnings.push('Document may contain tables - formatting may not be preserved');
    }

    return warnings;
  }
}