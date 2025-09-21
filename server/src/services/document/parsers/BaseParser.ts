// Base parser interface and common functionality
import { DocumentMetadata, DocumentSection } from '../../../types/interfaces.js';

export interface ParseResult {
  text: string;
  sections: DocumentSection[];
  pageCount?: number;
  ocrRequired?: boolean;
  language?: string;
  encoding?: string;
  extractionMethod?: 'text' | 'ocr' | 'hybrid';
  quality?: {
    textClarity: number;
    structurePreservation: number;
    completeness: number;
  };
  warnings?: string[];
}

export abstract class BaseParser {
  abstract parse(buffer: Buffer, metadata: DocumentMetadata): Promise<ParseResult>;

  /**
   * Cleans extracted text by removing excessive whitespace and normalizing line breaks
   */
  protected cleanText(text: string): string {
    if (!text) return '';
    
    return text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      // Remove excessive line breaks (more than 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      // Remove leading/trailing whitespace
      .trim();
  }

  /**
   * Identifies potential sections in text based on common patterns
   */
  protected identifySections(text: string, sourceDocument: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    
    let currentSection: DocumentSection | null = null;
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        if (currentContent.length > 0) {
          currentContent.push('');
        }
        continue;
      }

      // Check if this line looks like a section header
      if (this.isSectionHeader(line, i, lines)) {
        // Save previous section if exists
        if (currentSection && currentContent.length > 0) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: line,
          content: '',
          sourceDocument,
          confidence: this.calculateHeaderConfidence(line),
        };
        currentContent = [];
      } else if (currentSection) {
        // Add to current section
        currentContent.push(line);
      } else {
        // No section yet, create a default one
        if (!currentSection) {
          currentSection = {
            title: 'Introduction',
            content: '',
            sourceDocument,
            confidence: 0.5,
          };
        }
        currentContent.push(line);
      }
    }

    // Add final section
    if (currentSection && currentContent.length > 0) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    // If no sections were identified, create a single section with all content
    if (sections.length === 0 && text.trim()) {
      sections.push({
        title: 'Document Content',
        content: text.trim(),
        sourceDocument,
        confidence: 0.3,
      });
    }

    return sections;
  }

  /**
   * Determines if a line is likely a section header
   */
  private isSectionHeader(line: string, index: number, lines: string[]): boolean {
    // Check for common header patterns
    const headerPatterns = [
      /^[A-Z][A-Z\s]{2,}$/,  // ALL CAPS
      /^\d+\.\s+[A-Z]/,      // Numbered sections (1. Title)
      /^[A-Z][a-z]+(\s[A-Z][a-z]+)*:?$/,  // Title Case
      /^#{1,6}\s+/,          // Markdown headers
      /^[A-Z][^.!?]*$/,      // Single sentence without punctuation
    ];

    // Must be relatively short
    if (line.length > 100) return false;

    // Check patterns
    const matchesPattern = headerPatterns.some(pattern => pattern.test(line));
    if (!matchesPattern) return false;

    // Additional heuristics
    const nextLine = lines[index + 1]?.trim();
    const prevLine = lines[index - 1]?.trim();

    // More likely if followed by content
    if (nextLine && nextLine.length > 20) return true;

    // More likely if preceded by empty line
    if (!prevLine || prevLine.length === 0) return true;

    return matchesPattern;
  }

  /**
   * Calculates confidence score for section header identification
   */
  private calculateHeaderConfidence(header: string): number {
    let confidence = 0.5;

    // Boost confidence for common business document sections
    const businessSections = [
      'executive summary', 'problem', 'solution', 'market', 'business model',
      'traction', 'team', 'financials', 'funding', 'competition', 'appendix',
      'overview', 'introduction', 'conclusion', 'recommendations'
    ];

    const lowerHeader = header.toLowerCase();
    if (businessSections.some(section => lowerHeader.includes(section))) {
      confidence += 0.3;
    }

    // Boost for numbered sections
    if (/^\d+\./.test(header)) {
      confidence += 0.2;
    }

    // Boost for proper capitalization
    if (/^[A-Z][a-z]/.test(header)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculates text quality metrics
   */
  protected calculateQuality(text: string, extractionMethod: 'text' | 'ocr' | 'hybrid' = 'text'): {
    textClarity: number;
    structurePreservation: number;
    completeness: number;
  } {
    if (!text) {
      return { textClarity: 0, structurePreservation: 0, completeness: 0 };
    }

    // Text clarity - based on character patterns and readability
    const textClarity = this.calculateTextClarity(text, extractionMethod);
    
    // Structure preservation - based on formatting and sections
    const structurePreservation = this.calculateStructurePreservation(text);
    
    // Completeness - based on content length and coherence
    const completeness = this.calculateCompleteness(text);

    return {
      textClarity,
      structurePreservation,
      completeness,
    };
  }

  private calculateTextClarity(text: string, extractionMethod: 'text' | 'ocr' | 'hybrid'): number {
    let clarity = 1.0;

    // OCR typically has lower clarity
    if (extractionMethod === 'ocr') {
      clarity *= 0.8;
    } else if (extractionMethod === 'hybrid') {
      clarity *= 0.9;
    }

    // Check for garbled text patterns
    const garbledPatterns = [
      /[^\w\s\.,!?;:()\-'"]/g,  // Unusual characters
      /\s{5,}/g,                // Excessive spaces
      /[A-Za-z]{20,}/g,         // Very long words (likely errors)
    ];

    garbledPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        clarity -= Math.min(matches.length * 0.01, 0.3);
      }
    });

    return Math.max(clarity, 0);
  }

  private calculateStructurePreservation(text: string): number {
    let structure = 0.5;

    // Check for preserved formatting elements
    if (text.includes('\n\n')) structure += 0.2;  // Paragraphs
    if (/^\s*[-*•]\s/m.test(text)) structure += 0.1;  // Bullet points
    if (/^\s*\d+\.\s/m.test(text)) structure += 0.1;  // Numbered lists
    if (/^[A-Z][^.!?]*$/m.test(text)) structure += 0.2;  // Headers

    return Math.min(structure, 1.0);
  }

  private calculateCompleteness(text: string): number {
    const wordCount = text.split(/\s+/).length;
    
    // Base completeness on word count
    let completeness = Math.min(wordCount / 100, 1.0);  // Assume 100+ words is complete
    
    // Check for truncation indicators
    if (text.endsWith('...') || text.includes('[truncated]')) {
      completeness *= 0.7;
    }

    // Check for coherent sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 3) {
      completeness *= 0.8;
    }

    return completeness;
  }
}