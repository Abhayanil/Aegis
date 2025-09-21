import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import uploadRoutes from '../../src/routes/upload.js';
import { DocumentProcessorFactory } from '../../src/services/document/DocumentProcessor.js';
import { ProcessedDocument } from '../../src/models/ProcessedDocument.js';
import { DocumentType } from '../../src/types/enums.js';

// Mock the document processor
vi.mock('../../src/services/document/DocumentProcessor.js');

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);

describe('Upload Routes', () => {
  let mockDocumentProcessor: any;

  beforeEach(() => {
    mockDocumentProcessor = {
      processDocument: vi.fn(),
      validateContent: vi.fn(),
      detectFileType: vi.fn(),
    };
    
    (DocumentProcessorFactory as any).mockImplementation(() => mockDocumentProcessor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/upload', () => {
    it('should successfully process uploaded files', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-doc-1',
        sourceType: DocumentType.PDF,
        extractedText: 'Test document content',
        sections: [
          {
            title: 'Introduction',
            content: 'Test content',
            sourceDocument: 'test.pdf',
          },
        ],
        metadata: {
          filename: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        processingDuration: 1000,
        wordCount: 10,
        language: 'en',
        encoding: 'utf-8',
        extractionMethod: 'text',
        quality: {
          textClarity: 0.9,
          structurePreservation: 0.8,
          completeness: 0.95,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentProcessor.processDocument.mockResolvedValue({
        document: mockDocument,
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
        },
        processingLogs: ['Processing completed'],
        warnings: [],
      });

      const response = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test pdf content'), 'test.pdf')
        .field('enableOCR', 'false')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].id).toBe('test-doc-1');
      expect(response.body.data.summary.successfullyProcessed).toBe(1);
      expect(response.body.data.summary.failed).toBe(0);
    });

    it('should handle file processing errors gracefully', async () => {
      mockDocumentProcessor.processDocument.mockRejectedValue(
        new Error('Failed to process document')
      );

      const response = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test pdf content'), 'test.pdf')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
      expect(response.body.data.errors[0].error).toBe('Failed to process document');
    });

    it('should reject requests with no files', async () => {
      const response = await request(app)
        .post('/api/upload')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_FILES_PROVIDED');
    });

    it('should reject unsupported file types', async () => {
      // Note: multer's fileFilter rejects the file before it reaches our handler
      // so we expect a multer error response format
      const response = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test content'), 'test.exe')
        .expect(400);

      // The response might be empty or have a different format due to multer's fileFilter
      // In a real scenario, this would be handled by multer middleware
      expect(response.status).toBe(400);
    });

    it('should handle multiple files with mixed success/failure', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-doc-1',
        sourceType: DocumentType.PDF,
        extractedText: 'Test document content',
        sections: [],
        metadata: {
          filename: 'test1.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        processingDuration: 1000,
        wordCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentProcessor.processDocument
        .mockResolvedValueOnce({
          document: mockDocument,
          validation: { isValid: true, errors: [], warnings: [] },
          processingLogs: [],
          warnings: [],
        })
        .mockRejectedValueOnce(new Error('Processing failed'));

      const response = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test content 1'), 'test1.pdf')
        .attach('files', Buffer.from('test content 2'), 'test2.pdf')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.successfullyProcessed).toBe(1);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
    });

    it('should respect OCR options', async () => {
      const mockDocument: ProcessedDocument = {
        id: 'test-doc-1',
        sourceType: DocumentType.PDF,
        extractedText: 'OCR processed content',
        sections: [],
        metadata: {
          filename: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
          ocrRequired: true,
        },
        processingTimestamp: new Date(),
        extractionMethod: 'ocr',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentProcessor.processDocument.mockResolvedValue({
        document: mockDocument,
        validation: { isValid: true, errors: [], warnings: [] },
        processingLogs: [],
        warnings: [],
      });

      const response = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test pdf content'), 'test.pdf')
        .field('enableOCR', 'true')
        .field('ocrLanguageHints', 'en,es')
        .field('ocrConfidenceThreshold', '0.8')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDocumentProcessor.processDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test.pdf',
        'application/pdf'
      );

      // Verify DocumentProcessorFactory was called with correct options
      expect(DocumentProcessorFactory).toHaveBeenCalledWith({
        enableOCR: true,
        ocrLanguageHints: ['en', 'es'],
        ocrConfidenceThreshold: 0.8,
      });
    });
  });

  describe('GET /api/upload/progress/:sessionId', () => {
    it('should return progress for valid session', async () => {
      // First create an upload to get a session ID
      const mockDocument: ProcessedDocument = {
        id: 'test-doc-1',
        sourceType: DocumentType.PDF,
        extractedText: 'Test content',
        sections: [],
        metadata: {
          filename: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentProcessor.processDocument.mockResolvedValue({
        document: mockDocument,
        validation: { isValid: true, errors: [], warnings: [] },
        processingLogs: [],
        warnings: [],
      });

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test content'), 'test.pdf')
        .expect(200);

      const sessionId = uploadResponse.body.data.sessionId;

      const progressResponse = await request(app)
        .get(`/api/upload/progress/${sessionId}`)
        .expect(200);

      expect(progressResponse.body.success).toBe(true);
      expect(progressResponse.body.data.sessionId).toBe(sessionId);
      expect(progressResponse.body.data.status).toBe('completed');
    });

    it('should return 404 for invalid session', async () => {
      const response = await request(app)
        .get('/api/upload/progress/invalid-session-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('DELETE /api/upload/progress/:sessionId', () => {
    it('should clean up progress tracking', async () => {
      // First create an upload to get a session ID
      const mockDocument: ProcessedDocument = {
        id: 'test-doc-1',
        sourceType: DocumentType.PDF,
        extractedText: 'Test content',
        sections: [],
        metadata: {
          filename: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
          processingStatus: 'completed' as any,
        },
        processingTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDocumentProcessor.processDocument.mockResolvedValue({
        document: mockDocument,
        validation: { isValid: true, errors: [], warnings: [] },
        processingLogs: [],
        warnings: [],
      });

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from('test content'), 'test.pdf')
        .expect(200);

      const sessionId = uploadResponse.body.data.sessionId;

      // Clean up the session
      const deleteResponse = await request(app)
        .delete(`/api/upload/progress/${sessionId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.data.deleted).toBe(true);

      // Verify session is no longer accessible
      await request(app)
        .get(`/api/upload/progress/${sessionId}`)
        .expect(404);
    });

    it('should handle deletion of non-existent session', async () => {
      const response = await request(app)
        .delete('/api/upload/progress/non-existent-session')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(false);
    });
  });
});