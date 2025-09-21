import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Import routes
import uploadRoutes from '../../src/routes/upload.js';
import dealMemoRoutes from '../../src/routes/dealMemo.js';
import exportRoutes from '../../src/routes/export.js';

// Import services for integration testing
import { DocumentProcessorFactory } from '../../src/services/document/DocumentProcessor.js';
import { GeminiAnalyzer } from '../../src/services/ai/GeminiAnalyzer.js';
import { BigQueryConnector } from '../../src/services/benchmarking/BigQueryConnector.js';
import { FirebaseStorage } from '../../src/services/storage/FirebaseStorage.js';

// Import types
import { ProcessedDocument } from '../../src/models/ProcessedDocument.js';
import { DealMemo } from '../../src/models/DealMemo.js';
import { DocumentType, ProcessingStatus } from '../../src/types/enums.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);
app.use('/api/deal-memo', dealMemoRoutes);
app.use('/api/export', exportRoutes);

describe('End-to-End Integration Tests', () => {
  let testDocuments: Buffer[];
  let testFilenames: string[];
  let mockServices: {
    documentProcessor: any;
    geminiAnalyzer: any;
    bigQueryConnector: any;
    firebaseStorage: any;
  };

  beforeAll(async () => {
    // Load test documents
    const testDataPath = path.join(__dirname, '../fixtures');
    
    // Create test documents if they don't exist
    await ensureTestDocuments(testDataPath);
    
    testDocuments = [
      await fs.readFile(path.join(testDataPath, 'sample-pitch-deck.pdf')),
      await fs.readFile(path.join(testDataPath, 'sample-transcript.txt')),
      await fs.readFile(path.join(testDataPath, 'sample-financials.docx')),
    ];
    
    testFilenames = [
      'sample-pitch-deck.pdf',
      'sample-transcript.txt', 
      'sample-financials.docx'
    ];
  });

  beforeEach(() => {
    // Setup mocks for each test
    mockServices = setupServiceMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Deal Memo Generation Workflow', () => {
    it('should process documents and generate complete deal memo', async () => {
      // Step 1: Upload and process documents
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .attach('files', testDocuments[1], testFilenames[1])
        .attach('files', testDocuments[2], testFilenames[2])
        .field('enableOCR', 'true')
        .field('ocrLanguageHints', 'en')
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.documents).toHaveLength(3);
      expect(uploadResponse.body.data.summary.successfullyProcessed).toBe(3);

      const sessionId = uploadResponse.body.data.sessionId;
      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      // Step 2: Generate deal memo with custom weightings
      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId,
          analysisWeightings: {
            marketOpportunity: 30,
            team: 25,
            traction: 20,
            product: 15,
            competitivePosition: 10
          },
          includeRiskAssessment: true,
          includeBenchmarking: true
        })
        .expect(200);

      expect(dealMemoResponse.body.success).toBe(true);
      expect(dealMemoResponse.body.data.dealMemo).toBeDefined();
      
      const dealMemo = dealMemoResponse.body.data.dealMemo;
      expect(dealMemo.aegisDealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary.signalScore).toBeGreaterThan(0);
      expect(dealMemo.aegisDealMemo.keyBenchmarks).toBeInstanceOf(Array);
      expect(dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks).toBeInstanceOf(Array);

      // Step 3: Export deal memo
      const exportResponse = await request(app)
        .post('/api/export')
        .send({
          dealMemoId: dealMemoResponse.body.data.dealMemoId,
          format: 'json',
          includeSourceData: true
        })
        .expect(200);

      expect(exportResponse.body.success).toBe(true);
      expect(exportResponse.body.data.exportData).toBeDefined();
      
      // Verify the complete workflow
      expect(mockServices.documentProcessor.processDocument).toHaveBeenCalledTimes(3);
      expect(mockServices.geminiAnalyzer.analyzeContent).toHaveBeenCalled();
      expect(mockServices.bigQueryConnector.getBenchmarks).toHaveBeenCalled();
      expect(mockServices.firebaseStorage.saveDealMemo).toHaveBeenCalled();
    }, 30000); // 30 second timeout for complete workflow

    it('should handle partial document processing failures gracefully', async () => {
      // Mock one document to fail processing
      mockServices.documentProcessor.processDocument
        .mockResolvedValueOnce(createMockProcessingResult('doc1', 'success'))
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce(createMockProcessingResult('doc3', 'success'));

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .attach('files', testDocuments[1], testFilenames[1])
        .attach('files', testDocuments[2], testFilenames[2])
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.summary.successfullyProcessed).toBe(2);
      expect(uploadResponse.body.data.summary.failed).toBe(1);
      expect(uploadResponse.body.data.errors).toHaveLength(1);

      // Should still be able to generate deal memo with remaining documents
      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);
      
      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      expect(dealMemoResponse.body.success).toBe(true);
      expect(dealMemoResponse.body.data.dealMemo).toBeDefined();
    });

    it('should handle AI service failures with graceful degradation', async () => {
      // Mock AI service to fail initially then succeed
      mockServices.geminiAnalyzer.analyzeContent
        .mockRejectedValueOnce(new Error('Gemini service unavailable'))
        .mockResolvedValueOnce(createMockAnalysisResult());

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId,
          retryOnFailure: true
        })
        .expect(200);

      expect(dealMemoResponse.body.success).toBe(true);
      expect(dealMemoResponse.body.data.dealMemo).toBeDefined();
      expect(mockServices.geminiAnalyzer.analyzeContent).toHaveBeenCalledTimes(2);
    });

    it('should validate deal memo schema compliance', async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      const dealMemo = dealMemoResponse.body.data.dealMemo;
      
      // Validate required schema fields
      expect(dealMemo.aegisDealMemo).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary.companyName).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary.oneLiner).toBeDefined();
      expect(dealMemo.aegisDealMemo.summary.signalScore).toBeTypeOf('number');
      expect(dealMemo.aegisDealMemo.summary.recommendation).toBeDefined();
      
      expect(dealMemo.aegisDealMemo.keyBenchmarks).toBeInstanceOf(Array);
      expect(dealMemo.aegisDealMemo.growthPotential).toBeDefined();
      expect(dealMemo.aegisDealMemo.riskAssessment).toBeDefined();
      expect(dealMemo.aegisDealMemo.investmentRecommendation).toBeDefined();
      
      // Validate nested structures
      expect(dealMemo.aegisDealMemo.growthPotential.upsideSummary).toBeDefined();
      expect(dealMemo.aegisDealMemo.growthPotential.growthTimeline).toBeDefined();
      
      expect(dealMemo.aegisDealMemo.riskAssessment.highPriorityRisks).toBeInstanceOf(Array);
      expect(dealMemo.aegisDealMemo.riskAssessment.mediumPriorityRisks).toBeInstanceOf(Array);
      
      expect(dealMemo.aegisDealMemo.investmentRecommendation.narrative).toBeDefined();
      expect(dealMemo.aegisDealMemo.investmentRecommendation.keyDiligenceQuestions).toBeInstanceOf(Array);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent document processing', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/upload')
          .attach('files', testDocuments[0], `test-${i}-${testFilenames[0]}`)
          .expect(200);
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.documents).toHaveLength(1);
      });

      // Verify all requests were processed
      expect(mockServices.documentProcessor.processDocument).toHaveBeenCalledTimes(concurrentRequests);
    });

    it('should complete deal memo generation within performance thresholds', async () => {
      const startTime = Date.now();

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      const totalTime = Date.now() - startTime;
      
      expect(dealMemoResponse.body.success).toBe(true);
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      // Verify performance metadata is included
      expect(dealMemoResponse.body.data.processingTime).toBeDefined();
      expect(dealMemoResponse.body.data.processingTime).toBeGreaterThan(0);
    });

    it('should handle large document sets efficiently', async () => {
      // Create multiple test documents
      const largeDocumentSet = Array(10).fill(testDocuments[0]);
      const largeFilenameSet = Array(10).fill(0).map((_, i) => `large-test-${i}.pdf`);

      const uploadRequest = request(app).post('/api/upload');
      
      largeDocumentSet.forEach((doc, index) => {
        uploadRequest.attach('files', doc, largeFilenameSet[index]);
      });

      const uploadResponse = await uploadRequest.expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.documents).toHaveLength(10);
      expect(uploadResponse.body.data.summary.successfullyProcessed).toBe(10);

      // Verify processing time is reasonable
      const processingTime = uploadResponse.body.data.processingTime;
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Google Cloud Service Integration', () => {
    it('should integrate with Google Cloud Vision for OCR', async () => {
      // Mock OCR processing
      mockServices.documentProcessor.processDocument.mockResolvedValue({
        document: createMockDocument('ocr-doc', 'image-heavy.pdf', 'OCR extracted text'),
        validation: { isValid: true, errors: [], warnings: [] },
        processingLogs: ['OCR processing completed'],
        warnings: []
      });

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], 'image-heavy.pdf')
        .field('enableOCR', 'true')
        .field('ocrLanguageHints', 'en,es')
        .field('ocrConfidenceThreshold', '0.8')
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.documents[0].extractionMethod).toBe('ocr');
      
      // Verify OCR options were passed correctly
      expect(mockServices.documentProcessor.processDocument).toHaveBeenCalledWith(
        expect.any(Buffer),
        'image-heavy.pdf',
        'application/pdf'
      );
    });

    it('should integrate with BigQuery for benchmarking', async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId,
          includeBenchmarking: true
        })
        .expect(200);

      expect(dealMemoResponse.body.success).toBe(true);
      expect(mockServices.bigQueryConnector.getBenchmarks).toHaveBeenCalled();
      
      const dealMemo = dealMemoResponse.body.data.dealMemo;
      expect(dealMemo.aegisDealMemo.keyBenchmarks).toBeInstanceOf(Array);
      expect(dealMemo.aegisDealMemo.keyBenchmarks.length).toBeGreaterThan(0);
    });

    it('should integrate with Firebase for persistence', async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId
        })
        .expect(200);

      expect(dealMemoResponse.body.success).toBe(true);
      expect(mockServices.firebaseStorage.saveDealMemo).toHaveBeenCalled();
      
      // Verify deal memo was saved with correct structure
      const savedDealMemo = mockServices.firebaseStorage.saveDealMemo.mock.calls[0][0];
      expect(savedDealMemo.aegisDealMemo).toBeDefined();
    });

    it('should handle Google Cloud service failures gracefully', async () => {
      // Mock BigQuery failure
      mockServices.bigQueryConnector.getBenchmarks.mockRejectedValue(
        new Error('BigQuery service unavailable')
      );

      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocuments[0], testFilenames[0])
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId: uploadResponse.body.data.sessionId,
          includeBenchmarking: true
        })
        .expect(200);

      expect(dealMemoResponse.body.success).toBe(true);
      
      // Should still generate deal memo without benchmarking
      const dealMemo = dealMemoResponse.body.data.dealMemo;
      expect(dealMemo.aegisDealMemo).toBeDefined();
      
      // Should include warning about missing benchmarks
      expect(dealMemoResponse.body.data.warnings).toContain(
        expect.stringContaining('benchmarking')
      );
    });
  });
});

