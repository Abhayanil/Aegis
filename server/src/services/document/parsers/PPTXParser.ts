// PPTX document parser implementation
import AdmZip from 'adm-zip';
import { BaseParser, ParseResult } from './BaseParser.js';
import { DocumentMetadata, DocumentSection } from '../../../types/interfaces.js';

export class PPTXParser extends BaseParser {
  async parse(buffer: Buffer, metadata: DocumentMetadata): Promise<ParseResult> {
    try {
      const zip = new AdmZip(buffer);
      const slides = await this.extractSlides(zip);
      
      const allText = slides.map(slide => slide.content).join('\n\n');
      const cleanedText = this.cleanText(allText);
      
      // Convert slides to sections
      const sections = slides.map((slide, index) => ({
        title: slide.title || `Slide ${index + 1}`,
        content: slide.content,
        pageNumber: index + 1,
        sourceDocument: metadata.filename,
        confidence: 0.9, // High confidence since we know slide structure
      }));

      const quality = this.calculateQuality(cleanedText, 'text');

      return {
        text: cleanedText,
        sections,
        pageCount: slides.length,
        ocrRequired: this.shouldUseOCR(slides),
        language: this.detectLanguage(cleanedText),
        encoding: 'utf-8',
        extractionMethod: 'text',
        quality,
        warnings: this.generateWarnings(slides, cleanedText),
      };

    } catch (error) {
      throw new Error(`PPTX parsing failed: ${error.message}`);
    }
  }

  /**
   * Extracts text content from PPTX slides
   */
  private async extractSlides(zip: AdmZip): Promise<Array<{ title: string; content: string }>> {
    const slides: Array<{ title: string; content: string }> = [];
    
    try {
      // Get slide entries
      const slideEntries = zip.getEntries().filter(entry => 
        entry.entryName.startsWith('ppt/slides/slide') && 
        entry.entryName.endsWith('.xml')
      );

      // Sort slides by number
      slideEntries.sort((a, b) => {
        const aNum = parseInt(a.entryName.match(/slide(\d+)\.xml/)?.[1] || '0');
        const bNum = parseInt(b.entryName.match(/slide(\d+)\.xml/)?.[1] || '0');
        return aNum - bNum;
      });

      for (const entry of slideEntries) {
        const slideXml = entry.getData().toString('utf8');
        const slideContent = this.extractTextFromSlideXml(slideXml);
        
        if (slideContent.title || slideContent.content) {
          slides.push(slideContent);
        }
      }

      return slides;

    } catch (error) {
      throw new Error(`Failed to extract slides: ${error.message}`);
    }
  }

  /**
   * Extracts text from slide XML content
   */
  private extractTextFromSlideXml(xml: string): { title: string; content: string } {
    let title = '';
    let content = '';
    
    try {
      // Extract text from <a:t> tags (text runs)
      const textMatches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g) || [];
      const textParts = textMatches.map(match => {
        const text = match.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '');
        return this.decodeXmlEntities(text);
      });

      if (textParts.length === 0) {
        return { title: '', content: '' };
      }

      // First significant text is likely the title
      const significantTexts = textParts.filter(text => text.trim().length > 0);
      
      if (significantTexts.length > 0) {
        // Heuristic: if first text is short and looks like a title, use it as title
        const firstText = significantTexts[0];
        if (firstText.length < 100 && !firstText.includes('.') && significantTexts.length > 1) {
          title = firstText;
          content = significantTexts.slice(1).join('\n');
        } else {
          // Use all text as content, generate title from first few words
          content = significantTexts.join('\n');
          title = this.generateTitleFromContent(firstText);
        }
      }

      return { title: title.trim(), content: content.trim() };

    } catch (error) {
      console.warn('Error parsing slide XML:', error.message);
      return { title: '', content: '' };
    }
  }

  /**
   * Decodes XML entities
   */
  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  /**
   * Generates a title from content
   */
  private generateTitleFromContent(content: string): string {
    if (!content) return 'Untitled Slide';
    
    // Take first few words, up to 50 characters
    const words = content.split(/\s+/);
    let title = '';
    
    for (const word of words) {
      if (title.length + word.length + 1 > 50) break;
      title += (title ? ' ' : '') + word;
    }
    
    return title || 'Untitled Slide';
  }

  /**
   * Determines if OCR might be needed for images in slides
   */
  private shouldUseOCR(slides: Array<{ title: string; content: string }>): boolean {
    // If we have very few slides with content, might need OCR for images
    const slidesWithContent = slides.filter(slide => 
      slide.content.trim().length > 20
    ).length;
    
    const totalSlides = slides.length;
    
    // Suggest OCR if less than 50% of slides have substantial text
    return totalSlides > 0 && (slidesWithContent / totalSlides) < 0.5;
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
  private generateWarnings(slides: Array<{ title: string; content: string }>, cleanedText: string): string[] {
    const warnings: string[] = [];

    // Check for slides with no content
    const emptySlides = slides.filter(slide => !slide.content.trim()).length;
    if (emptySlides > 0) {
      warnings.push(`${emptySlides} slides contain no extractable text - may contain only images`);
    }

    // Check for very short content
    if (cleanedText.length < 500) {
      warnings.push('Presentation contains very little text content - may be image-heavy');
    }

    // Check for potential encoding issues
    if (cleanedText.includes('�')) {
      warnings.push('Presentation may contain encoding issues or unsupported characters');
    }

    // Warn about large presentations
    if (slides.length > 50) {
      warnings.push('Large presentation with many slides - processing may take longer');
    }

    return warnings;
  }
}