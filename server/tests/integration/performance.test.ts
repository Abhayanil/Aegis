import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { performance } from 'perf_hooks';

// Import routes
import uploadRoutes from '../../src/routes/upload.js';
import dealMemoRoutes from '../../src/routes/dealMemo.js';

// Import services for mocking
import { DocumentProcessorFactory } from '../../src/services/document/DocumentProcessor.js';
import { GeminiAnalyzer } from '../../src/services/ai/GeminiAnalyzer.js';
import { BigQueryConnector } from '../../src/services/benchmarking/BigQueryConnector.js';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  SINGLE_DOCUMENT_UPLOAD: 5000,
  MULTIPLE_DOCUMENT_UPLOAD: 15000,
  DEAL_MEMO_GENERATION: 20000,
  CONCURRENT_REQUESTS: 30000,
  LARGE_DOCUMENT_PROCESSING: 45000,
};

// Load testing configuration
const LOAD_TEST_CONFIG = {
  CONCURRENT_USERS: 10,
  REQUESTS_PER_USER: 5,
  RAMP_UP_TIME: 2000, // 2 seconds
};

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);
app.use('/api/deal-memo', dealMemoRoutes);

describe('Performance and Load Testing', () => {
  let mockServices: any;
  let testDocument: Buffer;

  beforeAll(() => {
    // Create a test document buffer
    testDocument = Buffer.from('Mock document content for performance testing. '.repeat(1000));
  });

  beforeEach(() => {
    mockServices = setupPerformanceMocks();
  });

  describe('Single Document Processing Performance', () => {
    it('should process single document within performance threshold', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .post('/api/upload')
        .attach('files', testDocument, 'test-document.pdf')
        .expect(200);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_DOCUMENT_UPLOAD);
      
      // Log performance metrics
      console.log(`Single document processing time: ${processingTime.toFixed(2)}ms`);
      
      // Verify response includes timing information
      expect(response.body.data.processingTime).toBeDefined();
      expect(response.body.data.processingTime).toBeGreaterThan(0);
    });

    it('should maintain consistent performance across multiple single uploads', async () => {
      const iterations = 5;
      const processingTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        const response = await request(app)
          .post('/api/upload')
          .attach('files', testDocument, `test-document-${i}.pdf`)
          .expect(200);

        const endTime = performance.now();
        const processingTime = endTime - startTime;
        processingTimes.push(processingTime);

        expect(response.body.success).toBe(true);
      }

      // Calculate performance statistics
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxTime = Math.max(...processingTimes);
      const minTime = Math.min(...processingTimes);
      const variance = processingTimes.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / processingTimes.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Performance Statistics (${iterations} iterations):`);
      console.log(`  Average: ${avgTime.toFixed(2)}ms`);
      console.log(`  Min: ${minTime.toFixed(2)}ms`);
      console.log(`  Max: ${maxTime.toFixed(2)}ms`);
      console.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);

      // Verify performance consistency
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_DOCUMENT_UPLOAD);
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_DOCUMENT_UPLOAD * 1.5);
      expect(stdDev).toBeLessThan(avgTime * 0.3); // Standard deviation should be less than 30% of average
    });
  });

  describe('Multiple Document Processing Performance', () => {
    it('should process multiple documents efficiently', async () => {
      const documentCount = 5;
      const documents = Array(documentCount).fill(testDocument);
      const filenames = Array(documentCount).fill(0).map((_, i) => `test-doc-${i}.pdf`);

      const startTime = performance.now();

      const uploadRequest = request(app).post('/api/upload');
      documents.forEach((doc, index) => {
        uploadRequest.attach('files', doc, filenames[index]);
      });

      const response = await uploadRequest.expect(200);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toHaveLength(documentCount);
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MULTIPLE_DOCUMENT_UPLOAD);

      console.log(`Multiple document processing time (${documentCount} docs): ${processingTime.toFixed(2)}ms`);
      console.log(`Average per document: ${(processingTime / documentCount).toFixed(2)}ms`);

      // Verify parallel processing efficiency
      const avgPerDocument = processingTime / documentCount;
      expect(avgPerDocument).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_DOCUMENT_UPLOAD * 0.8); // Should be more efficient than sequential
    });

    it('should scale processing time linearly with document count', async () => {
      const documentCounts = [1, 3, 5, 8];
      const processingTimes: { count: number; time: number }[] = [];

      for (const count of documentCounts) {
        const documents = Array(count).fill(testDocument);
        const filenames = Array(count).fill(0).map((_, i) => `scale-test-${count}-${i}.pdf`);

        const startTime = performance.now();

        const uploadRequest = request(app).post('/api/upload');
        documents.forEach((doc, index) => {
          uploadRequest.attach('files', doc, filenames[index]);
        });

        const response = await uploadRequest.expect(200);
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        processingTimes.push({ count, time: processingTime });

        expect(response.body.success).toBe(true);
        expect(response.body.data.documents).toHaveLength(count);
      }

      // Analyze scaling characteristics
      console.log('Scaling Analysis:');
      processingTimes.forEach(({ count, time }) => {
        console.log(`  ${count} documents: ${time.toFixed(2)}ms (${(time / count).toFixed(2)}ms per doc)`);
      });

      // Verify reasonable scaling (should not be exponential)
      const timePerDocRatios = processingTimes.map(({ count, time }) => time / count);
      const maxRatio = Math.max(...timePerDocRatios);
      const minRatio = Math.min(...timePerDocRatios);
      const scalingFactor = maxRatio / minRatio;

      expect(scalingFactor).toBeLessThan(2.0); // Scaling factor should be reasonable
    });
  });

  describe('Deal Memo Generation Performance', () => {
    it('should generate deal memo within performance threshold', async () => {
      // First upload documents
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocument, 'test-document.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);
      const sessionId = uploadResponse.body.data.sessionId;

      // Measure deal memo generation time
      const startTime = performance.now();

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId,
          analysisWeightings: {
            marketOpportunity: 25,
            team: 25,
            traction: 20,
            product: 15,
            competitivePosition: 15
          }
        })
        .expect(200);

      const endTime = performance.now();
      const generationTime = endTime - startTime;

      expect(dealMemoResponse.body.success).toBe(true);
      expect(generationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DEAL_MEMO_GENERATION);

      console.log(`Deal memo generation time: ${generationTime.toFixed(2)}ms`);

      // Verify response includes performance metadata
      expect(dealMemoResponse.body.data.processingTime).toBeDefined();
      expect(dealMemoResponse.body.data.dealMemo).toBeDefined();
    });

    it('should handle complex analysis configurations efficiently', async () => {
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('files', testDocument, 'complex-test.pdf')
        .expect(200);

      const documentIds = uploadResponse.body.data.documents.map((doc: any) => doc.id);
      const sessionId = uploadResponse.body.data.sessionId;

      const startTime = performance.now();

      const dealMemoResponse = await request(app)
        .post('/api/deal-memo/generate')
        .send({
          documentIds,
          sessionId,
          analysisWeightings: {
            marketOpportunity: 30,
            team: 20,
            traction: 25,
            product: 15,
            competitivePosition: 10
          },
          includeRiskAssessment: true,
          includeBenchmarking: true,
          includeCompetitiveAnalysis: true,
          detailedFinancialAnalysis: true
        })
        .expect(200);

      const endTime = performance.now();
      const generationTime = endTime - startTime;

      expect(dealMemoResponse.body.success).toBe(true);
      expect(generationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DEAL_MEMO_GENERATION * 1.5); // Allow 50% more time for complex analysis

      console.log(`Complex deal memo generation time: ${generationTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent upload requests efficiently', async () => {
      const concurrentRequests = LOAD_TEST_CONFIG.CONCURRENT_USERS;
      const startTime = performance.now();

      const promises = Array(concurrentRequests).fill(0).map((_, i) =>
        request(app)
          .post('/api/upload')
          .attach('files', testDocument, `concurrent-test-${i}.pdf`)
      );

      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS);

      console.log(`Concurrent requests (${concurrentRequests}): ${totalTime.toFixed(2)}ms`);
      console.log(`Average per request: ${(totalTime / concurrentRequests).toFixed(2)}ms`);

      // Verify concurrent processing is more efficient than sequential
      const avgPerRequest = totalTime / concurrentRequests;
      expect(avgPerRequest).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_DOCUMENT_UPLOAD);
    });

    it('should maintain performance under sustained load', async () => {
      const usersCount = LOAD_TEST_CONFIG.CONCURRENT_USERS;
      const requestsPerUser = LOAD_TEST_CONFIG.REQUESTS_PER_USER;
      const totalRequests = usersCount * requestsPerUser;

      const startTime = performance.now();
      const promises: Promise<any>[] = [];

      // Simulate ramped load
      for (let user = 0; user < usersCount; user++) {
        setTimeout(() => {
          for (let req = 0; req < requestsPerUser; req++) {
            const promise = request(app)
              .post('/api/upload')
              .attach('files', testDocument, `load-test-${user}-${req}.pdf`);
            promises.push(promise);
          }
        }, (user * LOAD_TEST_CONFIG.RAMP_UP_TIME) / usersCount);
      }

      // Wait for all requests to complete
      await new Promise(resolve => setTimeout(resolve, LOAD_TEST_CONFIG.RAMP_UP_TIME + 5000));
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all requests succeeded
      const successfulRequests = responses.filter(r => r.status === 200).length;
      const successRate = (successfulRequests / totalRequests) * 100;

      expect(successRate).toBeGreaterThan(95); // At least 95% success rate
      console.log(`Load test: ${totalRequests} requests, ${successRate.toFixed(1)}% success rate`);
      console.log(`Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${(totalRequests / (totalTime / 1000)).toFixed(2)} requests/second`);
    });
  });

  describe('Large Document Processing', () => {
    it('should handle large documents efficiently', async () => {
      // Create a large test document (5MB)
      const largeDocument = Buffer.from('Large document content. '.repeat(250000));
      
      const startTime = performance.now();

      const response = await request(app)
        .post('/api/upload')
        .attach('files', largeDocument, 'large-document.pdf')
        .expect(200);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DOCUMENT_PROCESSING);

      console.log(`Large document processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Document size: ${(largeDocument.length / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Processing rate: ${(largeDocument.length / 1024 / (processingTime / 1000)).toFixed(2)} KB/s`);

      // Verify processing rate is reasonable
      const processingRateKBps = largeDocument.length / 1024 / (processingTime / 1000);
      expect(processingRateKBps).toBeGreaterThan(100); // At least 100 KB/s
    });

    it('should handle memory efficiently with large documents', async () => {
      const initialMemory = process.memoryUsage();
      const largeDocument = Buffer.from('Memory test content. '.repeat(500000)); // 10MB

      const response = await request(app)
        .post('/api/upload')
        .attach('files', largeDocument, 'memory-test.pdf')
        .expect(200);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(response.body.success).toBe(true);
      
      console.log(`Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Document size: ${(largeDocument.length / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (not more than 3x document size)
      expect(memoryIncrease).toBeLessThan(largeDocument.length * 3);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in document processing', async () => {
      const baselineRuns = 3;
      const testRuns = 3;
      const baselineTimes: number[] = [];
      const testTimes: number[] = [];

      // Establish baseline
      for (let i = 0; i < baselineRuns; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/upload')
          .attach('files', testDocument, `baseline-${i}.pdf`)
          .expect(200);

        const endTime = performance.now();
        baselineTimes.push(endTime - startTime);
        expect(response.body.success).toBe(true);
      }

      // Run test measurements
      for (let i = 0; i < testRuns; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/upload')
          .attach('files', testDocument, `test-${i}.pdf`)
          .expect(200);

        const endTime = performance.now();
        testTimes.push(endTime - startTime);
        expect(response.body.success).toBe(true);
      }

      const baselineAvg = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
      const testAvg = testTimes.reduce((a, b) => a + b, 0) / testTimes.length;
      const regressionThreshold = 1.2; // 20% regression threshold

      console.log(`Baseline average: ${baselineAvg.toFixed(2)}ms`);
      console.log(`Test average: ${testAvg.toFixed(2)}ms`);
      console.log(`Performance ratio: ${(testAvg / baselineAvg).toFixed(2)}`);

      // Verify no significant performance regression
      expect(testAvg).toBeLessThan(baselineAvg * regressionThreshold);
    });
  });
});

function setupPerformanceMocks() {
  // Mock DocumentProcessor with realistic timing
  const mockDocumentProcessor = {
    processDocument: vi.fn().mockImplementation(async (buffer: Buffer, filename: string) => {
      // Simulate processing time based on document size
      const processingTime = Math.max(100, buffer.length / 10000); // Minimum 100ms, scale with size
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      return {
        document: {
          id: `processed-${Date.now()}-${Math.random()}`,
          sourceType: 'pdf',
          extractedText: `Processed content from ${filename}`,
          sections: [],
          metadata: {
            filename,
            fileSize: buffer.length,
            mimeType: 'application/pdf',
            uploadedAt: new Date(),
            processingStatus: 'completed',
          },
          processingTimestamp: new Date(),
          processingDuration: processingTime,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        validation: { isValid: true, errors: [], warnings: [] },
        processingLogs: [`Processed ${filename} in ${processingTime}ms`],
        warnings: [],
      };
    }),
    validateContent: vi.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    detectFileType: vi.fn().mockReturnValue('application/pdf'),
  };

  // Mock GeminiAnalyzer with realistic timing
  const mockGeminiAnalyzer = {
    analyzeContent: vi.fn().mockImplementation(async (documents: any[]) => {
      // Simulate AI processing time
      const processingTime = Math.max(1000, documents.length * 500); // Minimum 1s, scale with document count
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      return {
        companyProfile: {
          name: 'TestCorp',
          oneLiner: 'AI-powered test company',
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
          marketDescription: 'Large market opportunity',
          competitiveLandscape: ['Competitor A', 'Competitor B'],
        },
        teamAssessment: {
          founders: [
            { name: 'John Doe', role: 'CEO' },
            { name: 'Jane Smith', role: 'CTO' },
          ],
          totalSize: 25,
          domainExpertise: ['SaaS', 'AI'],
        },
        consistencyFlags: [],
        sourceDocumentIds: documents.map(d => d.id),
        processingTime: processingTime,
        analysisTimestamp: new Date(),
      };
    }),
  };

  // Mock BigQueryConnector with realistic timing
  const mockBigQueryConnector = {
    getBenchmarks: vi.fn().mockImplementation(async () => {
      // Simulate database query time
      await new Promise(resolve => setTimeout(resolve, 200));
      
      return {
        sector: 'SaaS',
        sampleSize: 100,
        metrics: {
          arr: { p25: 500000, p50: 1500000, p75: 5000000, p90: 15000000 },
          growthRate: { p25: 5, p50: 12, p75: 25, p90: 50 },
          teamSize: { p25: 10, p50: 20, p75: 50, p90: 100 },
        },
        lastUpdated: new Date(),
      };
    }),
  };

  // Apply mocks
  vi.mocked(DocumentProcessorFactory).mockImplementation(() => mockDocumentProcessor);
  vi.mocked(GeminiAnalyzer).mockImplementation(() => mockGeminiAnalyzer);
  vi.mocked(BigQueryConnector).mockImplementation(() => mockBigQueryConnector);

  return {
    documentProcessor: mockDocumentProcessor,
    geminiAnalyzer: mockGeminiAnalyzer,
    bigQueryConnector: mockBigQueryConnector,
  };
}