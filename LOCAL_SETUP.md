# 🚀 Local Development Setup

This guide will help you run the Aegis platform locally on your machine.

## Prerequisites

- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **Git** for version control

## Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies  
cd ../client
npm install
```

### 2. Set Up Environment Variables

**Backend Environment (.env)**
```bash
cd server
cp .env.example .env
```

Edit `server/.env` with these minimal settings for local development:
```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# CORS Configuration (for local development)
CORS_ORIGIN=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Mock API Keys (for development - replace with real keys when ready)
OPENAI_API_KEY=mock-openai-key
GEMINI_API_KEY=mock-gemini-key
GOOGLE_CLOUD_PROJECT=mock-project

# File Upload
MAX_FILE_SIZE=50MB
UPLOAD_DIR=./uploads
```

**Frontend Environment (.env.local)**
```bash
cd client
cp .env.example .env.local
```

Edit `client/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development
```

### 3. Start Development Servers

**Terminal 1: Start Backend**
```bash
cd server
npm run dev
```

**Terminal 2: Start Frontend**
```bash
cd client
npm run dev
```

### 4. Open in Browser

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health

## 🎯 What You'll See

### Landing Page (http://localhost:3000)
- Hero section with drag-and-drop file upload
- Feature preview cards
- Professional dark theme (Bloomberg Terminal style)

### Upload Flow
1. Drag and drop PDF, DOCX, PPTX, or TXT files
2. See processing status with detailed steps
3. Navigate to deal memo analysis

### Deal Memo Interface
- Company header with signal score and recommendation
- Key metrics dashboard with benchmark comparisons
- Growth potential analysis
- Risk assessment matrix
- Investment recommendations
- Interactive sidebar with document hub and weighting sliders

## 🔧 Development Features

### Hot Reload
- Frontend: Automatic refresh on file changes
- Backend: Automatic restart on TypeScript changes

### Mock Data
The application includes mock data for development:
- Sample deal memo responses
- Mock benchmark data
- Simulated processing delays
- Test document thumbnails

### API Testing
Test the backend API directly:
```bash
# Health check
curl http://localhost:3001/api/health

# Upload test (requires multipart form data)
# Use Postman or similar tool for file uploads
```

## 🎨 UI Components

The interface implements the Bloomberg Terminal aesthetic:
- **Dark theme** with charcoal/navy backgrounds
- **Professional typography** using Inter font
- **Color-coded elements** (green for good, yellow for moderate, red for poor)
- **Data-dense layouts** with clear hierarchy
- **Interactive elements** with smooth animations

### Key UI Features
- **Progressive disclosure**: Start with high-level score, drill down for details
- **Real-time updates**: Weighting sliders update signal scores instantly
- **Source attribution**: Clickable references to source documents
- **Responsive design**: Optimized for desktop with mobile support

## 🛠️ Development Tools

### Available Scripts

**Backend (`server/`)**
```bash
npm run dev          # Development with hot reload
npm run build        # Build TypeScript
npm run start        # Production start
npm run test         # Run unit tests
npm run test:integration  # Run integration tests
```

**Frontend (`client/`)**
```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run type-check   # TypeScript checking
```

### Testing
```bash
# Run backend tests
cd server && npm test

# Run integration tests
cd server && npm run test:integration

# Frontend type checking
cd client && npm run type-check
```

## 🔍 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process on port 3000 or 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

**Module Not Found Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**TypeScript Errors**
```bash
# Clear TypeScript cache
rm -rf dist
npm run build
```

**CORS Errors**
- Ensure backend is running on port 3001
- Check that `CORS_ORIGIN` includes `http://localhost:3000`

### Development Tips

1. **Use Browser DevTools**: The interface is optimized for desktop development
2. **Check Network Tab**: Monitor API calls and responses
3. **Console Logs**: Both frontend and backend include detailed logging
4. **Hot Reload**: Save files to see changes instantly

## 📱 Mobile Development

While optimized for desktop, the interface includes basic mobile support:
- Responsive breakpoints
- Touch-friendly interactions
- Collapsible sidebar on mobile

## 🚀 Next Steps

Once you have the local environment running:

1. **Explore the Interface**: Upload test documents and navigate through the deal memo
2. **Customize Styling**: Modify colors and layouts in `client/src/app/globals.css`
3. **Add Real API Keys**: Replace mock keys with real OpenAI/Google Cloud credentials
4. **Test Integration**: Try the full document upload and analysis flow
5. **Deploy**: Follow `DEPLOYMENT.md` when ready for production

## 📖 Additional Resources

- **API Documentation**: See `server/API_IMPLEMENTATION_SUMMARY.md`
- **Component Library**: Explore `client/src/components/`
- **Design System**: Review `client/tailwind.config.js`
- **Integration Tests**: Check `server/tests/integration/`

Happy coding! 🎉