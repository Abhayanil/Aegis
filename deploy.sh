#!/bin/bash

# Aegis Deployment Script
# This script helps deploy the Aegis platform to Vercel (frontend) and Railway (backend)

set -e

echo "🚀 Aegis Deployment Script"
echo "=========================="

# Check if required tools are installed
check_dependencies() {
    echo "📋 Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm first."
        exit 1
    fi
    
    echo "✅ Dependencies check passed"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    echo "Installing backend dependencies..."
    cd server && npm install
    
    echo "Installing frontend dependencies..."
    cd ../client && npm install
    
    cd ..
    echo "✅ Dependencies installed"
}

# Build and test locally
build_and_test() {
    echo "🔨 Building and testing..."
    
    echo "Building backend..."
    cd server && npm run build
    
    echo "Type checking frontend..."
    cd ../client && npm run type-check
    
    cd ..
    echo "✅ Build completed successfully"
}

# Deploy to Vercel (frontend)
deploy_frontend() {
    echo "🌐 Deploying frontend to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        echo "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    cd client
    
    echo "Please make sure you have:"
    echo "1. Set NEXT_PUBLIC_API_URL in Vercel dashboard"
    echo "2. Set NEXT_PUBLIC_APP_ENV=production in Vercel dashboard"
    echo ""
    read -p "Press Enter to continue with Vercel deployment..."
    
    vercel --prod
    
    cd ..
    echo "✅ Frontend deployed to Vercel"
}

# Instructions for backend deployment
backend_instructions() {
    echo "🖥️  Backend Deployment Instructions"
    echo "=================================="
    echo ""
    echo "To deploy your backend, choose one of these options:"
    echo ""
    echo "Option 1: Railway (Recommended)"
    echo "1. Go to https://railway.app"
    echo "2. Connect your GitHub repository"
    echo "3. Select the 'server' directory as root"
    echo "4. Set these environment variables:"
    echo "   - NODE_ENV=production"
    echo "   - PORT=3001"
    echo "   - CORS_ORIGIN=https://your-vercel-domain.vercel.app"
    echo "   - GOOGLE_CLOUD_PROJECT=your-project-id"
    echo "   - OPENAI_API_KEY=your-openai-key"
    echo "   - GEMINI_API_KEY=your-gemini-key"
    echo ""
    echo "Option 2: Render"
    echo "1. Go to https://render.com"
    echo "2. Create new Web Service from GitHub"
    echo "3. Set build command: npm run build"
    echo "4. Set start command: npm start"
    echo "5. Add the same environment variables as above"
    echo ""
    echo "Option 3: Google Cloud Run"
    echo "1. Make sure you have gcloud CLI installed"
    echo "2. Run: cd server && gcloud run deploy"
    echo ""
    echo "After backend deployment:"
    echo "1. Update NEXT_PUBLIC_API_URL in Vercel with your backend URL"
    echo "2. Update ALLOWED_ORIGINS in your backend with your Vercel URL"
}

# Main deployment flow
main() {
    echo "What would you like to do?"
    echo "1. Full setup (install deps + build + deploy frontend)"
    echo "2. Install dependencies only"
    echo "3. Build and test only"
    echo "4. Deploy frontend only"
    echo "5. Show backend deployment instructions"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            check_dependencies
            install_dependencies
            build_and_test
            deploy_frontend
            backend_instructions
            ;;
        2)
            check_dependencies
            install_dependencies
            ;;
        3)
            build_and_test
            ;;
        4)
            deploy_frontend
            ;;
        5)
            backend_instructions
            ;;
        *)
            echo "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 Deployment process completed!"
    echo "📖 For detailed instructions, see DEPLOYMENT.md"
}

# Run main function
main