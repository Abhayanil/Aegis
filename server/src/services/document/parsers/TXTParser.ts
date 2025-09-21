// TXT document parser implementation
import { BaseParser, ParseResult } from './BaseParser.js';
import { DocumentMetadata } from '../../../types/interfaces.js';

export class TXTParser extends BaseParser {
  async parse(buffer: Buffer, metadata: DocumentMetadata): Promise<ParseResult> {
    try {
      // Detect encoding
      const encoding = this.detectEncoding(buffer);
      const text = buffer.toString(encoding);
      
      const cleanedText = this.cleanText(text);
      const sections = this.identifySections(cleanedText, metadata.filename);
      const quality = this.calculateQuality(cleanedText, 'text');

      return {
        text: cleanedText,
        sections,
        pageCount: this.estimatePageCount(cleanedText),
        ocrRequired: false, // Text files don't need OCR
        language: this.detectLanguage(cleanedText),
        encoding,
        extractionMethod: 'text',
        quality,
        warnings: this.generateWarnings(text, cleanedText, encoding),
      };

    } catch (error) {
      throw new Error(`TXT parsing failed: ${error.message}`);
    }
  }

  /**
   * Detects text encoding
   */
  private detectEncoding(buffer: Buffer): BufferEncoding {
    // Check for BOM (Byte Order Mark)
    if (buffer.length >= 3) {
      // UTF-8 BOM
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf8';
      }
      
      // UTF-16 BE BOM
      if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf16le'; // Node.js doesn't have utf16be, use utf16le
      }
      
      // UTF-16 LE BOM
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf16le';
      }
    }

    // Try to detect encoding by analyzing byte patterns
    const sample = buffer.slice(0, Math.min(1000, buffer.length));
    
    // Check for high-bit characters that might indicate non-ASCII
    let nonAsciiCount = 0;
    let nullCount = 0;
    
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] > 127) nonAsciiCount++;
      if (sample[i] === 0) nullCount++;
    }

    // If we have null bytes, might be UTF-16
    if (nullCount > sample.length * 0.1) {
      return 'utf16le';
    }

    // If we have many non-ASCII characters, try UTF-8
    if (nonAsciiCount > 0) {
      try {
        // Test if it's valid UTF-8
        buffer.toString('utf8');
        return 'utf8';
      } catch {
        // Fall back to latin1 if UTF-8 fails
        return 'latin1';
      }
    }

    // Default to UTF-8 for ASCII-compatible text
    return 'utf8';
  }

  /**
   * Estimates page count based on text length
   */
  private estimatePageCount(text: string): number {
    // Rough estimate: ~500 words per page or ~3000 characters per page
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;
    
    const pagesByWords = Math.ceil(wordCount / 500);
    const pagesByChars = Math.ceil(charCount / 3000);
    
    // Use the higher estimate
    return Math.max(1, Math.max(pagesByWords, pagesByChars));
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
    if (/[\u0590-\u05ff]/.test(text)) return 'he'; // Hebrew
    if (/[\u0900-\u097f]/.test(text)) return 'hi'; // Hindi

    return 'unknown';
  }

  /**
   * Generates warnings based on parsing results
   */
  private generateWarnings(originalText: string, cleanedText: string, encoding: string): string[] {
    const warnings: string[] = [];

    // Check for encoding issues
    if (originalText.includes('�')) {
      warnings.push('Text contains replacement characters - encoding may be incorrect');
    }

    // Check for very short content
    if (cleanedText.length < 100) {
      warnings.push('Text file contains very little content');
    }

    // Check for very long lines (might indicate formatting issues)
    const lines = originalText.split('\n');
    const longLines = lines.filter(line => line.length > 200).length;
    if (longLines > lines.length * 0.5) {
      warnings.push('Text contains many very long lines - may lack proper formatting');
    }

    // Check for binary content indicators
    const binaryIndicators = ['\x00', '\x01', '\x02', '\x03', '\x04', '\x05'];
    if (binaryIndicators.some(indicator => originalText.includes(indicator))) {
      warnings.push('Text may contain binary data - file might not be plain text');
    }

    // Warn about non-standard encoding
    if (encoding !== 'utf8' && encoding !== 'ascii') {
      warnings.push(`Text uses ${encoding} encoding - some characters may not display correctly`);
    }

    // Check for excessive whitespace
    const whitespaceRatio = (originalText.length - originalText.replace(/\s/g, '').length) / originalText.length;
    if (whitespaceRatio > 0.5) {
      warnings.push('Text contains high ratio of whitespace - may have formatting issues');
    }

    return warnings;
  }
}