// Unit tests for DocumentProcessor
import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentProcessorFactory } from '../../../src/services/document/DocumentProcessor.js';
import { DocumentType } from '../../../src/types/enums.js';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessorFactory;

  beforeEach(() => {
    processor = new DocumentProcessorFactory();
  });

  describe('detectFileType', () => {
    it('should detect PDF files by MIME type', () => {
      const fileType = processor.detectFileType('document.pdf', 'application/pdf');
      expect(fileType).toBe(DocumentType.PDF);
    });

    it('should detect DOCX files by MIME type', () => {
      const fileType = processor.detectFileType('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(fileType).toBe(DocumentType.DOCX);
    });

    it('should detect PPTX files by MIME type', () => {
      const fileType = processor.detectFileType('presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      expect(fileType).toBe(DocumentType.PPTX);
    });

    it('should detect TXT files by MIME type', () => {
      const fileType = processor.detectFileType('document.txt', 'text/plain');
      expect(fileType).toBe(DocumentType.TXT);
    });

    it('should fall back to extension detection', () => {
      const fileType = processor.detectFileType('document.pdf', 'application/octet-stream');
      expect(fileType).toBe(DocumentType.PDF);
    });

    it('should throw error for unsupported file types', () => {
      expect(() => {
        processor.detectFileType('document.xyz', 'application/unknown');
      }).toThrow('Unsupported file type');
    });
  });

  describe('validateContent', () => {
    it('should validate document with good content', () => {
      const document = {
        id: 'test-1',
        sourceType: DocumentType.TXT,
        extractedText: 'This is a test document with sufficient content to be considered valid.',
        sections: [
          {
            title: 'Test Section',
            content: 'Test content',
            sourceDocument: 'test.txt',
            confidence: 0.8
          }
        ],
        metadata: {
          filename: 'test.txt',
          fileSize: 1000,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        wordCount: 12,
        language: 'en',
        encoding: 'utf-8',
        extractionMethod: 'text' as const,
        quality: {
          textClarity: 0.9,
          structurePreservation: 0.8,
          completeness: 0.9
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = processor.validateContent(document);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should flag empty content as invalid', () => {
      const document = {
        id: 'test-2',
        sourceType: DocumentType.TXT,
        extractedText: '',
        sections: [],
        metadata: {
          filename: 'empty.txt',
          fileSize: 0,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        wordCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = processor.validateContent(document);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('No text content extracted from document');
    });

    it('should warn about low quality content', () => {
      const document = {
        id: 'test-3',
        sourceType: DocumentType.PDF,
        extractedText: 'Short text',
        sections: [],
        metadata: {
          filename: 'short.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        wordCount: 2,
        quality: {
          textClarity: 0.5,
          structurePreservation: 0.6,
          completeness: 0.7
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = processor.validateContent(document);
      expect(validation.warnings).toContain('Document contains very little text content');
      expect(validation.warnings).toContain('No document sections identified');
      expect(validation.warnings).toContain('Document has very few words');
      expect(validation.warnings).toContain('Low text clarity detected');
    });
  });

  describe('processDocument', () => {
    it('should process a simple text file', async () => {
      const textContent = 'This is a test document.\n\nIt has multiple paragraphs.\n\nAnd some structure.';
      const buffer = Buffer.from(textContent, 'utf-8');
      
      const result = await processor.processDocument(buffer, 'test.txt', 'text/plain');
      
      expect(result.document.sourceType).toBe(DocumentType.TXT);
      expect(result.document.extractedText).toContain('This is a test document');
      expect(result.document.sections.length).toBeGreaterThan(0);
      expect(result.document.wordCount).toBeGreaterThan(0);
      expect(result.validation.isValid).toBe(true);
    });

    it('should handle unsupported file types', async () => {
      const buffer = Buffer.from('content');
      
      await expect(
        processor.processDocument(buffer, 'test.xyz', 'application/unknown')
      ).rejects.toThrow('Document processing failed');
    });
  });
});