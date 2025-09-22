import express from 'express';
import uploadRoutes from './upload.js';
import dealMemoRoutes from './dealMemo.js';
import exportRoutes from './export.js';

const router = express.Router();

// Mount route modules
router.use('/upload', uploadRoutes);
router.use('/deal-memo', dealMemoRoutes);
router.use('/export', exportRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        database: 'healthy', // This would be dynamic in a real implementation
        ai: 'healthy',
      },
    },
  });
});

export default router;