// Vercel serverless function for export functionality

// Simple logger
const logger = {
  info: (message, data) => console.log(`[INFO] ${message}`, data || ''),
  error: (message, error) => console.error(`[ERROR] ${message}`, error || ''),
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed',
      },
    });
  }

  try {
    const { dealMemoId, format = 'json', includeSourceDocuments = false } = req.body;

    if (!dealMemoId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEAL_MEMO_ID',
          message: 'Deal memo ID is required',
        },
      });
    }

    const supportedFormats = ['json', 'pdf', 'docx'];
    if (!supportedFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_FORMAT',
          message: `Format '${format}' is not supported. Supported formats: ${supportedFormats.join(', ')}`,
        },
      });
    }

    logger.info(`Starting export for deal memo ${dealMemoId}`, {
      format,
      includeSourceDocuments,
    });

    // Mock export functionality for development
    const mockExportData = {
      dealMemoId,
      format,
      exportedAt: new Date().toISOString(),
      downloadUrl: `https://example.com/exports/${dealMemoId}.${format}`,
      fileSize: Math.floor(Math.random() * 1000000) + 100000, // Random file size
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.json({
      success: true,
      data: mockExportData,
    });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred during export',
      },
    });
  }
}