// Helper functions
async function ensureTestDocuments(testDataPath: string) {
  try {
    await fs.access(testDataPath);
  } catch {
    await fs.mkdir(testDataPath, { recursive: true });
  }

  // Create sample PDF content (mock)
  const samplePdfPath = path.join(testDataPath, 'sample-pitch-deck.pdf');
  try {
    await fs.access(samplePdfPath);
  } catch {
    await fs.writeFile(samplePdfPath, Buffer.from('Mock PDF content for testing'));
  }

  // Create sample transcript
  const sampleTranscriptPath = path.join(testDataPath, 'sample-transcript.txt');
  try {
    await fs.access(sampleTranscriptPath);
  } catch {
    await fs.writeFile(sampleTranscriptPath, `
Founder: Our company, TestCorp, is a SaaS platform serving enterprise customers.
We currently have $2M in ARR with 150 customers and are growing 15% month-over-month.
Our team consists of 25 people, including myself and my co-founder who has 10 years of experience in enterprise software.
We're raising $5M Series A to expand our sales team and accelerate growth.
The total addressable market is $50B and we're targeting the mid-market segment.
    `);
  }

  // Create sample DOCX content (mock)
  const sampleDocxPath = path.join(testDataPath, 'sample-financials.docx');
  try {
    await fs.access(sampleDocxPath);
  } catch {
    await fs.writeFile(sampleDocxPath, Buffer.from('Mock DOCX content for testing'));
  }
}

