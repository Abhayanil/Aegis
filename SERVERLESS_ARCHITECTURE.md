# Aegis Serverless Architecture

## 🏗️ Architecture Overview

The Aegis platform has been converted from a traditional Express.js server to a serverless architecture optimized for Vercel deployment.

## 📊 Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App  │    │  Vercel Edge    │    │ Serverless APIs │
│   (Frontend)    │◄──►│   Functions     │◄──►│   (Backend)     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Static CDN    │    │   Edge Cache    │    │  Google Cloud   │
│   (Assets)      │    │   (Responses)   │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔄 Migration from Express.js to Serverless

### Before (Express.js)
```javascript
// server/src/server.ts
app.post('/api/upload', upload.array('files'), async (req, res) => {
  // Handle upload logic
});

app.post('/api/deal-memo/generate', async (req, res) => {
  // Handle deal memo generation
});
```

### After (Serverless Functions)
```javascript
// server/api/upload.js
export default async function handler(req, res) {
  // Handle upload logic
}

// server/api/deal-memo/generate.js
export default async function handler(req, res) {
  // Handle deal memo generation
}
```

## 📁 Serverless Function Structure

```
server/
├── api/                          # Serverless functions
│   ├── upload.js                 # POST /api/upload
│   ├── export.js                 # POST /api/export
│   └── deal-memo/
│       └── generate.js           # POST /api/deal-memo/generate
├── src/                          # Shared business logic
│   ├── services/                 # Business services
│   ├── utils/                    # Utilities
│   └── types/                    # Type definitions
├── package.json                  # Dependencies
└── vercel.json                   # Deployment configuration
```

## 🚀 Benefits of Serverless Architecture

### 1. **Scalability**
- Automatic scaling based on demand
- No server management required
- Pay-per-execution model

### 2. **Performance**
- Global edge deployment
- Cold start optimization
- Automatic caching

### 3. **Cost Efficiency**
- No idle server costs
- Pay only for actual usage
- Generous free tier

### 4. **Reliability**
- Built-in redundancy
- Automatic failover
- 99.99% uptime SLA

## ⚡ Function Specifications

### Upload Function (`/api/upload`)
- **Runtime**: Node.js 18.x
- **Timeout**: 30 seconds
- **Memory**: 1024 MB
- **Max Payload**: 50 MB
- **Features**:
  - Multi-file upload support
  - File type validation
  - Mock data for development
  - Progress tracking

### Deal Memo Generation (`/api/deal-memo/generate`)
- **Runtime**: Node.js 18.x
- **Timeout**: 30 seconds
- **Memory**: 1024 MB
- **Features**:
  - AI-powered analysis
  - Benchmarking integration
  - Risk assessment
  - Mock data for development

### Export Function (`/api/export`)
- **Runtime**: Node.js 18.x
- **Timeout**: 30 seconds
- **Memory**: 512 MB
- **Features**:
  - Multiple format support (JSON, PDF, DOCX)
  - Secure download URLs
  - Expiring links

## 🔧 Configuration Files

### `vercel.json` (Backend)
```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs18.x",
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

### `package.json` (Backend)
```json
{
  "type": "module",
  "scripts": {
    "vercel-build": "npm run build"
  },
  "dependencies": {
    "multer": "^1.4.5-lts.1",
    "express": "^4.18.2"
  }
}
```

## 🌐 API Endpoints

### Production URLs
```
Backend:  https://aegis-backend-xyz.vercel.app
Frontend: https://aegis-frontend-abc.vercel.app

API Endpoints:
- POST /api/upload
- POST /api/deal-memo/generate  
- POST /api/export
```

### Local Development URLs
```
Backend:  http://localhost:3001
Frontend: http://localhost:3000

