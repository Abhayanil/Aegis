// Vercel serverless function for file upload

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

// Mock data service for development
class MockDataService {
  static async simulateProcessingDelay(type) {
    const delays = {
      upload: 500,
      analyze: 1000,
      benchmark: 800,
      generate: 1200
    };
    await new Promise(resolve => setTimeout(resolve, delays[type] || 500));
  }

  static createMockProcessedDocument(filename) {
    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceType: filename.endsWith('.pdf') ? 'pdf' : filename.endsWith('.docx') ? 'docx' : 'txt',
      extractedText: `Mock extracted text from ${filename}. This would contain the actual document content in a real implementation.`,
      sections: [
        {
          title: 'Company Overview',
          content: 'TestCorp is a SaaS platform serving enterprise customers with AI-powered workflow automation.',
          sourceDocument: filename,
        },
        {
          title: 'Financial Metrics',
          content: 'Current ARR: $2M, Growth Rate: 15% MoM, Customer Count: 150, Team Size: 25',
          sourceDocument: filename,
        },
      ],
      metadata: {
        filename,
        fileSize: Math.floor(Math.random() * 5000000) + 100000,
        mimeType: filename.endsWith('.pdf') ? 'application/pdf' : 
                  filename.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                  'text/plain',
        uploadedAt: new Date().toISOString(),
        processingStatus: 'completed',
      },
      processingTimestamp: new Date().toISOString(),
      processingDuration: Math.floor(Math.random() * 3000) + 500,
      wordCount: Math.floor(Math.random() * 5000) + 500,
      language: 'en',
      encoding: 'utf-8',
      extractionMethod: 'text',
      quality: {
        textClarity: 0.85 + Math.random() * 0.15,
        structurePreservation: 0.8 + Math.random() * 0.2,
        completeness: 0.9 + Math.random() * 0.1,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

// Simple validation function
function validateUploadRequest(body) {
  return { isValid: true, errors: [] };
}

// Simple logger
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data || ''),
  error: (message, error) => console.error(`[ERROR] ${message}`, error || ''),
};

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
    // For now, we'll use mock data since we don't have multer setup
    // In a real implementation, you'd need to handle file uploads properly
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processedDocuments = [];
    const errors = [];
    const warnings = [];
    
    // Mock file processing
    const mockFiles = [
      { originalname: 'pitch-deck.pdf', size: 2500000 },
      { originalname: 'financial-model.xlsx', size: 1200000 }
    ];
    
    let totalSize = 0;

    logger.info(`Starting document processing for session ${sessionId}`, {
      fileCount: mockFiles.length,
      totalSize: mockFiles.reduce((sum, file) => sum + file.size, 0),
    });

    // Process mock files
    for (const file of mockFiles) {
      totalSize += file.size;
      
      // Simulate processing delay
      await MockDataService.simulateProcessingDelay('upload');
      
      const mockDocument = MockDataService.createMockProcessedDocument(file.originalname);
      processedDocuments.push(mockDocument);
      
      logger.info(`Mock processed document: ${file.originalname}`, {
        documentId: mockDocument.id,
      });
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