function setupServiceMocks() {
  // Mock DocumentProcessor
  const mockDocumentProcessor = {
    processDocument: vi.fn().mockResolvedValue(createMockProcessingResult('test-doc', 'success')),
    validateContent: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    detectFileType: vi.fn().mockReturnValue('application/pdf'),
  };

  // Mock GeminiAnalyzer
  const mockGeminiAnalyzer = {
    analyzeContent: vi.fn().mockResolvedValue(createMockAnalysisResult()),
    extractEntities: vi.fn().mockResolvedValue({}),
    validateConsistency: vi.fn().mockResolvedValue([]),
  };

  // Mock BigQueryConnector
  const mockBigQueryConnector = {
    getBenchmarks: vi.fn().mockResolvedValue(createMockBenchmarkData()),
    classifySector: vi.fn().mockResolvedValue({ sector: 'SaaS', confidence: 0.9 }),
  };

  // Mock FirebaseStorage
  const mockFirebaseStorage = {
    saveDealMemo: vi.fn().mockResolvedValue({ id: 'saved-deal-memo-id' }),
    getDealMemo: vi.fn().mockResolvedValue(null),
    updateDealMemo: vi.fn().mockResolvedValue(true),
  };

  // Apply mocks
  vi.mocked(DocumentProcessorFactory).mockImplementation(() => mockDocumentProcessor);
  vi.mocked(GeminiAnalyzer).mockImplementation(() => mockGeminiAnalyzer);
  vi.mocked(BigQueryConnector).mockImplementation(() => mockBigQueryConnector);
  vi.mocked(FirebaseStorage).mockImplementation(() => mockFirebaseStorage);

  return {
    documentProcessor: mockDocumentProcessor,
    geminiAnalyzer: mockGeminiAnalyzer,
    bigQueryConnector: mockBigQueryConnector,
    firebaseStorage: mockFirebaseStorage,
  };
}

