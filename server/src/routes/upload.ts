import express from 'express';
import multer from 'multer';
import { DocumentProcessorFactory } from '../services/document/DocumentProcessor.js';
import { logger } from '../utils/logger.js';
import { AppError, createErrorResponse } from '../utils/errors.js';
import { ApiResponse } from '../types/interfaces.js';
import { ProcessedDocument } from '../models/ProcessedDocument.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10, // Maximum 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint',
      'text/plain',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(
        `Unsupported file type: ${file.mimetype}`,
        400,
        'UNSUPPORTED_FILE_TYPE',
        { filename: file.originalname, mimetype: file.mimetype }
      ));
    }
  },
});

// Progress tracking for multi-document processing
interface UploadProgress {
  sessionId: string;
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  status: 'processing' | 'completed' | 'failed';
  results: ProcessedDocument[];
  errors: Array<{ filename: string; error: string }>;
  startTime: Date;
  endTime?: Date;
}

// In-memory progress tracking (in production, use Redis or database)
const progressTracker = new Map<string, UploadProgress>();

/**
 * Generate unique session ID for tracking upload progress
 */
function generateSessionId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * POST /api/upload
 * Upload and process multiple documents
 */
router.post('/', upload.array('files'), async (req, res) => {
  const startTime = Date.now();
  const sessionId = generateSessionId();
  
  try {
    const files = req.files as Express.Multer.File[];
    const options = {
      enableOCR: req.body.enableOCR === 'true',
      ocrLanguageHints: req.body.ocrLanguageHints ? req.body.ocrLanguageHints.split(',') : ['en'],
      ocrConfidenceThreshold: req.body.ocrConfidenceThreshold ? parseFloat(req.body.ocrConfidenceThreshold) : 0.5,
    };

    if (!files || files.length === 0) {
      throw new AppError(
        'No files provided for upload',
        400,
        'NO_FILES_PROVIDED'
      );
    }

    logger.info(`Starting document processing for session ${sessionId}`, {
      sessionId,
      fileCount: files.length,
      options,
    });

    // Initialize progress tracking
    const progress: UploadProgress = {
      sessionId,
      totalFiles: files.length,
      processedFiles: 0,
      status: 'processing',
      results: [],
      errors: [],
      startTime: new Date(),
    };
    progressTracker.set(sessionId, progress);

    // Initialize document processor
    const documentProcessor = new DocumentProcessorFactory(options);
    const results: ProcessedDocument[] = [];
    const errors: Array<{ filename: string; error: string }> = [];

    // Process each file
    for (const file of files) {
      try {
        progress.currentFile = file.originalname;
        progressTracker.set(sessionId, progress);

        logger.info(`Processing file: ${file.originalname}`, {
          sessionId,
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        });

        const result = await documentProcessor.processDocument(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        results.push(result.document);
        progress.processedFiles++;
        progress.results = results;

        logger.info(`Successfully processed file: ${file.originalname}`, {
          sessionId,
          filename: file.originalname,
          wordCount: result.document.wordCount,
          processingDuration: result.document.processingDuration,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          filename: file.originalname,
          error: errorMessage,
        });

        progress.errors = errors;

        logger.error(`Failed to process file: ${file.originalname}`, {
          sessionId,
          filename: file.originalname,
          error: errorMessage,
        });
      }
    }

    // Update final progress
    progress.status = errors.length === files.length ? 'failed' : 'completed';
    progress.endTime = new Date();
    progressTracker.set(sessionId, progress);

    const processingTime = Date.now() - startTime;

    // Prepare response
    const response: ApiResponse<{
      sessionId: string;
      documents: ProcessedDocument[];
      summary: {
        totalFiles: number;
        successfullyProcessed: number;
        failed: number;
        totalWordCount: number;
        averageProcessingTime: number;
      };
      errors?: Array<{ filename: string; error: string }>;
    }> = {
      success: results.length > 0,
      data: {
        sessionId,
        documents: results,
        summary: {
          totalFiles: files.length,
          successfullyProcessed: results.length,
          failed: errors.length,
          totalWordCount: results.reduce((sum, doc) => sum + (doc.wordCount || 0), 0),
          averageProcessingTime: results.length > 0 
            ? results.reduce((sum, doc) => sum + (doc.processingDuration || 0), 0) / results.length
            : 0,
        },
        ...(errors.length > 0 && { errors }),
      },
      metadata: {
        processingTime,
        timestamp: new Date(),
        version: '1.0.0',
      },
    };

    logger.info(`Document processing completed for session ${sessionId}`, {
      sessionId,
      totalFiles: files.length,
      successful: results.length,
      failed: errors.length,
      processingTime,
    });

    res.status(200).json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    // Update progress on error
    const progress = progressTracker.get(sessionId);
    if (progress) {
      progress.status = 'failed';
      progress.endTime = new Date();
      progressTracker.set(sessionId, progress);
    }

    logger.error('Document upload processing failed', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Document processing failed',
      500,
      'PROCESSING_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/upload/progress/:sessionId
 * Get upload progress for a session
 */
router.get('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const progress = progressTracker.get(sessionId);
  if (!progress) {
    const error = new AppError(
      'Upload session not found',
      404,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
    return res.status(404).json(createErrorResponse(error));
  }

  const response: ApiResponse<UploadProgress> = {
    success: true,
    data: progress,
    metadata: {
      processingTime: 0,
      timestamp: new Date(),
      version: '1.0.0',
    },
  };

  res.json(response);
});

/**
 * DELETE /api/upload/progress/:sessionId
 * Clean up progress tracking for a session
 */
router.delete('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  const deleted = progressTracker.delete(sessionId);
  
  const response: ApiResponse<{ deleted: boolean }> = {
    success: true,
    data: { deleted },
    metadata: {
      processingTime: 0,
      timestamp: new Date(),
      version: '1.0.0',
    },
  };

  res.json(response);
});

export default router;