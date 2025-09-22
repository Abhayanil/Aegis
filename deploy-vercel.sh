#!/bin/bash

# Aegis Platform - Vercel Deployment Script

set -e

echo "🚀 Aegis Platform - Vercel Deployment"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ Vercel CLI is not installed${NC}"
    echo "Please install it with: npm install -g vercel"
    exit 1
fi

echo -e "${GREEN}✅ Vercel CLI detected${NC}"

# Function to deploy backend
deploy_backend() {
    echo -e "\n${BLUE}📦 Deploying Backend (Serverless Functions)${NC}"
    echo "============================================="
    
    cd server
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ server/package.json not found${NC}"
        exit 1
    fi
    
    # Install dependencies
    echo "📥 Installing backend dependencies..."
    npm install
    
    # Deploy to Vercel
    echo "🚀 Deploying backend to Vercel..."
    vercel --prod --yes
    
    # Get deployment URL
    BACKEND_URL=$(vercel --prod --yes 2>/dev/null | grep -o 'https://[^[:space:]]*')
    
    if [ -z "$BACKEND_URL" ]; then
        echo -e "${YELLOW}⚠️  Could not automatically detect backend URL${NC}"
        echo "Please manually copy the backend URL from Vercel dashboard"
        read -p "Enter your backend URL: " BACKEND_URL
    fi
    
    echo -e "${GREEN}✅ Backend deployed successfully${NC}"
    echo -e "Backend URL: ${BLUE}$BACKEND_URL${NC}"
    
    cd ..
    return 0
}

# Function to deploy frontend
deploy_frontend() {
    echo -e "\n${BLUE}🌐 Deploying Frontend (Next.js)${NC}"
    echo "================================="
    
    cd client
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ client/package.json not found${NC}"
        exit 1
    fi
    
    # Update environment variables
    if [ ! -z "$BACKEND_URL" ]; then
        echo "🔧 Updating API configuration..."
        echo "NEXT_PUBLIC_API_URL=$BACKEND_URL/api" > .env.local
        echo -e "${GREEN}✅ API URL configured: $BACKEND_URL/api${NC}"
    fi
    
    # Install dependencies
    echo "📥 Installing frontend dependencies..."
    npm install
    
    # Build the project
    echo "🔨 Building frontend..."
    npm run build
    
    # Deploy to Vercel
    echo "🚀 Deploying frontend to Vercel..."
    vercel --prod --yes
    
    # Get deployment URL
    FRONTEND_URL=$(vercel --prod --yes 2>/dev/null | grep -o 'https://[^[:space:]]*')
    
    if [ -z "$FRONTEND_URL" ]; then
        echo -e "${YELLOW}⚠️  Could not automatically detect frontend URL${NC}"
        echo "Please check Vercel dashboard for the frontend URL"
    else
        echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
        echo -e "Frontend URL: ${BLUE}$FRONTEND_URL${NC}"
    fi
    
    cd ..
    return 0
}

# Function to run tests
run_tests() {
    echo -e "\n${BLUE}🧪 Running Tests${NC}"
    echo "================="
    
    if [ ! -z "$BACKEND_URL" ]; then
        echo "Testing backend endpoints..."
        
        # Test health endpoint (if exists)
        if curl -s "$BACKEND_URL/api/health" > /dev/null; then
            echo -e "${GREEN}✅ Backend health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend health check failed (this might be normal if no health endpoint)${NC}"
        fi
    fi
    
    if [ ! -z "$FRONTEND_URL" ]; then
        echo "Testing frontend..."
        
        # Test frontend accessibility
        if curl -s "$FRONTEND_URL" > /dev/null; then
            echo -e "${GREEN}✅ Frontend accessibility check passed${NC}"
        else
            echo -e "${RED}❌ Frontend accessibility check failed${NC}"
        fi
    fi
}

# Main deployment flow
main() {
    echo "Starting deployment process..."
    
    # Check if we're in the right directory
    if [ ! -d "client" ] || [ ! -d "server" ]; then
        echo -e "${RED}❌ Please run this script from the project root directory${NC}"
        echo "Expected structure:"
        echo "  project/"
        echo "  ├── client/"
        echo "  └── server/"
        exit 1
    fi
    
    # Ask user what to deploy
    echo -e "\n${YELLOW}What would you like to deploy?${NC}"
    echo "1) Backend only"
    echo "2) Frontend only"
    echo "3) Both (recommended)"
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            deploy_backend
            ;;
        2)
            if [ -z "$BACKEND_URL" ]; then
                read -p "Enter your backend URL: " BACKEND_URL
            fi
            deploy_frontend
            ;;
        3)
            deploy_backend
            deploy_frontend
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    # Run tests
    echo -e "\n${YELLOW}Would you like to run deployment tests? (y/n)${NC}"
    read -p "Run tests: " run_tests_choice
    
    if [ "$run_tests_choice" = "y" ] || [ "$run_tests_choice" = "Y" ]; then
        run_tests
    fi
    
    # Summary
    echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
    echo "========================"
    
    if [ ! -z "$BACKEND_URL" ]; then
        echo -e "Backend:  ${BLUE}$BACKEND_URL${NC}"
    fi
    
    if [ ! -z "$FRONTEND_URL" ]; then
        echo -e "Frontend: ${BLUE}$FRONTEND_URL${NC}"
    fi
    
    echo -e "\n${YELLOW}Next Steps:${NC}"
    echo "1. Test your application thoroughly"
    echo "2. Configure custom domain (optional)"
    echo "3. Set up monitoring and analytics"
    echo "4. Configure environment variables in Vercel dashboard"
    
    echo -e "\n${BLUE}Useful Commands:${NC}"
    echo "- View logs: vercel logs <deployment-url>"
    echo "- Redeploy: vercel --prod"
    echo "- Environment variables: vercel env"
}

# Run main function
main "$@"