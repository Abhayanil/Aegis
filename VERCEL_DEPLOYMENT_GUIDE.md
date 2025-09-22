# Vercel Deployment Guide for Aegis Platform

## 🚀 Overview

This guide explains how to deploy the Aegis platform to Vercel with a serverless backend architecture.

## 📁 Project Structure for Vercel

```
project/
├── client/                 # Next.js frontend (deploy to Vercel)
│   ├── src/
│   ├── package.json
│   └── vercel.json        # Frontend deployment config
├── server/                # Serverless backend (deploy to Vercel)
│   ├── api/               # Serverless functions
│   │   ├── upload.js
│   │   ├── export.js
│   │   └── deal-memo/
│   │       └── generate.js
│   ├── src/               # Shared backend code
│   ├── package.json
│   └── vercel.json        # Backend deployment config
└── README.md
```

## 🔧 Backend Deployment (Serverless Functions)

### 1. Prepare Backend for Vercel

The Express.js server has been converted to Vercel serverless functions:

- `server/api/upload.js` - File upload endpoint
- `server/api/deal-memo/generate.js` - Deal memo generation
- `server/api/export.js` - Export functionality

### 2. Deploy Backend to Vercel

```bash
# Navigate to server directory
cd server

# Install Vercel CLI (if not already installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy backend
vercel --prod

# Note the deployment URL (e.g., https://aegis-backend-xyz.vercel.app)
```

### 3. Configure Environment Variables

In Vercel dashboard for your backend project:

```bash
# Required for production
NODE_ENV=production
GOOGLE_CLOUD_PROJECT_ID=your-project-id
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key

# Optional for full functionality
FIREBASE_PROJECT_ID=your-firebase-project
BIGQUERY_DATASET_ID=aegis_benchmarks
CLOUD_STORAGE_BUCKET=aegis-documents
```

## 🌐 Frontend Deployment

### 1. Update API Configuration

Update `client/src/lib/api.ts` with your backend URL:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  'https://your-backend-deployment-url.vercel.app/api';
```

### 2. Configure Environment Variables

Create `client/.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://your-backend-deployment-url.vercel.app/api
NODE_ENV=production
```

### 3. Deploy Frontend to Vercel

```bash
# Navigate to client directory
cd client

# Deploy frontend
vercel --prod
```

## 📋 Step-by-Step Deployment

### Option 1: Separate Deployments (Recommended)

1. **Deploy Backend First:**
   ```bash
   cd server
   vercel --prod
   # Copy the deployment URL
   ```

2. **Update Frontend Configuration:**
   ```bash
   cd ../client
   # Update .env.local with backend URL
   echo "NEXT_PUBLIC_API_URL=https://your-backend-url.vercel.app/api" > .env.local
   ```

3. **Deploy Frontend:**
   ```bash
   vercel --prod
   ```

### Option 2: Monorepo Deployment

1. **Create Root Vercel Configuration:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "client/package.json",
         "use": "@vercel/next"
       },
       {
         "src": "server/api/**/*.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/server/api/$1"
       },
       {
         "src": "/(.*)",
         "dest": "/client/$1"
       }
     ]
   }
   ```

## 🔐 Environment Variables Setup

### Backend Environment Variables (Vercel Dashboard)

```bash
# Essential
NODE_ENV=production
GOOGLE_CLOUD_PROJECT_ID=your-project-id
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Google Cloud (Base64 encoded service account JSON)
GOOGLE_APPLICATION_CREDENTIALS_JSON=eyJ0eXBlIjoi...

# Firebase
FIREBASE_PROJECT_ID=aegis-prod
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@aegis-prod.iam.gserviceaccount.com

# Optional
BIGQUERY_DATASET_ID=aegis_benchmarks
CLOUD_STORAGE_BUCKET=aegis-documents-prod
LOG_LEVEL=info
```

### Frontend Environment Variables (Vercel Dashboard)

```bash
NEXT_PUBLIC_API_URL=https://aegis-backend-xyz.vercel.app/api
NODE_ENV=production
```

## 🧪 Testing Deployment

### 1. Test Backend Endpoints

```bash
# Test upload endpoint
curl -X POST https://your-backend-url.vercel.app/api/upload \
  -F "files=@test-document.pdf"

# Test deal memo generation
curl -X POST https://your-backend-url.vercel.app/api/deal-memo/generate \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session","documentIds":["doc1"]}'
```

### 2. Test Frontend

Visit your frontend URL and test:
- File upload functionality
- Deal memo generation
- UI components rendering

## 🚨 Common Issues & Solutions

### 1. 404 Errors on API Calls

**Problem:** Frontend can't reach backend APIs
**Solution:** 
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS configuration in serverless functions
- Ensure backend is deployed and accessible

### 2. Function Timeout Errors

**Problem:** Serverless functions timing out
**Solution:**
- Increase timeout in `vercel.json` (max 30s for Pro plan)
- Optimize processing logic
- Use async/await properly

### 3. File Upload Issues

**Problem:** Large file uploads failing
**Solution:**
- Vercel has 50MB limit for serverless functions
- Consider using direct cloud storage uploads
- Implement chunked upload for large files

### 4. Environment Variables Not Working

**Problem:** Environment variables not accessible
**Solution:**
- Ensure variables are set in Vercel dashboard
- Redeploy after adding new variables
- Check variable names match exactly

## 📊 Performance Optimization

### 1. Cold Start Optimization

```javascript
// Keep functions warm with minimal dependencies
import { logger } from '../src/utils/logger.js';

// Minimize imports in serverless functions
const handler = async (req, res) => {
  // Function logic
};
```

### 2. Caching Strategy

```javascript
// Add caching headers
res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
```

### 3. Bundle Size Optimization

- Use dynamic imports for heavy dependencies
- Tree-shake unused code
- Minimize serverless function bundle size

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy Backend
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.BACKEND_PROJECT_ID }}
          working-directory: ./server
          
      - name: Deploy Frontend
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.FRONTEND_PROJECT_ID }}
          working-directory: ./client
```

## 📈 Monitoring & Logging

### 1. Vercel Analytics

Enable in Vercel dashboard for performance monitoring.

### 2. Error Tracking

```javascript
// Add to serverless functions
try {
  // Function logic
} catch (error) {
  console.error('Function error:', error);
  // Send to error tracking service
}
```

### 3. Custom Logging

```javascript
import { logger } from '../src/utils/logger.js';

export default async function handler(req, res) {
  logger.info('Function invoked', { 
    method: req.method, 
    url: req.url 
  });
  
  // Function logic
}
```

## 🎯 Production Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] File upload working
- [ ] Deal memo generation working
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Performance optimized
- [ ] Security headers added
- [ ] CORS properly configured
- [ ] Domain configured (optional)
- [ ] SSL certificate active
- [ ] Monitoring setup

## 🔗 Useful Links

- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Custom Domains](https://vercel.com/docs/concepts/projects/custom-domains)

## 🆘 Support

If you encounter issues:

1. Check Vercel function logs in dashboard
2. Verify environment variables
3. Test API endpoints individually
4. Check network connectivity
5. Review CORS configuration

The serverless architecture provides better scalability and cost-effectiveness compared to traditional server deployment.