// Unit tests for TXTParser
import { describe, it, expect, beforeEach } from 'vitest';
import { TXTParser } from '../../../../src/services/document/parsers/TXTParser.js';
import { DocumentMetadata } from '../../../../src/types/interfaces.js';

describe('TXTParser', () => {
  let parser: TXTParser;
  let mockMetadata: DocumentMetadata;

  beforeEach(() => {
    parser = new TXTParser();
    mockMetadata = {
      filename: 'test.txt',
      fileSize: 1000,
      mimeType: 'text/plain',
      uploadedAt: new Date(),
      processingStatus: 'processing' as any,
    };
  });

  describe('parse', () => {
    it('should parse simple text content', async () => {
      const content = 'This is a simple text document.\n\nIt has multiple paragraphs.';
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.text).toContain('This is a simple text document');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Introduction');
      expect(result.encoding).toBe('utf8');
      expect(result.extractionMethod).toBe('text');
      expect(result.ocrRequired).toBe(false);
    });

    it('should detect UTF-8 BOM', async () => {
      const content = 'UTF-8 content with BOM';
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      const buffer = Buffer.concat([bom, Buffer.from(content, 'utf-8')]);

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.encoding).toBe('utf8');
      expect(result.text).toContain('UTF-8 content with BOM');
    });

    it('should handle structured text with sections', async () => {
      const content = `INTRODUCTION
This is the introduction section.

MAIN CONTENT
This is the main content section with more details.

CONCLUSION
This is the conclusion section.`;
      
      const buffer = Buffer.from(content, 'utf-8');
      const result = await parser.parse(buffer, mockMetadata);

      expect(result.sections.length).toBeGreaterThan(1);
      expect(result.sections.some(s => s.title.includes('INTRODUCTION'))).toBe(true);
    });

    it('should estimate page count correctly', async () => {
      // Create content that should be about 2 pages
      const longContent = 'word '.repeat(1000); // 1000 words
      const buffer = Buffer.from(longContent, 'utf-8');

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.pageCount).toBe(2); // ~500 words per page
    });

    it('should detect language', async () => {
      const englishContent = 'This is an English document with the and or but in on at to for of with by. '.repeat(5);
      const buffer = Buffer.from(englishContent, 'utf-8');

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.language).toBe('en');
    });

    it('should generate warnings for problematic content', async () => {
      const shortContent = 'Short';
      const buffer = Buffer.from(shortContent, 'utf-8');

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.warnings).toContain('Text file contains very little content');
    });

    it('should handle encoding issues', async () => {
      const contentWithReplacementChar = 'Text with replacement char: �';
      const buffer = Buffer.from(contentWithReplacementChar, 'utf-8');

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.warnings).toContain('Text contains replacement characters - encoding may be incorrect');
    });

    it('should detect binary content', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f]); // Binary + "Hello"
      
      const result = await parser.parse(binaryContent, mockMetadata);

      expect(result.warnings).toContain('Text may contain binary data - file might not be plain text');
    });

    it('should handle very long lines', async () => {
      const longLine = 'a'.repeat(500);
      const content = `${longLine}\n${longLine}\n${longLine}`;
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parse(buffer, mockMetadata);

      expect(result.warnings).toContain('Text contains many very long lines - may lack proper formatting');
    });

    it('should calculate quality metrics', async () => {
      const goodContent = `TITLE
This is a well-structured document with sufficient content to demonstrate good quality metrics.

SECTION 1
This section has good content with proper formatting and meaningful information that should result in good quality scores.

SECTION 2
Another section with meaningful content that adds to the overall document quality and completeness.

- Bullet point 1
- Bullet point 2

1. Numbered item 1
2. Numbered item 2

This document has multiple paragraphs, good structure, and sufficient content to achieve high quality scores.`;
      
      const buffer = Buffer.from(goodContent, 'utf-8');
      const result = await parser.parse(buffer, mockMetadata);

      expect(result.quality).toBeDefined();
      expect(result.quality!.textClarity).toBeGreaterThan(0.8);
      expect(result.quality!.structurePreservation).toBeGreaterThan(0.5);
      expect(result.quality!.completeness).toBeGreaterThan(0.8);
    });
  });
});