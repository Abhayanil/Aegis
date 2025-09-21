// Unit tests for GeminiAnalyzer
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GeminiAnalyzer } from '../../../src/services/ai/GeminiAnalyzer.js';
import { ProcessedDocument } from '../../../src/models/ProcessedDocument.js';
import { AnalysisContext } from '../../../src/types/interfaces.js';
import { AnalysisType, DocumentType, ProcessingStatus, FundingStage } from '../../../src/types/enums.js';

// Mock the Google Cloud utilities
vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeVertexAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(),
    })),
  })),
}));

// Mock the config
vi.mock('../../../src/utils/config.js', () => ({
  appConfig: {
    googleCloud: {
      vertexAI: {
        model: 'gemini-1.5-pro',
        location: 'us-central1',
      },
    },
  },
}));

// Mock the logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GeminiAnalyzer', () => {
  let analyzer: GeminiAnalyzer;
  let mockModel: any;
  let mockVertexAI: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock model
    mockModel = {
      generateContent: vi.fn(),
    };
    
    mockVertexAI = {
      getGenerativeModel: vi.fn(() => mockModel),
    };

    // Mock the initializeVertexAI function
    const { initializeVertexAI } = await import('../../../src/utils/googleCloud.js');
    (initializeVertexAI as Mock).mockReturnValue(mockVertexAI);

    analyzer = new GeminiAnalyzer();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(analyzer).toBeDefined();
      expect(mockVertexAI.getGenerativeModel).toHaveBeenCalled();
    });

    it('should initialize with custom options', () => {
      const customAnalyzer = new GeminiAnalyzer({
        maxRetries: 5,
        timeout: 60000,
        enableSafetyFilters: false,
      });
      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('analyzeWithPrompt', () => {
    it('should successfully analyze with valid prompt', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: '{"name": "TestCorp", "sector": "SaaS"}',
              }],
            },
            finishReason: 'STOP',
            safetyRatings: [],
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const prompt = {
        systemPrompt: 'You are an analyst',
        userPrompt: 'Analyze this company',
        temperature: 0.1,
        maxTokens: 2000,
      };

      const result = await analyzer.analyzeWithPrompt(prompt);

      expect(result.content).toBe('{"name": "TestCorp", "sector": "SaaS"}');
      expect(result.finishReason).toBe('STOP');
      expect(mockModel.generateContent).toHaveBeenCalledWith(
        'You are an analyst\n\nAnalyze this company'
      );
    });

    it('should retry on failure', async () => {
      mockModel.generateContent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValue({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: 'Success on third attempt',
                }],
              },
              finishReason: 'STOP',
            }],
          },
        });

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };

      const result = await analyzer.analyzeWithPrompt(prompt);

      expect(result.content).toBe('Success on third attempt');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Persistent error'));

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };

      await expect(analyzer.analyzeWithPrompt(prompt, { maxRetries: 2 }))
        .rejects.toThrow('Gemini analysis failed after 2 attempts');

      expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout', async () => {
      mockModel.generateContent.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };

      await expect(analyzer.analyzeWithPrompt(prompt, { timeout: 100 }))
        .rejects.toThrow('Request timeout');
    });

    it('should handle empty response', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          candidates: [],
        },
      });

      const prompt = {
        systemPrompt: 'Test',
        userPrompt: 'Test',
      };

      await expect(analyzer.analyzeWithPrompt(prompt))
        .rejects.toThrow('No content in Gemini response');
    });
  });

  describe('analyzeContent', () => {
    const createMockDocument = (id: string, filename: string, content: string): ProcessedDocument => ({
      id,
      sourceType: DocumentType.PDF,
      extractedText: content,
      sections: [],
      metadata: {
        filename,
        fileSize: 1000,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
        processingStatus: ProcessingStatus.COMPLETED,
      },
      processingTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should analyze documents successfully', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf', 'TestCorp is a SaaS company with $1M ARR'),
        createMockDocument('doc2', 'financials.pdf', 'Current team size: 15 people'),
      ];

      // Mock successful responses for all analysis prompts
      const mockResponses = [
        // Company profile response
        {
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    name: 'TestCorp',
                    oneLiner: 'SaaS platform for businesses',
                    sector: 'SaaS',
                    stage: 'seed',
                    foundedYear: 2022,
                    location: 'San Francisco',
                  }),
                }],
              },
              finishReason: 'STOP',
            }],
          },
        },
        // Investment metrics response
        {
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    revenue: { arr: 1000000 },
                    traction: { customers: 100 },
                    team: { size: 15, foundersCount: 2 },
                    funding: { totalRaised: 500000 },
                  }),
                }],
              },
              finishReason: 'STOP',
            }],
          },
        },
        // Market claims response
        {
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    tam: 10000000000,
                    marketDescription: 'Large SaaS market',
                    competitiveLandscape: ['Competitor A', 'Competitor B'],
                  }),
                }],
              },
              finishReason: 'STOP',
            }],
          },
        },
        // Team assessment response
        {
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    founders: [
                      { name: 'John Doe', role: 'CEO' },
                      { name: 'Jane Smith', role: 'CTO' },
                    ],
                    totalSize: 15,
                    domainExpertise: ['SaaS', 'Enterprise Software'],
                  }),
                }],
              },
              finishReason: 'STOP',
            }],
          },
        },
      ];

      mockModel.generateContent
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2])
        .mockResolvedValueOnce(mockResponses[3]);

      const context: AnalysisContext = {
        analysisType: AnalysisType.COMPREHENSIVE,
        companyName: 'TestCorp',
      };

      const result = await analyzer.analyzeContent(documents, context);

      expect(result).toBeDefined();
      expect(result.companyProfile.name).toBe('TestCorp');
      expect(result.extractedMetrics.revenue.arr).toBe(1000000);
      expect(result.extractedMetrics.team.size).toBe(15);
      expect(result.marketClaims.tam).toBe(10000000000);
      expect(result.teamAssessment.totalSize).toBe(15);
      expect(result.sourceDocumentIds).toEqual(['doc1', 'doc2']);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle partial analysis failures gracefully', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf', 'TestCorp content'),
      ];

      // Mock mixed success/failure responses
      mockModel.generateContent
        .mockResolvedValueOnce({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    name: 'TestCorp',
                    oneLiner: 'Test company',
                    sector: 'SaaS',
                    stage: 'seed',
                    foundedYear: 2022,
                    location: 'SF',
                  }),
                }],
              },
              finishReason: 'STOP',
            }],
          },
        })
        .mockResolvedValueOnce({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    revenue: { arr: 1000000 },
                    traction: { customers: 100 },
                    team: { size: 10, foundersCount: 2 },
                    funding: {},
                  }),
                }],
              },
              finishReason: 'STOP',
            }],
          },
        })
        .mockRejectedValueOnce(new Error('Market analysis failed'))
        .mockRejectedValueOnce(new Error('Team analysis failed'));

      const result = await analyzer.analyzeContent(documents);

      expect(result).toBeDefined();
      expect(result.companyProfile.name).toBe('TestCorp');
      expect(result.extractedMetrics.revenue.arr).toBe(1000000);
      // Market claims and team assessment should have default values due to failures
    });

    it('should fail when required data extraction fails', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf', 'Test content'),
      ];

      // Mock all analysis failures
      mockModel.generateContent.mockRejectedValue(new Error('Analysis failed'));

      await expect(analyzer.analyzeContent(documents))
        .rejects.toThrow('Failed to extract company profile');
    });

    it('should handle invalid JSON responses', async () => {
      const documents = [
        createMockDocument('doc1', 'pitch.pdf', 'Test content'),
      ];

      mockModel.generateContent
        .mockResolvedValueOnce({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: 'Invalid JSON response',
                }],
              },
              finishReason: 'STOP',
            }],
          },
        })
        .mockResolvedValueOnce({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: 'Another invalid response',
                }],
              },
              finishReason: 'STOP',
            }],
          },
        })
        .mockResolvedValueOnce({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: '{}',
                }],
              },
              finishReason: 'STOP',
            }],
          },
        })
        .mockResolvedValueOnce({
          response: {
            candidates: [{
              content: {
                parts: [{
                  text: '{}',
                }],
              },
              finishReason: 'STOP',
            }],
          },
        });

      await expect(analyzer.analyzeContent(documents))
        .rejects.toThrow('Failed to extract company profile');
    });
  });

  describe('extractEntities', () => {
    it('should extract entities from text', async () => {
      const mockResponse = {
        response: {
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  revenue: { arr: 2000000 },
                  traction: { customers: 200 },
                  team: { size: 20, foundersCount: 2 },
                  funding: { totalRaised: 1000000 },
                }),
              }],
            },
            finishReason: 'STOP',
          }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const context: AnalysisContext = {
        analysisType: AnalysisType.METRICS_ONLY,
      };

      const result = await analyzer.extractEntities('Company has $2M ARR', context);

      expect(result).toBeDefined();
      expect(result.revenue.arr).toBe(2000000);
      expect(result.team.size).toBe(20);
    });

    it('should handle entity extraction failures', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Extraction failed'));

      const context: AnalysisContext = {
        analysisType: AnalysisType.METRICS_ONLY,
      };

      await expect(analyzer.extractEntities('Test text', context))
        .rejects.toThrow('Gemini analysis failed after 3 attempts');
    });
  });

  describe('getModelInfo', () => {
    it('should return healthy status for working model', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{
                text: 'OK',
              }],
            },
            finishReason: 'STOP',
          }],
        },
      });

      const info = await analyzer.getModelInfo();

      expect(info.model).toBe('gemini-1.5-pro');
      expect(info.status).toBe('healthy');
      expect(info.lastCheck).toBeInstanceOf(Date);
    });

    it('should return unhealthy status for failing model', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Model unavailable'));

      const info = await analyzer.getModelInfo();

      expect(info.model).toBe('gemini-1.5-pro');
      expect(info.status).toBe('unhealthy');
      expect(info.lastCheck).toBeInstanceOf(Date);
    });

    it('should return degraded status for unexpected response', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          candidates: [{
            content: {
              parts: [{
                text: 'Unexpected response',
              }],
            },
            finishReason: 'STOP',
          }],
        },
      });

      const info = await analyzer.getModelInfo();

      expect(info.status).toBe('degraded');
    });
  });

  describe('validateConsistency', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const entities = [
        { revenue: { arr: 1000000 } },
        { revenue: { arr: 1200000 } },
      ];

      const result = await analyzer.validateConsistency(entities);

      expect(result).toEqual([]);
    });
  });
});