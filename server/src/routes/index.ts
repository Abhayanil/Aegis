import express from 'express';
import uploadRoutes from './upload.js';
import dealMemoRoutes from './dealMemo.js';
import exportRoutes from './export.js';

const router = express.Router();

// Mount route modules
router.use('/upload', uploadRoutes);
router.use('/deal-memo', dealMemoRoutes);
router.use('/export', exportRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Aegis AI Deal Memo Generation API',
    version: '1.0.0',
    endpoints: {
      upload: {
        'POST /api/upload': 'Upload and process documents',
        'GET /api/upload/progress/:sessionId': 'Get upload progress',
        'DELETE /api/upload/progress/:sessionId': 'Clean up progress tracking',
      },
      dealMemo: {
        'POST /api/deal-memo': 'Generate deal memo from processed documents',
        'GET /api/deal-memo/progress/:sessionId': 'Get analysis progress',
        'POST /api/deal-memo/stream': 'Generate deal memo with streaming responses',
      },
      export: {
        'POST /api/export': 'Export deal memo as JSON file',
        'POST /api/export/batch': 'Export multiple deal memos',
        'GET /api/export/history': 'Retrieve historical deal memos',
        'GET /api/export/:dealMemoId': 'Retrieve specific deal memo',
        'DELETE /api/export/:dealMemoId': 'Delete specific deal memo',
      },
    },
    documentation: {
      upload: 'Supports PDF, DOCX, PPTX, TXT files up to 50MB each, max 10 files per request',
      dealMemo: 'Requires processed documents from upload endpoint, supports custom weightings',
      export: 'Supports JSON format with schema validation, batch operations up to 50 memos',
    },
  });
});

export default router;