function createMockProcessingResult(id: string, status: string) {
  return {
    document: createMockDocument(id, `${id}.pdf`, 'Mock document content'),
    validation: { isValid: true, errors: [], warnings: [] },
    processingLogs: [`Processing ${status}`],
    warnings: [],
  };
}

function createMockDocument(id: string, filename: string, content: string): ProcessedDocument {
  return {
    id,
    sourceType: DocumentType.PDF,
    extractedText: content,
    sections: [
      {
        title: 'Company Overview',
        content: content,
        sourceDocument: filename,
      },
    ],
    metadata: {
      filename,
      fileSize: 1024,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
      processingStatus: ProcessingStatus.COMPLETED,
    },
    processingTimestamp: new Date(),
    processingDuration: 1000,
    wordCount: content.split(' ').length,
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
}

function createMockAnalysisResult() {
  return {
    companyProfile: {
      name: 'TestCorp',
      oneLiner: 'SaaS platform for enterprises',
      sector: 'SaaS',
      stage: 'series-a',
      foundedYear: 2022,
      location: 'San Francisco',
    },
    extractedMetrics: {
      revenue: { arr: 2000000, growthRate: 15 },
      traction: { customers: 150, customerGrowthRate: 10 },
      team: { size: 25, foundersCount: 2 },
      funding: { totalRaised: 1000000, currentAsk: 5000000 },
    },
    marketClaims: {
      tam: 50000000000,
      marketDescription: 'Enterprise SaaS market',
      competitiveLandscape: ['Competitor A', 'Competitor B'],
    },
    teamAssessment: {
      founders: [
        { name: 'John Doe', role: 'CEO', experience: '10 years' },
        { name: 'Jane Smith', role: 'CTO', experience: '8 years' },
      ],
      totalSize: 25,
      domainExpertise: ['SaaS', 'Enterprise Software'],
    },
    consistencyFlags: [],
    sourceDocumentIds: ['test-doc'],
    processingTime: 5000,
    analysisTimestamp: new Date(),
  };
}

function createMockBenchmarkData() {
  return {
    sector: 'SaaS',
    sampleSize: 100,
    metrics: {
      arr: {
        p25: 500000,
        p50: 1500000,
        p75: 5000000,
        p90: 15000000,
      },
      growthRate: {
        p25: 5,
        p50: 12,
        p75: 25,
        p90: 50,
      },
      teamSize: {
        p25: 10,
        p50: 20,
        p75: 50,
        p90: 100,
      },
    },
    lastUpdated: new Date(),
  };
}