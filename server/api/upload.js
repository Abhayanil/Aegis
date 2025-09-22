// Vercel serverless function for file upload
import multer from 'multer';
import { DocumentProcessorFactory } from '../src/services/document/DocumentProcessor.js';
import { MockDataService } from '../src/services/mock/MockDataService.js';
import { logger } from '../src/utils/logger.js';
import { validateUploadRequest } from '../src/utils/validation.js';
import { handleError } from '../src/utils/errorHandler.js';

// Configure multer for serverless
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Helper to run multer in serverless environment
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed',
      },
    });
  }

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.array('files'));
    
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILES',
          message: 'No files provided for upload',
        },
      });
    }

    // Validate request
    const validation = validateUploadRequest(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: validation.errors,
        },
      });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processedDocuments = [];
    const errors = [];
    const warnings = [];
    let totalSize = 0;

    logger.info(`Starting document processing for session ${sessionId}`, {
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    });

    // Check if we're in development mode and use mock data
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // Use mock data for development
      for (const file of files) {
        totalSize += file.size;
        
        // Simulate processing delay
        await MockDataService.simulateProcessingDelay('upload');
        
        const mockDocument = MockDataService.createMockProcessedDocument(file.originalname);
        processedDocuments.push(mockDocument);
        
        logger.info(`Mock processed document: ${file.originalname}`, {
          documentId: mockDocument.id,
        });
      }
    } else {
      // Process each file with real services
      for (const file of files) {
        try {
          totalSize += file.size;
          
          const processor = DocumentProcessorFactory.createProcessor(file.mimetype);
          const result = await processor.processDocument(
            file.buffer,
            file.originalname,
            file.mimetype
          );

          processedDocuments.push(result.document);
          
          if (result.warnings.length > 0) {
            warnings.push(...result.warnings);
          }

          logger.info(`Successfully processed document: ${file.originalname}`, {
            documentId: result.document.id,
            processingTime: result.document.processingDuration,
          });
        } catch (error) {
          logger.error(`Failed to process document: ${file.originalname}`, error);
          errors.push({
            filename: file.originalname,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    const processingTime = Date.now() - parseInt(sessionId.split('_')[1]);

    res.json({
      success: true,
      data: {
        sessionId,
        documents: processedDocuments,
        summary: {
          successfullyProcessed: processedDocuments.length,
          failed: errors.length,
          totalSize,
        },
        processingTime,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
      },
    });
  }
}