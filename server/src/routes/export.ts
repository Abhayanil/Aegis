import express from 'express';
import { FirebaseStorage } from '../services/storage/FirebaseStorage.js';
import { logger } from '../utils/logger.js';
import { AppError, createErrorResponse } from '../utils/errors.js';
import { ApiResponse, PaginatedResponse } from '../types/interfaces.js';
import { DealMemo } from '../models/DealMemo.js';
import { validateDealMemoSchema } from '../utils/validation.js';

const router = express.Router();

/**
 * POST /api/export
 * Export deal memo as JSON file with schema validation
 */
router.post('/', async (req, res) => {
  try {
    const { dealMemoId, format = 'json' } = req.body;

    if (!dealMemoId) {
      throw new AppError(
        'Deal memo ID is required for export',
        400,
        'MISSING_DEAL_MEMO_ID'
      );
    }

    // Retrieve deal memo from storage
    const firebaseStorage = new FirebaseStorage();
    const dealMemo = await firebaseStorage.getDealMemo(dealMemoId);

    if (!dealMemo) {
      throw new AppError(
        'Deal memo not found',
        404,
        'DEAL_MEMO_NOT_FOUND',
        { dealMemoId }
      );
    }

    // Validate schema before export
    const validation = validateDealMemoSchema(dealMemo);
    if (!validation.isValid) {
      logger.warn('Deal memo schema validation failed during export', {
        dealMemoId,
        errors: validation.errors,
      });
      
      // Still allow export but include validation warnings
    }

    // Generate filename
    const companyName = dealMemo.aegisDealMemo.summary.companyName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${companyName}_deal_memo_${timestamp}.${format}`;

    logger.info('Exporting deal memo', {
      dealMemoId,
      companyName: dealMemo.aegisDealMemo.summary.companyName,
      format,
      filename,
    });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Schema-Valid', validation.isValid.toString());
    
    if (!validation.isValid) {
      res.setHeader('X-Schema-Warnings', JSON.stringify(validation.warnings));
    }

    // Send the deal memo as JSON
    res.status(200).json(dealMemo);

  } catch (error) {
    logger.error('Deal memo export failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Export failed',
      500,
      'EXPORT_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

/**
 * POST /api/export/batch
 * Export multiple deal memos as a batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { dealMemoIds, format = 'json' } = req.body;

    if (!dealMemoIds || !Array.isArray(dealMemoIds) || dealMemoIds.length === 0) {
      throw new AppError(
        'Deal memo IDs array is required for batch export',
        400,
        'MISSING_DEAL_MEMO_IDS'
      );
    }

    if (dealMemoIds.length > 50) {
      throw new AppError(
        'Batch export limited to 50 deal memos per request',
        400,
        'BATCH_SIZE_EXCEEDED'
      );
    }

    const firebaseStorage = new FirebaseStorage();
    const results: DealMemo[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Retrieve all deal memos
    for (const dealMemoId of dealMemoIds) {
      try {
        const dealMemo = await firebaseStorage.getDealMemo(dealMemoId);
        if (dealMemo) {
          results.push(dealMemo);
        } else {
          errors.push({
            id: dealMemoId,
            error: 'Deal memo not found',
          });
        }
      } catch (error) {
        errors.push({
          id: dealMemoId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (results.length === 0) {
      throw new AppError(
        'No valid deal memos found for export',
        404,
        'NO_DEAL_MEMOS_FOUND'
      );
    }

    // Generate batch filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `deal_memos_batch_${timestamp}.${format}`;

    logger.info('Exporting deal memo batch', {
      requestedCount: dealMemoIds.length,
      successfulCount: results.length,
      errorCount: errors.length,
      filename,
    });

    // Prepare batch export data
    const batchData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        totalRequested: dealMemoIds.length,
        totalExported: results.length,
        totalErrors: errors.length,
        format,
      },
      dealMemos: results,
      ...(errors.length > 0 && { errors }),
    };

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', results.length.toString());
    res.setHeader('X-Error-Count', errors.length.toString());

    res.status(200).json(batchData);

  } catch (error) {
    logger.error('Batch export failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Batch export failed',
      500,
      'BATCH_EXPORT_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/export/history
 * Retrieve historical deal memos with pagination
 */
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const companyName = req.query.companyName as string;
    const sector = req.query.sector as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const firebaseStorage = new FirebaseStorage();
    
    // Build query filters
    const filters: Record<string, any> = {};
    if (companyName) {
      filters['aegisDealMemo.summary.companyName'] = companyName;
    }
    if (sector) {
      filters['aegisDealMemo.summary.sector'] = sector;
    }
    if (dateFrom) {
      filters.createdAt = { '>=': new Date(dateFrom) };
    }
    if (dateTo) {
      filters.createdAt = { ...filters.createdAt, '<=': new Date(dateTo) };
    }

    const result = await firebaseStorage.queryDealMemos(filters, {
      page,
      limit,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    logger.info('Retrieved deal memo history', {
      page,
      limit,
      filters,
      resultCount: result.data.length,
      totalCount: result.total,
    });

    const response: PaginatedResponse<DealMemo> = {
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      metadata: {
        processingTime: 0,
        timestamp: new Date(),
        version: '1.0.0',
      },
    };

    res.json(response);

  } catch (error) {
    logger.error('Failed to retrieve deal memo history', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Failed to retrieve history',
      500,
      'HISTORY_RETRIEVAL_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

/**
 * GET /api/export/:dealMemoId
 * Retrieve a specific deal memo by ID
 */
router.get('/:dealMemoId', async (req, res) => {
  try {
    const { dealMemoId } = req.params;

    const firebaseStorage = new FirebaseStorage();
    const dealMemo = await firebaseStorage.getDealMemo(dealMemoId);

    if (!dealMemo) {
      throw new AppError(
        'Deal memo not found',
        404,
        'DEAL_MEMO_NOT_FOUND',
        { dealMemoId }
      );
    }

    logger.info('Retrieved deal memo', {
      dealMemoId,
      companyName: dealMemo.aegisDealMemo.summary.companyName,
    });

    const response: ApiResponse<DealMemo> = {
      success: true,
      data: dealMemo,
      metadata: {
        processingTime: 0,
        timestamp: new Date(),
        version: '1.0.0',
      },
    };

    res.json(response);

  } catch (error) {
    logger.error('Failed to retrieve deal memo', {
      dealMemoId: req.params.dealMemoId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Failed to retrieve deal memo',
      500,
      'RETRIEVAL_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

/**
 * DELETE /api/export/:dealMemoId
 * Delete a specific deal memo
 */
router.delete('/:dealMemoId', async (req, res) => {
  try {
    const { dealMemoId } = req.params;

    const firebaseStorage = new FirebaseStorage();
    const deleted = await firebaseStorage.deleteDealMemo(dealMemoId);

    if (!deleted) {
      throw new AppError(
        'Deal memo not found or could not be deleted',
        404,
        'DEAL_MEMO_NOT_FOUND',
        { dealMemoId }
      );
    }

    logger.info('Deleted deal memo', { dealMemoId });

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
      metadata: {
        processingTime: 0,
        timestamp: new Date(),
        version: '1.0.0',
      },
    };

    res.json(response);

  } catch (error) {
    logger.error('Failed to delete deal memo', {
      dealMemoId: req.params.dealMemoId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof AppError) {
      const errorResponse = createErrorResponse(error);
      return res.status(error.statusCode).json(errorResponse);
    }

    const unexpectedError = new AppError(
      'Failed to delete deal memo',
      500,
      'DELETION_FAILED',
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    const errorResponse = createErrorResponse(unexpectedError);
    return res.status(500).json(errorResponse);
  }
});

export default router;