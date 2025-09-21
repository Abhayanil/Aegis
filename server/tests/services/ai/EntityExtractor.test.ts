// Unit tests for EntityExtractor
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { EntityExtractor, ExtractedEntity } from '../../../src/services/ai/EntityExtractor.js';
import { ProcessedDocument } from '../../../src/models/ProcessedDocument.js';
import { AnalysisContext } from '../../../src/types/interfaces.js';
import { AnalysisType, DocumentType, ProcessingStatus, FundingStage } from '../../../src/types/enums.js';

// Mock the GeminiAnalyzer
vi.mock('../../../src/services/ai/GeminiAnalyzer.js', () => ({
  GeminiAnalyzer: vi.fn(() => ({
    extractEntities: vi.fn(),
  })),
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

describe('EntityExtractor', () => {
  let extractor: EntityExtractor;
  let mockGeminiAnalyzer: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock GeminiAnalyzer
    const { GeminiAnalyzer } = await import('../../../src/services/ai/GeminiAnalyzer.js');
    mockGeminiAnalyzer = {
      extractEntities: vi.fn(),
    };
    (GeminiAnalyzer as Mock).mockImplementation(() => mockGeminiAnalyzer);

    extractor = new EntityExtractor();
  });

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

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      expect(extractor).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customExtractor = new EntityExtractor({
        enablePatternMatching: false,
        confidenceThreshold: 0.8,
        validateNumericValues: false,
      });
      expect(customExtractor).toBeDefined();
    });
  });

  describe('Pattern-based Extraction', () => {
    it('should extract ARR from text', async () => {
      const document = createMockDocument(
        'doc1',
        'pitch.pdf',
        'Our company has achieved $2.5M ARR with strong growth trajectory.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.entities).toContainEqual(
        expect.objectContaining({
          type: 'financial',
          name: 'arr',
          value: 2500000,
          extractionMethod: 'pattern',
        })
      );
    });

    it('should extract MRR with multipliers', async () => {
      const document = createMockDocument(
        'doc1',
        'metrics.pdf',
        'Monthly Recurring Revenue: $250K and growing at 15% month over month.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      const mrrEntity = result.entities.find(e => e.name === 'mrr');
      expect(mrrEntity).toBeDefined();
      expect(mrrEntity?.value).toBe(250000);
    });

    it('should extract customer metrics', async () => {
      const document = createMockDocument(
        'doc1',
        'traction.pdf',
        'We serve 1,500 customers with a churn rate of 3.2% and NPS score of 65.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.entities).toContainEqual(
        expect.objectContaining({
          name: 'customers',
          value: 1500,
        })
      );
      expect(result.entities).toContainEqual(
        expect.objectContaining({
          name: 'churnRate',
          value: 3.2,
        })
      );
      expect(result.entities).toContainEqual(
        expect.objectContaining({
          name: 'nps',
          value: 65,
        })
      );
    });

    it('should extract team information', async () => {
      const document = createMockDocument(
        'doc1',
        'team.pdf',
        'Our team consists of 25 employees led by 3 founders with deep domain expertise.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 25, foundersCount: 3 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      // Check that team size is extracted (either by pattern as 'teamSize' or by AI as 'size')
      const teamSizeEntity = result.entities.find(e => 
        (e.name === 'teamSize' || e.name === 'size') && e.value === 25
      );
      expect(teamSizeEntity).toBeDefined();
      expect(teamSizeEntity?.value).toBe(25);
      expect(result.entities).toContainEqual(
        expect.objectContaining({
          type: 'team',
          name: 'foundersCount',
          value: 3,
        })
      );
    });

    it('should extract funding information', async () => {
      const document = createMockDocument(
        'doc1',
        'funding.pdf',
        'We have raised $5M to date and are valued at $50M post-money.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.entities).toContainEqual(
        expect.objectContaining({
          name: 'totalRaised',
          value: 5000000,
        })
      );
      expect(result.entities).toContainEqual(
        expect.objectContaining({
          name: 'valuation',
          value: 50000000,
        })
      );
    });

    it('should extract market size claims', async () => {
      const document = createMockDocument(
        'doc1',
        'market.pdf',
        'The TAM is $100B with our SAM being approximately $10B.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.entities).toContainEqual(
        expect.objectContaining({
          type: 'market',
          name: 'tam',
          value: 100000000000,
        })
      );
      expect(result.entities).toContainEqual(
        expect.objectContaining({
          type: 'market',
          name: 'sam',
          value: 10000000000,
        })
      );
    });

    it('should extract founding year', async () => {
      const document = createMockDocument(
        'doc1',
        'company.pdf',
        'Founded in 2020, we have been growing rapidly in the SaaS space.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.entities).toContainEqual(
        expect.objectContaining({
          type: 'company',
          name: 'foundedYear',
          value: 2020,
        })
      );
    });
  });

  describe('AI-based Extraction', () => {
    it('should extract entities using AI when patterns fail', async () => {
      const document = createMockDocument(
        'doc1',
        'complex.pdf',
        'Our business model generates significant recurring revenue through our subscription platform.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {
          arr: 3000000,
          mrr: 250000,
          growthRate: 25,
        },
        traction: {
          customers: 2000,
          churnRate: 2.5,
        },
        team: {
          size: 30,
          foundersCount: 2,
        },
        funding: {
          totalRaised: 8000000,
        },
      });

      const result = await extractor.extractFromDocuments([document]);

      // Should contain AI-extracted entities
      expect(result.entities.some(e => e.extractionMethod === 'ai')).toBe(true);
      expect(result.entities).toContainEqual(
        expect.objectContaining({
          name: 'arr',
          value: 3000000,
          extractionMethod: 'ai',
        })
      );
    });

    it('should handle AI extraction failures gracefully', async () => {
      const document = createMockDocument(
        'doc1',
        'simple.pdf',
        'ARR: $1M'
      );

      mockGeminiAnalyzer.extractEntities.mockRejectedValue(new Error('AI service unavailable'));

      const result = await extractor.extractFromDocuments([document]);

      // Should still have pattern-based results
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.entities.every(e => e.extractionMethod === 'pattern')).toBe(true);
    });
  });

  describe('Entity Merging and Validation', () => {
    it('should merge duplicate entities from different sources', async () => {
      const document = createMockDocument(
        'doc1',
        'mixed.pdf',
        'ARR is $2M according to our latest metrics. Our Annual Recurring Revenue reached $2.1M last quarter.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: { arr: 2000000 },
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      // Should have merged ARR entities
      const arrEntities = result.entities.filter(e => e.name === 'arr');
      expect(arrEntities.length).toBe(1);
    });

    it('should filter entities below confidence threshold', async () => {
      const customExtractor = new EntityExtractor({
        confidenceThreshold: 0.9,
      });

      const document = createMockDocument(
        'doc1',
        'test.pdf',
        'ARR: $1M'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await customExtractor.extractFromDocuments([document]);

      // Pattern-based entities have 0.8 confidence, should be filtered out
      const arrEntities = result.entities.filter(e => e.name === 'arr');
      expect(arrEntities.length).toBe(0);
    });

    it('should validate numeric values', async () => {
      const document = createMockDocument(
        'doc1',
        'invalid.pdf',
        'Churn rate: 150% NPS: -200'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      // Invalid values should be filtered out
      const churnEntity = result.entities.find(e => e.name === 'churnRate');
      const npsEntity = result.entities.find(e => e.name === 'nps');
      
      expect(churnEntity).toBeUndefined(); // 150% churn is invalid
      expect(npsEntity).toBeUndefined(); // -200 NPS is invalid
    });
  });

  describe('Structured Data Conversion', () => {
    it('should convert entities to investment metrics', async () => {
      const document = createMockDocument(
        'doc1',
        'metrics.pdf',
        'ARR: $5M, MRR: $400K, 2000 customers, team of 50, raised $10M'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 50, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.metrics.revenue.arr).toBe(5000000);
      expect(result.metrics.revenue.mrr).toBe(400000);
      expect(result.metrics.traction.customers).toBe(2000);
      expect(result.metrics.team.size).toBe(50);
      expect(result.metrics.funding.totalRaised).toBe(10000000);
    });

    it('should convert entities to company profile', async () => {
      const document = createMockDocument(
        'doc1',
        'company.pdf',
        'Founded in 2019, we are a leading SaaS company.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.companyProfile.foundedYear).toBe(2019);
      expect(result.companyProfile.stage).toBe(FundingStage.PRE_SEED);
    });

    it('should convert entities to market claims', async () => {
      const document = createMockDocument(
        'doc1',
        'market.pdf',
        'TAM: $50B, SAM: $5B'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.marketClaims.tam).toBe(50000000000);
      expect(result.marketClaims.sam).toBe(5000000000);
    });

    it('should convert entities to team profile', async () => {
      const document = createMockDocument(
        'doc1',
        'team.pdf',
        'Team size: 35 people'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 35, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);

      expect(result.teamProfile.totalSize).toBe(35);
    });
  });

  describe('Utility Functions', () => {
    it('should calculate extraction statistics', async () => {
      const document = createMockDocument(
        'doc1',
        'mixed.pdf',
        'ARR: $2M, team: 20 people, TAM: $10B'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: { arr: 2000000 },
        traction: {},
        team: { size: 20, foundersCount: 2 },
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);
      const stats = extractor.getExtractionStats(result);

      expect(stats.totalEntities).toBeGreaterThan(0);
      expect(stats.byType).toHaveProperty('financial');
      expect(stats.byType).toHaveProperty('team');
      expect(stats.byType).toHaveProperty('market');
      expect(stats.byMethod).toHaveProperty('pattern');
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it('should handle empty extraction results', async () => {
      const document = createMockDocument(
        'doc1',
        'empty.pdf',
        'This document contains no relevant metrics.'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: {},
        funding: {},
      });

      const result = await extractor.extractFromDocuments([document]);
      const stats = extractor.getExtractionStats(result);

      expect(stats.totalEntities).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });

  describe('Configuration Options', () => {
    it('should disable pattern matching when configured', async () => {
      const customExtractor = new EntityExtractor({
        enablePatternMatching: false,
        enableAIExtraction: true,
      });

      const document = createMockDocument(
        'doc1',
        'test.pdf',
        'ARR: $1M'
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: { arr: 1000000 },
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await customExtractor.extractFromDocuments([document]);

      // Should only have AI-extracted entities
      expect(result.entities.every(e => e.extractionMethod === 'ai')).toBe(true);
    });

    it('should disable AI extraction when configured', async () => {
      const customExtractor = new EntityExtractor({
        enablePatternMatching: true,
        enableAIExtraction: false,
      });

      const document = createMockDocument(
        'doc1',
        'test.pdf',
        'ARR: $1M'
      );

      const result = await customExtractor.extractFromDocuments([document]);

      // Should only have pattern-based entities
      expect(result.entities.every(e => e.extractionMethod === 'pattern')).toBe(true);
      expect(mockGeminiAnalyzer.extractEntities).not.toHaveBeenCalled();
    });

    it('should disable numeric validation when configured', async () => {
      const customExtractor = new EntityExtractor({
        validateNumericValues: false,
      });

      const document = createMockDocument(
        'doc1',
        'test.pdf',
        'Churn rate: 150%' // Invalid but should be kept
      );

      mockGeminiAnalyzer.extractEntities.mockResolvedValue({
        revenue: {},
        traction: {},
        team: { size: 10, foundersCount: 2 },
        funding: {},
      });

      const result = await customExtractor.extractFromDocuments([document]);

      const churnEntity = result.entities.find(e => e.name === 'churnRate');
      expect(churnEntity).toBeDefined();
      expect(churnEntity?.value).toBe(150);
    });
  });
});