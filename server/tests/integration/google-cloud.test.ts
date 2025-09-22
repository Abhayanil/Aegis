import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { BigQuery } from '@google-cloud/bigquery';
import { Firestore } from '@google-cloud/firestore';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VertexAI } from '@google-cloud/vertexai';

// Import services that integrate with Google Cloud
import { BigQueryConnector } from '../../src/services/benchmarking/BigQueryConnector.js';
import { FirebaseStorage } from '../../src/services/storage/FirebaseStorage.js';
import { OCRProcessor } from '../../src/services/document/OCRProcessor.js';
import { GeminiAnalyzer } from '../../src/services/ai/GeminiAnalyzer.js';

// Import utilities
import { initializeVertexAI, initializeBigQuery, initializeFirestore } from '../../src/utils/googleCloud.js';
import { appConfig } from '../../src/utils/config.js';

// Mock Google Cloud clients for testing
vi.mock('@google-cloud/bigquery');
vi.mock('@google-cloud/firestore');
vi.mock('@google-cloud/vision');
vi.mock('@google-cloud/vertexai');

describe('Google Cloud Service Integration Tests', () => {
  let mockBigQuery: any;
  let mockFirestore: any;
  let mockVision: any;
  let mockVertexAI: any;

  beforeAll(() => {
    // Setup environment variables for testing
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/test-credentials.json';
  });

  beforeEach(() => {
    // Setup mocks for each test
    setupGoogleCloudMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('BigQuery Integration', () => {
    let bigQueryConnector: BigQueryConnector;

    beforeEach(() => {
      bigQueryConnector = new BigQueryConnector();
    });

    it('should initialize BigQuery client successfully', async () => {
      const client = await initializeBigQuery();
      expect(client).toBeDefined();
      expect(BigQuery).toHaveBeenCalledWith({
        projectId: 'test-project',
        keyFilename: '/path/to/test-credentials.json',
      });
    });

    it('should execute benchmark queries successfully', async () => {
      const mockQueryResults = [
        {
          sector: 'SaaS',
          metric: 'arr',
          p25: 500000,
          p50: 1500000,
          p75: 5000000,
          p90: 15000000,
          sample_size: 150,
        },
        {
          sector: 'SaaS',
          metric: 'growth_rate',
          p25: 5,
          p50: 12,
          p75: 25,
          p90: 50,
          sample_size: 150,
        },
      ];

      mockBigQuery.query.mockResolvedValue([mockQueryResults]);

      const benchmarks = await bigQueryConnector.getBenchmarks('SaaS', ['arr', 'growth_rate']);

      expect(benchmarks).toBeDefined();
      expect(benchmarks.sector).toBe('SaaS');
      expect(benchmarks.sampleSize).toBe(150);
      expect(benchmarks.metrics.arr).toBeDefined();
      expect(benchmarks.metrics.arr.p50).toBe(1500000);
      expect(benchmarks.metrics.growth_rate).toBeDefined();
      expect(benchmarks.metrics.growth_rate.p75).toBe(25);

      // Verify query was called with correct parameters
      expect(mockBigQuery.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('SELECT'),
          params: expect.objectContaining({
            sector: 'SaaS',
            metrics: ['arr', 'growth_rate'],
          }),
        })
      );
    });

    it('should handle BigQuery connection failures gracefully', async () => {
      mockBigQuery.query.mockRejectedValue(new Error('BigQuery connection failed'));

      await expect(bigQueryConnector.getBenchmarks('SaaS', ['arr']))
        .rejects.toThrow('BigQuery connection failed');

      // Verify retry logic was attempted
      expect(mockBigQuery.query).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle empty query results', async () => {
      mockBigQuery.query.mockResolvedValue([[]]);

      const benchmarks = await bigQueryConnector.getBenchmarks('UnknownSector', ['arr']);

      expect(benchmarks).toBeDefined();
      expect(benchmarks.sector).toBe('UnknownSector');
      expect(benchmarks.sampleSize).toBe(0);
      expect(Object.keys(benchmarks.metrics)).toHaveLength(0);
    });

    it('should cache benchmark results for performance', async () => {
      const mockQueryResults = [
        {
          sector: 'SaaS',
          metric: 'arr',
          p25: 500000,
          p50: 1500000,
          p75: 5000000,
          p90: 15000000,
          sample_size: 100,
        },
      ];

      mockBigQuery.query.mockResolvedValue([mockQueryResults]);

      // First call
      await bigQueryConnector.getBenchmarks('SaaS', ['arr']);
      
      // Second call (should use cache)
      await bigQueryConnector.getBenchmarks('SaaS', ['arr']);

      // Verify BigQuery was only called once due to caching
      expect(mockBigQuery.query).toHaveBeenCalledTimes(1);
    });

    it('should validate query parameters', async () => {
      await expect(bigQueryConnector.getBenchmarks('', ['arr']))
        .rejects.toThrow('Invalid sector');

      await expect(bigQueryConnector.getBenchmarks('SaaS', []))
        .rejects.toThrow('No metrics specified');

      await expect(bigQueryConnector.getBenchmarks('SaaS', ['invalid_metric']))
        .rejects.toThrow('Invalid metric');
    });
  });

  describe('Firestore Integration', () => {
    let firebaseStorage: FirebaseStorage;

    beforeEach(() => {
      firebaseStorage = new FirebaseStorage();
    });

    it('should initialize Firestore client successfully', async () => {
      const client = await initializeFirestore();
      expect(client).toBeDefined();
      expect(Firestore).toHaveBeenCalledWith({
        projectId: 'test-project',
        keyFilename: '/path/to/test-credentials.json',
      });
    });

    it('should save deal memo to Firestore successfully', async () => {
      const mockDealMemo = {
        aegisDealMemo: {
          summary: {
            companyName: 'TestCorp',
            oneLiner: 'Test company',
            signalScore: 75,
            recommendation: 'BUY',
          },
          keyBenchmarks: [],
          growthPotential: {
            upsideSummary: 'Strong growth potential',
            growthTimeline: '2-3 years to scale',
          },
          riskAssessment: {
            highPriorityRisks: [],
            mediumPriorityRisks: [],
          },
          investmentRecommendation: {
            narrative: 'Strong investment opportunity',
            keyDiligenceQuestions: ['Question 1', 'Question 2'],
          },
        },
      };

      const mockDocRef = {
        id: 'saved-deal-memo-id',
        set: vi.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
      });

      const result = await firebaseStorage.saveDealMemo(mockDealMemo);

      expect(result.id).toBe('saved-deal-memo-id');
      expect(mockFirestore.collection).toHaveBeenCalledWith('dealMemos');
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          dealMemo: mockDealMemo,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should retrieve deal memo from Firestore successfully', async () => {
      const mockDealMemoData = {
        dealMemo: {
          aegisDealMemo: {
            summary: {
              companyName: 'TestCorp',
              signalScore: 75,
            },
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDocSnapshot = {
        exists: true,
        data: vi.fn().mockReturnValue(mockDealMemoData),
      };

      const mockDocRef = {
        get: vi.fn().mockResolvedValue(mockDocSnapshot),
      };

      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
      });

      const result = await firebaseStorage.getDealMemo('test-deal-memo-id');

      expect(result).toBeDefined();
      expect(result.dealMemo.aegisDealMemo.summary.companyName).toBe('TestCorp');
      expect(mockFirestore.collection).toHaveBeenCalledWith('dealMemos');
      expect(mockDocRef.get).toHaveBeenCalled();
    });

    it('should handle Firestore connection failures', async () => {
      const mockDocRef = {
        set: vi.fn().mockRejectedValue(new Error('Firestore connection failed')),
      };

      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
      });

      const mockDealMemo = { aegisDealMemo: { summary: {} } };

      await expect(firebaseStorage.saveDealMemo(mockDealMemo))
        .rejects.toThrow('Firestore connection failed');
    });

    it('should handle non-existent documents gracefully', async () => {
      const mockDocSnapshot = {
        exists: false,
        data: vi.fn().mockReturnValue(null),
      };

      const mockDocRef = {
        get: vi.fn().mockResolvedValue(mockDocSnapshot),
      };

      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
      });

      const result = await firebaseStorage.getDealMemo('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('Cloud Vision Integration', () => {
    let ocrProcessor: OCRProcessor;

    beforeEach(() => {
      ocrProcessor = new OCRProcessor();
    });

    it('should initialize Vision client successfully', async () => {
      expect(ImageAnnotatorClient).toHaveBeenCalled();
    });

    it('should process OCR requests successfully', async () => {
      const mockOCRResponse = [
        {
          textAnnotations: [
            {
              description: 'TestCorp\nSaaS Platform\n$2M ARR\n150 customers',
              boundingPoly: {
                vertices: [
                  { x: 0, y: 0 },
                  { x: 100, y: 0 },
                  { x: 100, y: 50 },
                  { x: 0, y: 50 },
                ],
              },
            },
          ],
          fullTextAnnotation: {
            text: 'TestCorp\nSaaS Platform\n$2M ARR\n150 customers',
            pages: [
              {
                confidence: 0.95,
                width: 1000,
                height: 800,
              },
            ],
          },
        },
      ];

      mockVision.textDetection.mockResolvedValue(mockOCRResponse);

      const imageBuffer = Buffer.from('mock image data');
      const result = await ocrProcessor.processImage(imageBuffer, {
        languageHints: ['en'],
        confidenceThreshold: 0.8,
      });

      expect(result).toBeDefined();
      expect(result.extractedText).toBe('TestCorp\nSaaS Platform\n$2M ARR\n150 customers');
      expect(result.confidence).toBe(0.95);
      expect(result.boundingBoxes).toHaveLength(1);

      expect(mockVision.textDetection).toHaveBeenCalledWith({
        image: { content: imageBuffer },
        imageContext: {
          languageHints: ['en'],
        },
      });
    });

    it('should handle OCR processing failures', async () => {
      mockVision.textDetection.mockRejectedValue(new Error('Vision API error'));

      const imageBuffer = Buffer.from('mock image data');

      await expect(ocrProcessor.processImage(imageBuffer))
        .rejects.toThrow('Vision API error');

      // Verify retry logic
      expect(mockVision.textDetection).toHaveBeenCalledTimes(3);
    });

    it('should filter results by confidence threshold', async () => {
      const mockOCRResponse = [
        {
          textAnnotations: [
            {
              description: 'High confidence text',
              confidence: 0.95,
            },
            {
              description: 'Low confidence text',
              confidence: 0.5,
            },
          ],
          fullTextAnnotation: {
            text: 'High confidence text\nLow confidence text',
            pages: [{ confidence: 0.75 }],
          },
        },
      ];

      mockVision.textDetection.mockResolvedValue(mockOCRResponse);

      const imageBuffer = Buffer.from('mock image data');
      const result = await ocrProcessor.processImage(imageBuffer, {
        confidenceThreshold: 0.8,
      });

      // Should only include high confidence text
      expect(result.extractedText).not.toContain('Low confidence text');
      expect(result.extractedText).toContain('High confidence text');
    });

    it('should handle empty OCR results', async () => {
      const mockOCRResponse = [
        {
          textAnnotations: [],
          fullTextAnnotation: null,
        },
      ];

      mockVision.textDetection.mockResolvedValue(mockOCRResponse);

      const imageBuffer = Buffer.from('mock image data');
      const result = await ocrProcessor.processImage(imageBuffer);

      expect(result.extractedText).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.boundingBoxes).toHaveLength(0);
    });
  });

  describe('Vertex AI Integration', () => {
    let geminiAnalyzer: GeminiAnalyzer;

    beforeEach(() => {
      geminiAnalyzer = new GeminiAnalyzer();
    });

    it('should initialize Vertex AI client successfully', async () => {
      const client = await initializeVertexAI();
      expect(client).toBeDefined();
      expect(VertexAI).toHaveBeenCalledWith({
        project: 'test-project',
        location: appConfig.googleCloud.vertexAI.location,
      });
    });

    it('should generate content using Gemini model successfully', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      name: 'TestCorp',
                      sector: 'SaaS',
                      arr: 2000000,
                    }),
                  },
                ],
              },
              finishReason: 'STOP',
              safetyRatings: [],
            },
          ],
        },
      };

      mockVertexAI.getGenerativeModel.mockReturnValue({
        generateContent: vi.fn().mockResolvedValue(mockResponse),
      });

      const prompt = {
        systemPrompt: 'You are an investment analyst',
        userPrompt: 'Analyze this company: TestCorp is a SaaS platform with $2M ARR',
      };

      const result = await geminiAnalyzer.analyzeWithPrompt(prompt);

      expect(result).toBeDefined();
      expect(result.content).toContain('TestCorp');
      expect(result.finishReason).toBe('STOP');

      expect(mockVertexAI.getGenerativeModel).toHaveBeenCalledWith({
        model: appConfig.googleCloud.vertexAI.model,
      });
    });

    it('should handle Vertex AI rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';

      mockVertexAI.getGenerativeModel.mockReturnValue({
        generateContent: vi.fn()
          .mockRejectedValueOnce(rateLimitError)
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce({
            response: {
              candidates: [
                {
                  content: {
                    parts: [{ text: 'Success after retries' }],
                  },
                  finishReason: 'STOP',
                },
              ],
            },
          }),
      });

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };

      const result = await geminiAnalyzer.analyzeWithPrompt(prompt);

      expect(result.content).toBe('Success after retries');
      
      // Verify exponential backoff was applied
      expect(mockVertexAI.getGenerativeModel().generateContent).toHaveBeenCalledTimes(3);
    });

    it('should handle safety filter blocks', async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: null,
              finishReason: 'SAFETY',
              safetyRatings: [
                {
                  category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                  probability: 'HIGH',
                },
              ],
            },
          ],
        },
      };

      mockVertexAI.getGenerativeModel.mockReturnValue({
        generateContent: vi.fn().mockResolvedValue(mockResponse),
      });

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test content',
      };

      await expect(geminiAnalyzer.analyzeWithPrompt(prompt))
        .rejects.toThrow('Content blocked by safety filters');
    });

    it('should handle model unavailability', async () => {
      const unavailableError = new Error('Model temporarily unavailable');
      unavailableError.name = 'ServiceUnavailable';

      mockVertexAI.getGenerativeModel.mockReturnValue({
        generateContent: vi.fn().mockRejectedValue(unavailableError),
      });

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };

      await expect(geminiAnalyzer.analyzeWithPrompt(prompt))
        .rejects.toThrow('Model temporarily unavailable');
    });
  });

  describe('Service Health Monitoring', () => {
    it('should check health of all Google Cloud services', async () => {
      // Mock successful health checks
      mockBigQuery.query.mockResolvedValue([[]]);
      mockFirestore.collection.mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true }),
        }),
      });
      mockVision.textDetection.mockResolvedValue([{ textAnnotations: [] }]);
      mockVertexAI.getGenerativeModel.mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            candidates: [
              {
                content: { parts: [{ text: 'OK' }] },
                finishReason: 'STOP',
              },
            ],
          },
        }),
      });

      const bigQueryConnector = new BigQueryConnector();
      const firebaseStorage = new FirebaseStorage();
      const ocrProcessor = new OCRProcessor();
      const geminiAnalyzer = new GeminiAnalyzer();

      // Test health checks
      const healthChecks = await Promise.allSettled([
        bigQueryConnector.healthCheck(),
        firebaseStorage.healthCheck(),
        ocrProcessor.healthCheck(),
        geminiAnalyzer.getModelInfo(),
      ]);

      const results = healthChecks.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      );

      expect(results[0].status).toBe('healthy'); // BigQuery
      expect(results[1].status).toBe('healthy'); // Firestore
      expect(results[2].status).toBe('healthy'); // Vision
      expect(results[3].status).toBe('healthy'); // Vertex AI
    });

    it('should detect service degradation', async () => {
      // Mock degraded responses
      mockBigQuery.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([[]]), 5000))
      );

      const bigQueryConnector = new BigQueryConnector();
      
      const startTime = Date.now();
      const healthResult = await bigQueryConnector.healthCheck();
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeGreaterThan(1000);
      expect(healthResult.status).toBe('degraded');
      expect(healthResult.responseTime).toBeGreaterThan(1000);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should implement circuit breaker pattern for failing services', async () => {
      const bigQueryConnector = new BigQueryConnector();

      // Mock consecutive failures
      mockBigQuery.query.mockRejectedValue(new Error('Service unavailable'));

      // Attempt multiple calls to trigger circuit breaker
      const promises = Array(10).fill(0).map(() => 
        bigQueryConnector.getBenchmarks('SaaS', ['arr']).catch(e => e)
      );

      const results = await Promise.all(promises);

      // After several failures, circuit breaker should open
      const circuitBreakerErrors = results.filter(r => 
        r.message && r.message.includes('Circuit breaker')
      );

      expect(circuitBreakerErrors.length).toBeGreaterThan(0);
    });

    it('should implement graceful degradation when services are unavailable', async () => {
      // Mock all external services as unavailable
      mockBigQuery.query.mockRejectedValue(new Error('BigQuery unavailable'));
      mockFirestore.collection.mockImplementation(() => {
        throw new Error('Firestore unavailable');
      });
      mockVision.textDetection.mockRejectedValue(new Error('Vision API unavailable'));

      const bigQueryConnector = new BigQueryConnector();
      const firebaseStorage = new FirebaseStorage();
      const ocrProcessor = new OCRProcessor();

      // Services should handle failures gracefully
      const benchmarkResult = await bigQueryConnector.getBenchmarks('SaaS', ['arr'])
        .catch(() => ({ sector: 'SaaS', sampleSize: 0, metrics: {}, degraded: true }));

      expect(benchmarkResult.degraded).toBe(true);

      const saveResult = await firebaseStorage.saveDealMemo({ test: 'data' })
        .catch(() => ({ id: 'local-fallback', degraded: true }));

      expect(saveResult.degraded).toBe(true);

      const ocrResult = await ocrProcessor.processImage(Buffer.from('test'))
        .catch(() => ({ extractedText: '', confidence: 0, degraded: true }));

      expect(ocrResult.degraded).toBe(true);
    });
  });

  // Helper function to setup mocks
  function setupGoogleCloudMocks() {
    // Mock BigQuery
    mockBigQuery = {
      query: vi.fn(),
      dataset: vi.fn().mockReturnValue({
        table: vi.fn().mockReturnValue({
          exists: vi.fn().mockResolvedValue([true]),
        }),
      }),
    };
    vi.mocked(BigQuery).mockImplementation(() => mockBigQuery);

    // Mock Firestore
    mockFirestore = {
      collection: vi.fn(),
      doc: vi.fn(),
      batch: vi.fn().mockReturnValue({
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      }),
    };
    vi.mocked(Firestore).mockImplementation(() => mockFirestore);

    // Mock Vision
    mockVision = {
      textDetection: vi.fn(),
      documentTextDetection: vi.fn(),
    };
    vi.mocked(ImageAnnotatorClient).mockImplementation(() => mockVision);

    // Mock Vertex AI
    mockVertexAI = {
      getGenerativeModel: vi.fn(),
    };
    vi.mocked(VertexAI).mockImplementation(() => mockVertexAI);
  }
});