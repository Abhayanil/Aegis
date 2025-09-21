// Integration tests for Firebase storage service
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseStorage, StoredDealMemo, DealMemoQuery } from '../../../src/services/storage/FirebaseStorage.js';
import { DealMemoInput } from '../../../src/models/DealMemo.js';
import { RecommendationType, FundingStage } from '../../../src/types/enums.js';

// Mock Firebase
vi.mock('../../../src/utils/googleCloud.js', () => ({
  initializeFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      })),
      add: vi.fn(),
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => ({
                  get: vi.fn(),
                })),
                get: vi.fn(),
              })),
              get: vi.fn(),
            })),
            limit: vi.fn(() => ({
              get: vi.fn(),
            })),
            get: vi.fn(),
          })),
          orderBy: vi.fn(() => ({
            get: vi.fn(),
          })),
          limit: vi.fn(() => ({
            get: vi.fn(),
          })),
          get: vi.fn(),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(),
          })),
          get: vi.fn(),
        })),
        limit: vi.fn(() => ({
          get: vi.fn(),
        })),
        get: vi.fn(),
      })),
    })),
    listCollections: vi.fn(),
    batch: vi.fn(() => ({
      delete: vi.fn(),
      commit: vi.fn(),
    })),
  })),
}));

vi.mock('@google-cloud/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe('FirebaseStorage', () => {
  let firebaseStorage: FirebaseStorage;
  let mockDealMemoInput: DealMemoInput;

  beforeEach(() => {
    vi.clearAllMocks();
    firebaseStorage = new FirebaseStorage();
    
    mockDealMemoInput = {
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
        keyDrivers: ['Market expansion', 'Product innovation'],
        scalabilityFactors: ['Technology platform', 'Team expertise'],
        marketExpansionOpportunity: 'Global expansion possible',
        revenueProjection: {
          year1: 1000000,
          year3: 5000000,
          year5: 20000000,
        },
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
        suggestedTerms: ['Board seat', 'Pro rata rights'],
        keyDiligenceQuestions: ['Team scalability', 'Market competition'],
        followUpActions: ['Reference calls', 'Technical review'],
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
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeDealMemo', () => {
    it('should store a new deal memo successfully', async () => {
      const mockDoc = {
        set: vi.fn().mockResolvedValue(undefined),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn().mockResolvedValue({ id: 'version-id' }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      // Mock the Firestore instance
      vi.mocked(firebaseStorage as any).db = mockDb;

      const result = await firebaseStorage.storeDealMemo(
        mockDealMemoInput,
        'user-123',
        ['tag1', 'tag2']
      );

      expect(result).toMatchObject({
        dealMemo: mockDealMemoInput,
        version: 1,
        userId: 'user-123',
        companyName: 'TestCorp',
        sector: 'SaaS',
        tags: ['tag1', 'tag2'],
        isArchived: false,
      });

      expect(mockDoc.set).toHaveBeenCalled();
      expect(mockCollection.add).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const mockDoc = {
        set: vi.fn().mockRejectedValue(new Error('Firestore error')),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      await expect(
        firebaseStorage.storeDealMemo(mockDealMemoInput, 'user-123')
      ).rejects.toThrow('Failed to store deal memo: Firestore error');
    });
  });

  describe('updateDealMemo', () => {
    it('should update an existing deal memo and create new version', async () => {
      const existingData = {
        id: 'deal-123',
        version: 1,
        dealMemo: mockDealMemoInput,
        userId: 'user-123',
        companyName: 'TestCorp',
        sector: 'SaaS',
        tags: [],
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => existingData,
        }),
        set: vi.fn().mockResolvedValue(undefined),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
        add: vi.fn().mockResolvedValue({ id: 'version-id' }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;
      vi.mocked(firebaseStorage as any).deserializeFromFirestore = vi.fn().mockReturnValue(existingData);

      const updatedInput = { ...mockDealMemoInput };
      updatedInput.summary.signalScore = 90;

      const result = await firebaseStorage.updateDealMemo(
        'deal-123',
        updatedInput,
        'user-123',
        'Updated signal score'
      );

      expect(result.version).toBe(2);
      expect(result.dealMemo.summary.signalScore).toBe(90);
      expect(mockDoc.set).toHaveBeenCalled();
      expect(mockCollection.add).toHaveBeenCalled();
    });

    it('should throw error if deal memo not found', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: false,
        }),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      await expect(
        firebaseStorage.updateDealMemo('nonexistent-id', mockDealMemoInput)
      ).rejects.toThrow('Deal memo not found: nonexistent-id');
    });
  });

  describe('getDealMemo', () => {
    it('should retrieve a deal memo by ID', async () => {
      const mockData = {
        id: 'deal-123',
        dealMemo: mockDealMemoInput,
        version: 1,
        userId: 'user-123',
        companyName: 'TestCorp',
        sector: 'SaaS',
        tags: [],
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockData,
        }),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;
      vi.mocked(firebaseStorage as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockData);

      const result = await firebaseStorage.getDealMemo('deal-123');

      expect(result).toEqual(mockData);
      expect(mockDoc.get).toHaveBeenCalled();
    });

    it('should return null if deal memo not found', async () => {
      const mockDoc = {
        get: vi.fn().mockResolvedValue({
          exists: false,
        }),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      const result = await firebaseStorage.getDealMemo('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('queryDealMemos', () => {
    it('should query deal memos with filters', async () => {
      const mockData = [
        {
          id: 'deal-1',
          dealMemo: mockDealMemoInput,
          version: 1,
          userId: 'user-123',
          companyName: 'TestCorp',
          sector: 'SaaS',
          tags: ['tag1'],
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockSnapshot = {
        docs: [
          {
            data: () => mockData[0],
          },
        ],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;
      vi.mocked(firebaseStorage as any).deserializeFromFirestore = vi.fn().mockReturnValue(mockData[0]);

      const query: DealMemoQuery = {
        userId: 'user-123',
        sector: 'SaaS',
        limit: 10,
      };

      const result = await firebaseStorage.queryDealMemos(query);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockData[0]);
      expect(mockQuery.where).toHaveBeenCalledWith('userId', '==', 'user-123');
      expect(mockQuery.where).toHaveBeenCalledWith('sector', '==', 'SaaS');
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should handle empty query results', async () => {
      const mockSnapshot = {
        docs: [],
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      const result = await firebaseStorage.queryDealMemos({});

      expect(result).toHaveLength(0);
    });
  });

  describe('getDealMemoVersions', () => {
    it('should retrieve all versions of a deal memo', async () => {
      const mockVersions = [
        {
          id: 'version-2',
          version: 2,
          dealMemo: mockDealMemoInput,
          createdAt: new Date(),
          createdBy: 'user-123',
          changeDescription: 'Updated metrics',
        },
        {
          id: 'version-1',
          version: 1,
          dealMemo: mockDealMemoInput,
          createdAt: new Date(),
          createdBy: 'user-123',
          changeDescription: 'Initial version',
        },
      ];

      const mockSnapshot = {
        docs: mockVersions.map((version, index) => ({
          id: version.id,
          data: () => version,
        })),
      };

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockSnapshot),
      };

      const mockCollection = mockQuery;
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;
      vi.mocked(firebaseStorage as any).deserializeFromFirestore = vi.fn()
        .mockReturnValueOnce(mockVersions[0])
        .mockReturnValueOnce(mockVersions[1]);

      const result = await firebaseStorage.getDealMemoVersions('deal-123');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(1);
      expect(mockQuery.where).toHaveBeenCalledWith('dealMemoId', '==', 'deal-123');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('version', 'desc');
    });
  });

  describe('archiveDealMemo', () => {
    it('should archive a deal memo', async () => {
      const mockDoc = {
        update: vi.fn().mockResolvedValue(undefined),
      };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue(mockCollection),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      await firebaseStorage.archiveDealMemo('deal-123');

      expect(mockDoc.update).toHaveBeenCalledWith({
        isArchived: true,
        updatedAt: expect.any(Object),
      });
    });
  });

  describe('deleteDealMemo', () => {
    it('should delete deal memo and all versions', async () => {
      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      const mockVersionsSnapshot = {
        docs: [
          { ref: 'version-ref-1' },
          { ref: 'version-ref-2' },
        ],
      };

      const mockVersionsQuery = {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue(mockVersionsSnapshot),
      };

      const mockDoc = { ref: 'deal-ref' };
      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDoc),
      };

      const mockDb = {
        collection: vi.fn()
          .mockReturnValueOnce(mockCollection) // dealMemosCollection
          .mockReturnValueOnce(mockVersionsQuery), // versionsCollection
        batch: vi.fn().mockReturnValue(mockBatch),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      await firebaseStorage.deleteDealMemo('deal-123');

      expect(mockBatch.delete).toHaveBeenCalledTimes(3); // 1 main + 2 versions
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when Firebase is healthy', async () => {
      const mockDb = {
        listCollections: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      const result = await firebaseStorage.healthCheck();

      expect(result).toBe(true);
      expect(mockDb.listCollections).toHaveBeenCalled();
    });

    it('should return false when Firebase is unhealthy', async () => {
      const mockDb = {
        listCollections: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };

      vi.mocked(firebaseStorage as any).db = mockDb;

      const result = await firebaseStorage.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize data correctly', () => {
      const testData = {
        id: 'test-id',
        createdAt: new Date('2023-01-01'),
        nested: {
          updatedAt: new Date('2023-01-02'),
          array: [new Date('2023-01-03')],
        },
        primitive: 'string',
        number: 42,
      };

      // Test serialization
      const serialized = (firebaseStorage as any).serializeForFirestore(testData);
      expect(serialized.createdAt).toEqual({ toDate: expect.any(Function) });
      expect(serialized.nested.updatedAt).toEqual({ toDate: expect.any(Function) });
      expect(serialized.nested.array[0]).toEqual({ toDate: expect.any(Function) });
      expect(serialized.primitive).toBe('string');
      expect(serialized.number).toBe(42);

      // Test deserialization
      const deserialized = (firebaseStorage as any).deserializeFromFirestore(serialized);
      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.nested.updatedAt).toBeInstanceOf(Date);
      expect(deserialized.nested.array[0]).toBeInstanceOf(Date);
      expect(deserialized.primitive).toBe('string');
      expect(deserialized.number).toBe(42);
    });
  });
});