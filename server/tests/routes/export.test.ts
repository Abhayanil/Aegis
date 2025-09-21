import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import exportRoutes from '../../src/routes/export.js';
import { FirebaseStorage } from '../../src/services/storage/FirebaseStorage.js';
import { DealMemo } from '../../src/models/DealMemo.js';
import { FundingStage, RecommendationType } from '../../src/types/enums.js';
import * as validation from '../../src/utils/validation.js';

// Mock the Firebase storage service
vi.mock('../../src/services/storage/FirebaseStorage.js');
vi.mock('../../src/utils/validation.js');

const app = express();
app.use(express.json());
app.use('/api/export', exportRoutes);

describe('Export Routes', () => {
  let mockFirebaseStorage: any;

  const mockDealMemo: DealMemo = {
    id: 'deal-memo-123',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    aegisDealMemo: {
      summary: {
        companyName: 'TechCorp',
        oneLiner: 'Enterprise automation SaaS platform',
        sector: 'Enterprise Software',
        stage: FundingStage.SEED,
        signalScore: 78,
        recommendation: RecommendationType.BUY,
        confidenceLevel: 0.85,
        lastUpdated: new Date('2024-01-15T10:00:00Z'),
      },
      keyBenchmarks: [
        {
          metric: 'ARR Growth Rate',
          companyValue: 15,
          sectorMedian: 12,
          percentile: 65,
          interpretation: 'Above median growth',
          context: 'Strong for seed stage',
        },
      ],
      growthPotential: {
        upsideSummary: 'Strong growth potential in large market',
        growthTimeline: '3-5 years to reach $10M ARR',
        keyDrivers: ['Market expansion', 'Product development'],
        scalabilityFactors: ['API-first architecture'],
        marketExpansionOpportunity: 'International expansion',
        revenueProjection: {
          year1: 1200000,
          year3: 8000000,
          year5: 25000000,
        },
      },
      riskAssessment: {
        overallRiskScore: 25,
        highPriorityRisks: [],
        mediumPriorityRisks: [],
        lowPriorityRisks: [],
        riskMitigationPlan: ['Hire experienced sales leader'],
      },
      investmentRecommendation: {
        narrative: 'Strong team with proven product-market fit',
        investmentThesis: 'Large market opportunity with differentiated product',
        idealCheckSize: '$500K - $1M',
        idealValuationCap: '$8M',
        suggestedTerms: ['Pro rata rights'],
        keyDiligenceQuestions: ['Customer retention metrics'],
        followUpActions: ['Reference calls with customers'],
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
        generatedBy: 'Aegis AI v1.0.0',
        analysisVersion: '1.0.0',
        sourceDocuments: ['doc-1', 'doc-2'],
        processingTime: 5000,
        dataQuality: 0.9,
      },
    },
  };

  beforeEach(() => {
    mockFirebaseStorage = {
      getDealMemo: vi.fn(),
      queryDealMemos: vi.fn(),
      deleteDealMemo: vi.fn(),
    };

    (FirebaseStorage as any).mockImplementation(() => mockFirebaseStorage);
    
    // Mock validation function
    (validation.validateDealMemoSchema as any).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      summary: 'Validation passed',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/export', () => {
    it('should export deal memo as JSON file', async () => {
      mockFirebaseStorage.getDealMemo.mockResolvedValue(mockDealMemo);

      const response = await request(app)
        .post('/api/export')
        .send({ dealMemoId: 'deal-memo-123' })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('techcorp_deal_memo_');
      expect(response.headers['x-schema-valid']).toBe('true');
      
      expect(response.body.id).toBe('deal-memo-123');
      expect(response.body.aegisDealMemo.summary.companyName).toBe('TechCorp');
    });

    it('should handle schema validation warnings', async () => {
      mockFirebaseStorage.getDealMemo.mockResolvedValue(mockDealMemo);
      (validation.validateDealMemoSchema as any).mockReturnValue({
        isValid: false,
        errors: [],
        warnings: ['Missing optional field'],
        summary: 'Validation passed with warnings',
      });

      const response = await request(app)
        .post('/api/export')
        .send({ dealMemoId: 'deal-memo-123' })
        .expect(200);

      expect(response.headers['x-schema-valid']).toBe('false');
      expect(response.headers['x-schema-warnings']).toBeDefined();
    });

    it('should return 404 for non-existent deal memo', async () => {
      mockFirebaseStorage.getDealMemo.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/export')
        .send({ dealMemoId: 'non-existent-id' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DEAL_MEMO_NOT_FOUND');
    });

    it('should return 400 when deal memo ID is missing', async () => {
      const response = await request(app)
        .post('/api/export')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_DEAL_MEMO_ID');
    });

    it('should handle storage errors', async () => {
      mockFirebaseStorage.getDealMemo.mockRejectedValue(
        new Error('Firebase connection failed')
      );

      const response = await request(app)
        .post('/api/export')
        .send({ dealMemoId: 'deal-memo-123' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXPORT_FAILED');
    });
  });

  describe('POST /api/export/batch', () => {
    it('should export multiple deal memos', async () => {
      const secondMemo = { ...mockDealMemo, id: 'deal-memo-456' };
      mockFirebaseStorage.getDealMemo
        .mockResolvedValueOnce(mockDealMemo)
        .mockResolvedValueOnce(secondMemo);

      const response = await request(app)
        .post('/api/export/batch')
        .send({ dealMemoIds: ['deal-memo-123', 'deal-memo-456'] })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('deal_memos_batch_');
      expect(response.headers['x-export-count']).toBe('2');
      expect(response.headers['x-error-count']).toBe('0');

      expect(response.body.exportMetadata.totalExported).toBe(2);
      expect(response.body.dealMemos).toHaveLength(2);
    });

    it('should handle mixed success and failure in batch export', async () => {
      mockFirebaseStorage.getDealMemo
        .mockResolvedValueOnce(mockDealMemo)
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/export/batch')
        .send({ dealMemoIds: ['deal-memo-123', 'non-existent-id'] })
        .expect(200);

      expect(response.body.exportMetadata.totalExported).toBe(1);
      expect(response.body.exportMetadata.totalErrors).toBe(1);
      expect(response.body.dealMemos).toHaveLength(1);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].id).toBe('non-existent-id');
    });

    it('should reject batch requests exceeding size limit', async () => {
      const largeBatch = Array.from({ length: 51 }, (_, i) => `deal-memo-${i}`);

      const response = await request(app)
        .post('/api/export/batch')
        .send({ dealMemoIds: largeBatch })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BATCH_SIZE_EXCEEDED');
    });

    it('should return 400 when no deal memo IDs provided', async () => {
      const response = await request(app)
        .post('/api/export/batch')
        .send({ dealMemoIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_DEAL_MEMO_IDS');
    });

    it('should return 404 when no valid deal memos found', async () => {
      mockFirebaseStorage.getDealMemo.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/export/batch')
        .send({ dealMemoIds: ['non-existent-1', 'non-existent-2'] })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_DEAL_MEMOS_FOUND');
    });
  });

  describe('GET /api/export/history', () => {
    it('should retrieve paginated deal memo history', async () => {
      const mockQueryResult = {
        data: [mockDealMemo],
        total: 1,
      };

      mockFirebaseStorage.queryDealMemos.mockResolvedValue(mockQueryResult);

      const response = await request(app)
        .get('/api/export/history')
        .query({ page: 1, limit: 20 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it('should apply filters to history query', async () => {
      const mockQueryResult = {
        data: [mockDealMemo],
        total: 1,
      };

      mockFirebaseStorage.queryDealMemos.mockResolvedValue(mockQueryResult);

      const response = await request(app)
        .get('/api/export/history')
        .query({
          companyName: 'TechCorp',
          sector: 'Enterprise Software',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        })
        .expect(200);

      expect(mockFirebaseStorage.queryDealMemos).toHaveBeenCalledWith(
        expect.objectContaining({
          'aegisDealMemo.summary.companyName': 'TechCorp',
          'aegisDealMemo.summary.sector': 'Enterprise Software',
          createdAt: expect.objectContaining({
            '>=': expect.any(Date),
            '<=': expect.any(Date),
          }),
        }),
        expect.any(Object)
      );
    });

    it('should handle storage errors in history retrieval', async () => {
      mockFirebaseStorage.queryDealMemos.mockRejectedValue(
        new Error('Firebase query failed')
      );

      const response = await request(app)
        .get('/api/export/history')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('HISTORY_RETRIEVAL_FAILED');
    });
  });

  describe('GET /api/export/:dealMemoId', () => {
    it('should retrieve specific deal memo', async () => {
      mockFirebaseStorage.getDealMemo.mockResolvedValue(mockDealMemo);

      const response = await request(app)
        .get('/api/export/deal-memo-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('deal-memo-123');
      expect(response.body.data.aegisDealMemo.summary.companyName).toBe('TechCorp');
    });

    it('should return 404 for non-existent deal memo', async () => {
      mockFirebaseStorage.getDealMemo.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/export/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DEAL_MEMO_NOT_FOUND');
    });
  });

  describe('DELETE /api/export/:dealMemoId', () => {
    it('should delete specific deal memo', async () => {
      mockFirebaseStorage.deleteDealMemo.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/export/deal-memo-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);
      expect(mockFirebaseStorage.deleteDealMemo).toHaveBeenCalledWith('deal-memo-123');
    });

    it('should return 404 when deal memo cannot be deleted', async () => {
      mockFirebaseStorage.deleteDealMemo.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/export/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DEAL_MEMO_NOT_FOUND');
    });

    it('should handle storage errors during deletion', async () => {
      mockFirebaseStorage.deleteDealMemo.mockRejectedValue(
        new Error('Firebase deletion failed')
      );

      const response = await request(app)
        .delete('/api/export/deal-memo-123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DELETION_FAILED');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete export workflow', async () => {
      // First export a deal memo
      mockFirebaseStorage.getDealMemo.mockResolvedValue(mockDealMemo);

      const exportResponse = await request(app)
        .post('/api/export')
        .send({ dealMemoId: 'deal-memo-123' })
        .expect(200);

      expect(exportResponse.body.aegisDealMemo.summary.companyName).toBe('TechCorp');

      // Then retrieve it via GET endpoint
      const retrieveResponse = await request(app)
        .get('/api/export/deal-memo-123')
        .expect(200);

      expect(retrieveResponse.body.data.id).toBe('deal-memo-123');

      // Finally delete it
      mockFirebaseStorage.deleteDealMemo.mockResolvedValue(true);

      const deleteResponse = await request(app)
        .delete('/api/export/deal-memo-123')
        .expect(200);

      expect(deleteResponse.body.data.deleted).toBe(true);
    });

    it('should handle batch export with filtering and pagination', async () => {
      const memos = [
        mockDealMemo,
        { ...mockDealMemo, id: 'deal-memo-456' },
        { ...mockDealMemo, id: 'deal-memo-789' },
      ];

      // Test history with pagination
      mockFirebaseStorage.queryDealMemos.mockResolvedValue({
        data: memos.slice(0, 2),
        total: 3,
      });

      const historyResponse = await request(app)
        .get('/api/export/history')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(historyResponse.body.data).toHaveLength(2);
      expect(historyResponse.body.pagination.totalPages).toBe(2);

      // Test batch export
      mockFirebaseStorage.getDealMemo
        .mockResolvedValueOnce(memos[0])
        .mockResolvedValueOnce(memos[1]);

      const batchResponse = await request(app)
        .post('/api/export/batch')
        .send({ dealMemoIds: ['deal-memo-123', 'deal-memo-456'] })
        .expect(200);

      expect(batchResponse.body.dealMemos).toHaveLength(2);
      expect(batchResponse.body.exportMetadata.totalExported).toBe(2);
    });
  });
});