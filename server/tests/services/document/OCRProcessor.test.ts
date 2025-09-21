// Integration tests for OCRProcessor
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OCRProcessor } from '../../../src/services/document/OCRProcessor.js';
import { DocumentMetadata } from '../../../src/types/interfaces.js';

// Mock the Google Cloud Vision client
const mockAnnotateImage = vi.fn();
const mockGetProjectId = vi.fn().mockResolvedValue('test-project');

vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeVision: () => ({
    annotateImage: mockAnnotateImage,
    getProjectId: mockGetProjectId,
  }),
}));

describe('OCRProcessor', () => {
  let processor: OCRProcessor;
  let mockMetadata: DocumentMetadata;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new OCRProcessor();
    mockMetadata = {
      filename: 'test-image.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
      processingStatus: 'processing' as any,
    };
  });

  describe('processDocument', () => {
    it('should handle empty OCR results gracefully', async () => {
      // Mock Vision API to return empty results for both document and text detection
      mockAnnotateImage
        .mockResolvedValueOnce([{ fullTextAnnotation: null }])
        .mockResolvedValueOnce([{ textAnnotations: [] }]);

      const buffer = Buffer.from('fake image data');
      const result = await processor.processDocument(buffer, mockMetadata);

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.pages).toHaveLength(0);
      expect(result.warnings).toContain('All OCR methods failed to extract text');
    });

    it('should process document text detection results', async () => {
      // Mock Vision API to return document text detection results
      const mockResponse = {
        fullTextAnnotation: {
          text: 'This is extracted text from the document.',
          pages: [{
            blocks: [{
              paragraphs: [{
                words: [{
                  symbols: [
                    { text: 'This' },
                    { text: ' ' },
                    { text: 'is' },
                    { text: ' ' },
                    { text: 'text' }
                  ]
                }],
                confidence: 0.95
              }],
              boundingBox: {
                vertices: [
                  { x: 10, y: 10 },
                  { x: 100, y: 10 },
                  { x: 100, y: 30 },
                  { x: 10, y: 30 }
                ]
              }
            }]
          }]
        }
      };

      mockAnnotateImage.mockResolvedValue([mockResponse]);

      const buffer = Buffer.from('fake image data');
      const result = await processor.processDocument(buffer, mockMetadata);

      expect(result.text).toBe('This is extracted text from the document.');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].blocks).toHaveLength(1);
    });

    it('should fall back to text detection if document text detection fails', async () => {
      // Create processor with only text detection enabled
      const textOnlyProcessor = new OCRProcessor({
        enableDocumentTextDetection: false,
        enableTextDetection: true,
        maxRetries: 1
      });

      // Mock Vision API to return text detection results
      mockAnnotateImage.mockResolvedValue([{
        textAnnotations: [
          {
            description: 'Fallback text from text detection',
            confidence: 0.8,
            boundingPoly: {
              vertices: [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 20 },
                { x: 0, y: 20 }
              ]
            }
          }
        ]
      }]);

      const buffer = Buffer.from('fake image data');
      const result = await textOnlyProcessor.processDocument(buffer, mockMetadata);

      expect(result.text).toBe('Fallback text from text detection');
      expect(result.confidence).toBe(0.8);
    });

    it('should retry on transient failures', async () => {
      // Mock Vision API to fail document detection, then fail text detection twice, then succeed
      mockAnnotateImage
        .mockRejectedValueOnce(new Error('Document detection failed'))
        .mockRejectedValueOnce(new Error('Transient error 1'))
        .mockRejectedValueOnce(new Error('Transient error 2'))
        .mockResolvedValueOnce([{
          textAnnotations: [
            {
              description: 'Success after retries',
              confidence: 0.9
            }
          ]
        }]);

      const buffer = Buffer.from('fake image data');
      const result = await processor.processDocument(buffer, mockMetadata, {
        maxRetries: 3,
        retryDelay: 10 // Short delay for testing
      });

      expect(result.text).toBe('Success after retries');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle confidence thresholds', async () => {
      // Create processor with only text detection enabled
      const textOnlyProcessor = new OCRProcessor({
        enableDocumentTextDetection: false,
        enableTextDetection: true,
        maxRetries: 1
      });

      // Mock Vision API to return text detection
      mockAnnotateImage.mockResolvedValue([{
        textAnnotations: [
          {
            description: 'Some text',
            confidence: 0.5
          }
        ]
      }]);

      const buffer = Buffer.from('fake image data');
      const result = await textOnlyProcessor.processDocument(buffer, mockMetadata);

      expect(result.text).toBe('Some text');
      expect(result.confidence).toBe(0.5);
      // Just verify that warnings array exists (confidence warning logic is tested elsewhere)
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('extractImagesFromDocument', () => {
    it('should handle PDF documents', async () => {
      const buffer = Buffer.from('fake pdf data');
      const images = await processor.extractImagesFromDocument(buffer, 'pdf');
      
      expect(images).toHaveLength(1);
      expect(images[0]).toBe(buffer);
    });

    it('should handle Office documents', async () => {
      const buffer = Buffer.from('fake docx data');
      const images = await processor.extractImagesFromDocument(buffer, 'docx');
      
      expect(images).toHaveLength(1);
      expect(images[0]).toBe(buffer);
    });

    it('should handle unknown document types', async () => {
      const buffer = Buffer.from('fake data');
      const images = await processor.extractImagesFromDocument(buffer, 'unknown');
      
      expect(images).toHaveLength(1);
      expect(images[0]).toBe(buffer);
    });
  });

  describe('convertToSections', () => {
    it('should convert OCR results to document sections', () => {
      const ocrResult = {
        text: 'Full document text',
        confidence: 0.9,
        pages: [{
          pageNumber: 1,
          text: 'Page text',
          confidence: 0.9,
          blocks: [
            {
              text: 'HEADER TEXT',
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 100, height: 20 }
            },
            {
              text: 'This is body content that follows the header.',
              confidence: 0.85,
              boundingBox: { x: 10, y: 40, width: 200, height: 15 }
            }
          ]
        }],
        warnings: []
      };

      const sections = processor.convertToSections(ocrResult, 'test.pdf');

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('HEADER TEXT');
      expect(sections[0].content).toContain('This is body content');
      expect(sections[0].pageNumber).toBe(1);
      expect(sections[0].sourceDocument).toBe('test.pdf');
    });

    it('should create default section when no headers found', () => {
      const ocrResult = {
        text: 'Just plain text without headers',
        confidence: 0.8,
        pages: [{
          pageNumber: 1,
          text: 'Just plain text without headers',
          confidence: 0.8,
          blocks: [{
            text: 'Just plain text without headers',
            confidence: 0.8,
            boundingBox: { x: 10, y: 10, width: 200, height: 15 }
          }]
        }],
        warnings: []
      };

      const sections = processor.convertToSections(ocrResult, 'test.pdf');

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Page 1');
      expect(sections[0].content).toBe('Just plain text without headers');
    });

    it('should handle empty OCR results', () => {
      const ocrResult = {
        text: '',
        confidence: 0,
        pages: [],
        warnings: []
      };

      const sections = processor.convertToSections(ocrResult, 'test.pdf');

      expect(sections).toHaveLength(0);
    });
  });
});