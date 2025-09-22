# Aegis Deployment Guide

This guide covers deploying the Aegis AI Deal Analysis platform using the recommended architecture:
- **Frontend (Next.js)**: Deployed to Vercel
- **Backend (Node.js/Express)**: Deployed to Railway, Render, or similar

## 🚀 Quick Deployment

### Frontend Deployment (Vercel)

1. **Connect Repository to Vercel**
   ```bash
   # Install Vercel CLI (optional)
   npm i -g vercel
   
   # Deploy from client directory
   cd client
   vercel
   ```

2. **Configure Environment Variables in Vercel Dashboard**
   - Go to your Vercel project settings
   - Add these environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   NEXT_PUBLIC_APP_ENV=production
   ```

3. **Set Build Configuration**
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### Backend Deployment (Railway)

1. **Connect Repository to Railway**
   - Go to [Railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Select the `server` directory as root

2. **Configure Environment Variables**
   ```
   PORT=3001
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend-domain.vercel.app
   ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app
   
   # Google Cloud
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   
   # API Keys
   OPENAI_API_KEY=your-openai-key
   GEMINI_API_KEY=your-gemini-key
   ```

3. **Upload Service Account**
   - Upload your Google Cloud service account JSON file
   - Set the path in `GOOGLE_APPLICATION_CREDENTIALS`

## 📋 Detailed Setup

### Prerequisites

- Node.js 18+ installed locally
- Google Cloud Project with enabled APIs:
  - Vertex AI API
  - Cloud Vision API
  - BigQuery API
  - Firestore API
- OpenAI API key
- Vercel account
- Railway/Render account

### Local Development Setup

1. **Clone and Install Dependencies**
   ```bash
   # Install backend dependencies
   cd server
   npm install
   
   # Install frontend dependencies
   cd ../client
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   # Backend (.env)
   cp server/.env.example server/.env
   # Edit server/.env with your values
   
   # Frontend (.env.local)
   cp client/.env.example client/.env.local
   # Edit client/.env.local with your values
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1: Start backend
   cd server
   npm run dev
   
   # Terminal 2: Start frontend
   cd client
   npm run dev
   ```

### Production Deployment Steps

#### Step 1: Deploy Backend

**Option A: Railway (Recommended)**
1. Connect GitHub repo to Railway
2. Set root directory to `server`
3. Configure environment variables
4. Deploy automatically on push

**Option B: Render**
1. Connect GitHub repo to Render
2. Create new Web Service
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Configure environment variables

**Option C: Google Cloud Run**
```bash
# Build and deploy to Cloud Run
cd server
gcloud run deploy aegis-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### Step 2: Deploy Frontend

1. **Vercel Dashboard Method**
   - Import project from GitHub
   - Set root directory to `client`
   - Configure environment variables
   - Deploy

2. **Vercel CLI Method**
   ```bash
   cd client
   vercel --prod
   ```

#### Step 3: Update CORS Configuration

After both deployments, update your backend environment variables:
```
ALLOWED_ORIGINS=https://your-actual-frontend-domain.vercel.app
```

## 🔧 Configuration Details

### Frontend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://aegis-backend.railway.app` |
| `NEXT_PUBLIC_APP_ENV` | Environment | `production` |

### Backend Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (defaults to 3001) |
| `NODE_ENV` | Environment | Yes |
| `CORS_ORIGIN` | Frontend URL for CORS | Yes |
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |

### Google Cloud Setup

1. **Create Service Account**
   ```bash
   gcloud iam service-accounts create aegis-backend \
     --display-name="Aegis Backend Service Account"
   ```

2. **Grant Permissions**
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:aegis-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:aegis-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/bigquery.dataViewer"
   ```

3. **Download Key**
   ```bash
   gcloud iam service-accounts keys create service-account.json \
     --iam-account=aegis-backend@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

## 🔍 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `ALLOWED_ORIGINS` includes your frontend domain
   - Check that both HTTP and HTTPS are configured if needed

2. **API Connection Issues**
   - Verify `NEXT_PUBLIC_API_URL` points to correct backend
   - Check backend health endpoint: `https://your-backend.com/health`

3. **Google Cloud Authentication**
   - Ensure service account has correct permissions
   - Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct

4. **Build Failures**
   - Check Node.js version compatibility
   - Ensure all environment variables are set
   - Review build logs for specific errors

### Health Checks

**Backend Health Check**
```bash
curl https://your-backend-url.com/health
```

**Frontend Health Check**
```bash
curl https://your-frontend-url.vercel.app
```

## 📊 Monitoring

### Vercel Analytics
Add to your Vercel project for frontend monitoring:
```javascript
// Add to client/src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Backend Monitoring
The backend includes built-in logging and health checks. Consider adding:
- Sentry for error tracking
- DataDog or New Relic for performance monitoring
- Uptime monitoring service

## 🔄 CI/CD Pipeline

### Automatic Deployments

**Frontend (Vercel)**
- Automatically deploys on push to main branch
- Preview deployments for pull requests

**Backend (Railway)**
- Automatically deploys on push to main branch
- Environment-specific deployments

### Manual Deployment Commands

```bash
# Deploy frontend
cd client && vercel --prod

# Deploy backend (if using manual deployment)
cd server && npm run deploy
```

## 🛡️ Security Considerations

1. **Environment Variables**
   - Never commit `.env` files
   - Use platform-specific secret management
   - Rotate API keys regularly

2. **CORS Configuration**
   - Restrict origins to known domains
   - Don't use wildcards in production

3. **API Security**
   - Implement rate limiting
   - Add authentication for sensitive endpoints
   - Validate all inputs

4. **Google Cloud Security**
   - Use least-privilege service accounts
   - Enable audit logging
   - Monitor API usage

## 📈 Scaling Considerations

### Frontend Scaling
- Vercel handles scaling automatically
- Consider CDN for static assets
- Implement caching strategies

### Backend Scaling
- Use horizontal scaling on Railway/Render
- Implement connection pooling for databases
- Consider microservices architecture for high load

### Database Scaling
- Use Firebase/Firestore for document storage
- Implement BigQuery for analytics
- Consider read replicas for high read loads