API Endpoints:
- POST http://localhost:3001/api/upload
- POST http://localhost:3001/api/deal-memo/generate
- POST http://localhost:3001/api/export
```

## 🔐 Environment Variables

### Backend Environment Variables
```bash
# Essential
NODE_ENV=production
GOOGLE_CLOUD_PROJECT_ID=aegis-prod
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Google Cloud Services
GOOGLE_APPLICATION_CREDENTIALS_JSON=base64-encoded-json
FIREBASE_PROJECT_ID=aegis-prod
BIGQUERY_DATASET_ID=aegis_benchmarks
CLOUD_STORAGE_BUCKET=aegis-documents

# Optional
LOG_LEVEL=info
ENABLE_MOCK_DATA=false
```

### Frontend Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://aegis-backend-xyz.vercel.app/api
NODE_ENV=production
```

## 📈 Performance Optimization

### 1. Cold Start Mitigation
```javascript
// Minimize imports in serverless functions
import { logger } from '../src/utils/logger.js';

// Use dynamic imports for heavy dependencies
const heavyLibrary = await import('heavy-library');
```

### 2. Caching Strategy
```javascript
// Add appropriate cache headers
res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');

// Cache expensive operations
const cachedResult = await cache.get(key) || await expensiveOperation();
```

### 3. Bundle Optimization
- Tree-shake unused dependencies
- Use ES modules for better optimization
- Minimize function bundle size

## 🧪 Testing Serverless Functions

### Local Testing
```bash
# Install Vercel CLI
npm install -g vercel

# Run local development server
cd server
vercel dev

# Test endpoints
curl -X POST http://localhost:3000/api/upload \
  -F "files=@test.pdf"
```

### Production Testing
```bash
# Test deployed functions
curl -X POST https://your-backend.vercel.app/api/upload \
  -F "files=@test.pdf"

# Check function logs
vercel logs https://your-backend.vercel.app
```

## 🚨 Limitations & Considerations

### Vercel Limits
- **Function Timeout**: 30 seconds (Pro plan)
- **Payload Size**: 50 MB maximum
- **Memory**: Up to 3008 MB (Pro plan)
- **Execution Time**: 100 GB-seconds per month (Hobby)

### Workarounds
1. **Large File Processing**: Use direct cloud storage uploads
2. **Long Processing**: Break into smaller functions or use queues
3. **State Management**: Use external storage (Redis, Database)

## 🔄 CI/CD Pipeline

### GitHub Actions
```yaml
name: Deploy Serverless Functions

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: ./server
          
  deploy-frontend:
    needs: deploy-backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          working-directory: ./client
```

## 📊 Monitoring & Observability

### Built-in Monitoring
- Vercel Analytics (performance metrics)
- Function logs (real-time)
- Error tracking (automatic)

### Custom Monitoring
```javascript
// Add structured logging
import { logger } from '../src/utils/logger.js';

export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    logger.info('Function invoked', {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent']
    });
    
    // Function logic
    
    logger.info('Function completed', {
      duration: Date.now() - startTime,
      status: res.statusCode
    });
  } catch (error) {
    logger.error('Function error', {
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
  }
}
```

## 🎯 Best Practices

### 1. Function Design
- Keep functions small and focused
- Minimize cold start time
- Use appropriate memory allocation
- Handle errors gracefully

### 2. Security
- Validate all inputs
- Use environment variables for secrets
- Implement rate limiting
- Add CORS headers

### 3. Performance
- Cache expensive operations
- Use connection pooling
- Optimize bundle size
- Monitor function metrics

## 🔗 Migration Checklist

- [x] Convert Express routes to serverless functions
- [x] Update package.json for Vercel deployment
- [x] Create vercel.json configuration
- [x] Update API client for new endpoints
- [x] Configure environment variables
- [x] Add CORS headers
- [x] Implement error handling
- [x] Add logging and monitoring
- [x] Create deployment scripts
- [x] Write documentation

## 📚 Additional Resources

- [Vercel Serverless Functions Documentation](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Serverless Architecture Patterns](https://serverlessland.com/patterns)

The serverless architecture provides a modern, scalable, and cost-effective solution for the Aegis platform while maintaining all the functionality of the original Express.js server.