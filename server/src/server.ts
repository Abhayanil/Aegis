import express from 'express';
import cors from 'cors';
import { appConfig } from './utils/config.js';
import { logger } from './utils/logger.js';
import { AppError, createErrorResponse } from './utils/errors.js';
import apiRoutes from './routes/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: appConfig.server.nodeEnv,
  });
});

// Mount API routes
app.use('/api', apiRoutes);

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);

  if (error instanceof AppError) {
    const errorResponse = createErrorResponse(error);
    return res.status(error.statusCode).json(errorResponse);
  }

  // Handle unexpected errors
  const unexpectedError = new AppError(
    'An unexpected error occurred',
    500,
    'INTERNAL_SERVER_ERROR',
    { originalError: error.message }
  );

  const errorResponse = createErrorResponse(unexpectedError);
  return res.status(500).json(errorResponse);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
      retryable: false,
    },
  });
});

// Start server
const port = appConfig.server.port;
app.listen(port, () => {
  logger.info(`Aegis backend server started on port ${port}`, {
    environment: appConfig.server.nodeEnv,
    port,
  });
});

export default app;