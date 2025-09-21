// Tests for Historical Analysis Service
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoricalAnalysisService, HistoricalQuery } from '../../../src/services/storage/HistoricalAnalysisService.js';
import { StoredDealMemo } from '../../../src/services/storage/FirebaseStorage.js';
import { RecommendationType, FundingStage } from '../../../src/types/enums.js';

// Mock Firebase
vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ 
        empty: true, 
        docs: [],
        size: 0,
      }),
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false }),
      })),
    })),
  })),
}));

vi.mock('@google-cloud/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe('HistoricalAnalysisService', () => {
  let analysisService: HistoricalAnalysisService;
  let mockDealMemo: StoredDealMemo;

  beforeEach(() => {
    vi.clearAllMocks();
    analysisService = new HistoricalAnalysisService();
    
    mockDealMemo = {
      id: 'deal-123',
      dealMemo: {
        summary: {
          companyName: 'TestCorp',
          oneLiner: 'AI-powered test platform',
          sector: 'SaaS',
          stage: FundingStage.SERIES_A,
          signalScore: 85,
          recommendation: RecommendationType.STRONG_YES,
          confidenceLevel: 0.9,
          lastUpdated: new Date(),
        },
        keyBenchmarks: [],
        growthPotential: {
          upsideSummary: 'Strong growth potential',
          growthTimeline: '3-5 years to scale',
          keyDrivers: ['Market expansion'],
          scalabilityFactors: ['Technology platform'],
          marketExpansionOpportunity: 'Global expansion possible',
          revenueProjection: { year1: 1000000, year3: 5000000, year5: 20000000 },
        },
        riskAssessment: {
          overallRiskScore: 3,
          highPriorityRisks: [],
          mediumPriorityRisks: [],
          lowPriorityRisks: [],
          riskMitigationPlan: [],
        },
        investmentRecommendation: {
          narrative: 'Strong investment opportunity',
          investmentThesis: 'Market leader potential',
          idealCheckSize: '$2M',
          idealValuationCap: '$20M',
          suggestedTerms: ['Board seat'],
          keyDiligenceQuestions: ['Team scalability'],
          followUpActions: ['Reference calls'],
          timelineToDecision: '2-3 weeks',
        },
        analysisWeightings: {
          marketOpportunity: 25,
          team: 25,
          traction: 20,
          product: 15,
          competitivePosition: 15,
        },
        metadata: {
          generatedBy: 'test-user',
          analysisVersion: '1.0',
          sourceDocuments: ['pitch-deck.pdf'],
          processingTime: 5000,
          dataQuality: 0.95,
        },
      },
      version: 1,
      userId: 'user-123',
      companyName: 'TestCorp',
      sector: 'SaaS',
      tags: ['ai', 'saas'],
      isArchived: false,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(analysisService).toBeDefined();
      expect(analysisService).toBeInstanceOf(HistoricalAnalysisService);
    });

    it('should have proper collection references', () => {
      expect((analysisService as any).dealMemosCollection).toBeDefined();
      expect((analysisService as any).versionsCollection).toBeDefined();
    });
  });

  describe('queryHistoricalData', () => {
    it('should return empty array when no data matches', async () => {
      const query: HistoricalQuery = {
        sector: 'SaaS',
        limit: 10,
      };

      const result = await analysisService.queryHistoricalData(query);
      expect(result).toEqual([]);
    });

    it('should apply filters correctly', async () => {
      const mockSnapshot = {
        docs: [
          {
            data: () => mockDealMemo,
          },
        ],
      };

      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      vi.mocked(analysisService as any).dealMemosCollection = mockCollection;
      vi.mocked(analysisService as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockDealMemo);

      const query: HistoricalQuery = {
        sector: 'SaaS',
        companyName: 'TestCorp',
        signalScoreRange: { min: 80, max: 90 },
        limit: 10,
      };

      const result = await analysisService.queryHistoricalData(query);

      expect(mockCollection.where).toHaveBeenCalledWith('isArchived', '==', false);
      expect(mockCollection.where).toHaveBeenCalledWith('sector', '==', 'SaaS');
      expect(mockCollection.where).toHaveBeenCalledWith('companyName', '==', 'TestCorp');
      expect(mockCollection.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    it('should filter by signal score range', async () => {
      const mockSnapshot = {
        docs: [
          { data: () => ({ ...mockDealMemo, dealMemo: { ...mockDealMemo.dealMemo, summary: { ...mockDealMemo.dealMemo.summary, signalScore: 75 } } }) },
          { data: () => ({ ...mockDealMemo, dealMemo: { ...mockDealMemo.dealMemo.summary, signalScore: 85 } }) },
          { data: () => ({ ...mockDealMemo, dealMemo: { ...mockDealMemo.dealMemo.summary, signalScore: 95 } }) },
        ],
      };

      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      vi.mocked(analysisService as any).dealMemosCollection = mockCollection;
      vi.mocked(analysisService as any).deserializeFromFirestore = vi.fn().mockImplementation(data => data);

      const query: HistoricalQuery = {
        signalScoreRange: { min: 80, max: 90 },
      };

      const result = await analysisService.queryHistoricalData(query);

      // Should filter out the 75 and 95 scores, keeping only 85
      expect(result).toHaveLength(1);
    });
  });

  describe('compareDealMemos', () => {
    it('should return null when deal memos not found', async () => {
      const result = await analysisService.compareDealMemos('id1', 'id2');
      expect(result).toBeNull();
    });

    it('should compare two deal memos successfully', async () => {
      const dealMemo2 = {
        ...mockDealMemo,
        id: 'deal-456',
        dealMemo: {
          ...mockDealMemo.dealMemo,
          summary: {
            ...mockDealMemo.dealMemo.summary,
            signalScore: 75,
            recommendation: RecommendationType.MAYBE,
          },
        },
        sector: 'FinTech',
      };

      const mockDoc1 = {
        exists: true,
        data: () => mockDealMemo,
      };

      const mockDoc2 = {
        exists: true,
        data: () => dealMemo2,
      };

      const mockCollection = {
        doc: vi.fn()
          .mockReturnValueOnce({ get: vi.fn().mockResolvedValue(mockDoc1) })
          .mockReturnValueOnce({ get: vi.fn().mockResolvedValue(mockDoc2) }),
      };

      vi.mocked(analysisService as any).dealMemosCollection = mockCollection;
      vi.mocked(analysisService as any).deserializeFromFirestore = vi.fn()
        .mockReturnValueOnce(mockDealMemo)
        .mockReturnValueOnce(dealMemo2);
      vi.mocked(analysisService as any).compareKeyMetrics = vi.fn().mockReturnValue(['Signal score difference: 10.0 points']);
      vi.mocked(analysisService as any).calculateSimilarity = vi.fn().mockReturnValue(0.7);

      const result = await analysisService.compareDealMemos('deal-123', 'deal-456');

      expect(result).toBeDefined();
      expect(result!.dealMemo1.id).toBe('deal-123');
      expect(result!.dealMemo2.id).toBe('deal-456');
      expect(result!.differences.signalScore).toBe(10);
      expect(result!.differences.recommendation).toBe(true);
      expect(result!.differences.sector).toBe(true);
      expect(result!.similarity).toBe(0.7);
    });
  });

  describe('analyzeSectorTrends', () => {
    it('should throw error when no deal memos found', async () => {
      vi.mocked(analysisService as any).queryHistoricalData = vi.fn().mockResolvedValue([]);

      await expect(
        analysisService.analyzeSectorTrends('SaaS', { from: new Date('2023-01-01'), to: new Date('2023-12-31') })
      ).rejects.toThrow('No deal memos found for sector: SaaS');
    });

    it('should analyze sector trends successfully', async () => {
      const mockDealMemos = [
        { ...mockDealMemo, dealMemo: { ...mockDealMemo.dealMemo, summary: { ...mockDealMemo.dealMemo.summary, signalScore: 80, recommendation: RecommendationType.STRONG_YES } } },
        { ...mockDealMemo, dealMemo: { ...mockDealMemo.dealMemo, summary: { ...mockDealMemo.dealMemo.summary, signalScore: 90, recommendation: RecommendationType.STRONG_YES } } },
        { ...mockDealMemo, dealMemo: { ...mockDealMemo.dealMemo, summary: { ...mockDealMemo.dealMemo.summary, signalScore: 70, recommendation: RecommendationType.MAYBE } } },
      ];

      vi.mocked(analysisService as any).queryHistoricalData = vi.fn().mockResolvedValue(mockDealMemos);
      vi.mocked(analysisService as any).calculateScoreProgression = vi.fn().mockReturnValue([
        { date: new Date('2023-01-01'), averageScore: 80, dealCount: 3 },
      ]);

      const result = await analysisService.analyzeSectorTrends(
        'SaaS',
        { from: new Date('2023-01-01'), to: new Date('2023-12-31') }
      );

      expect(result.sector).toBe('SaaS');
      expect(result.dealCount).toBe(3);
      expect(result.averageSignalScore).toBe(80); // (80 + 90 + 70) / 3
      expect(result.recommendationDistribution[RecommendationType.STRONG_YES]).toBe(2);
      expect(result.recommendationDistribution[RecommendationType.MAYBE]).toBe(1);
      expect(result.scoreProgression).toHaveLength(1);
    });
  });

  describe('compareVersions', () => {
    it('should return null when versions not found', async () => {
      const mockSnapshot = {
        size: 0,
        docs: [],
      };

      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      vi.mocked(analysisService as any).versionsCollection = mockCollection;

      const result = await analysisService.compareVersions('deal-123', 1, 2);
      expect(result).toBeNull();
    });

    it('should compare versions successfully', async () => {
      const version1 = {
        id: 'v1',
        version: 1,
        dealMemo: { ...mockDealMemo.dealMemo, summary: { ...mockDealMemo.dealMemo.summary, signalScore: 80 } },
        createdAt: new Date('2023-01-01'),
      };

      const version2 = {
        id: 'v2',
        version: 2,
        dealMemo: { ...mockDealMemo.dealMemo, summary: { ...mockDealMemo.dealMemo.summary, signalScore: 85, recommendation: RecommendationType.MAYBE } },
        createdAt: new Date('2023-01-02'),
      };

      const mockSnapshot = {
        size: 2,
        docs: [
          { data: () => version1 },
          { data: () => version2 },
        ],
      };

      const mockCollection = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      vi.mocked(analysisService as any).versionsCollection = mockCollection;
      vi.mocked(analysisService as any).deserializeFromFirestore = vi.fn()
        .mockReturnValueOnce(version1)
        .mockReturnValueOnce(version2);
      vi.mocked(analysisService as any).compareVersionMetrics = vi.fn().mockReturnValue(['Signal score changed by +5.0 points']);
      vi.mocked(analysisService as any).compareVersionRisks = vi.fn().mockReturnValue([]);

      const result = await analysisService.compareVersions('deal-123', 1, 2);

      expect(result).toBeDefined();
      expect(result!.dealMemoId).toBe('deal-123');
      expect(result!.version1.version).toBe(1);
      expect(result!.version2.version).toBe(2);
      expect(result!.changes.signalScore).toEqual({
        old: 80,
        new: 85,
        change: 5,
      });
      expect(result!.changes.recommendation).toEqual({
        old: RecommendationType.STRONG_YES,
        new: RecommendationType.MAYBE,
      });
    });
  });

  describe('findSimilarDealMemos', () => {
    it('should find similar deal memos', async () => {
      const similarMemo = {
        ...mockDealMemo,
        id: 'deal-456',
        dealMemo: {
          ...mockDealMemo.dealMemo,
          summary: {
            ...mockDealMemo.dealMemo.summary,
            signalScore: 82,
          },
        },
      };

      vi.mocked(analysisService as any).queryHistoricalData = vi.fn().mockResolvedValue([similarMemo]);
      vi.mocked(analysisService as any).calculateSimilarity = vi.fn().mockReturnValue(0.85);

      const result = await analysisService.findSimilarDealMemos(mockDealMemo, 5);

      expect(result).toHaveLength(1);
      expect(result[0].dealMemo.id).toBe('deal-456');
      expect(result[0].similarity).toBe(0.85);
    });

    it('should exclude the reference deal memo itself', async () => {
      vi.mocked(analysisService as any).queryHistoricalData = vi.fn().mockResolvedValue([mockDealMemo]);

      const result = await analysisService.findSimilarDealMemos(mockDealMemo, 5);

      expect(result).toHaveLength(0);
    });
  });

  describe('utility methods', () => {
    it('should calculate similarity correctly', () => {
      const memo1 = mockDealMemo;
      const memo2 = {
        ...mockDealMemo,
        id: 'deal-456',
        sector: 'SaaS', // Same sector
        dealMemo: {
          ...mockDealMemo.dealMemo,
          summary: {
            ...mockDealMemo.dealMemo.summary,
            signalScore: 85, // Same score
            recommendation: RecommendationType.STRONG_YES, // Same recommendation
            stage: FundingStage.SERIES_A, // Same stage
          },
        },
        tags: ['ai', 'saas'], // Same tags
      };

      const similarity = (analysisService as any).calculateSimilarity(memo1, memo2);

      expect(similarity).toBeGreaterThan(0.8); // High similarity expected
    });

    it('should calculate tag overlap correctly', () => {
      const tags1 = ['ai', 'saas', 'b2b'];
      const tags2 = ['ai', 'saas', 'enterprise'];

      const overlap = (analysisService as any).calculateTagOverlap(tags1, tags2);

      // Intersection: ['ai', 'saas'] = 2
      // Union: ['ai', 'saas', 'b2b', 'enterprise'] = 4
      // Overlap: 2/4 = 0.5
      expect(overlap).toBe(0.5);
    });

    it('should handle empty tag arrays', () => {
      const overlap1 = (analysisService as any).calculateTagOverlap([], []);
      const overlap2 = (analysisService as any).calculateTagOverlap(['ai'], []);
      const overlap3 = (analysisService as any).calculateTagOverlap([], ['ai']);

      expect(overlap1).toBe(1);
      expect(overlap2).toBe(0);
      expect(overlap3).toBe(0);
    });

    it('should deserialize data correctly', () => {
      const mockTimestamp = {
        toDate: () => new Date('2023-01-01'),
      };

      const testData = {
        createdAt: mockTimestamp,
        name: 'test',
        nested: {
          updatedAt: mockTimestamp,
        },
      };

      const deserialized = (analysisService as any).deserializeFromFirestore(testData);

      expect(deserialized.name).toBe('test');
      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.nested.updatedAt).toBeInstanceOf(Date);
    });
  });
});