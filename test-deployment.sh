#!/bin/bash

# Aegis Platform - Deployment Test Script

set -e

echo "🧪 Testing Aegis Platform Deployment"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get backend URL from user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Please provide your backend URL as an argument${NC}"
    echo "Usage: ./test-deployment.sh https://your-backend.vercel.app"
    exit 1
fi

BACKEND_URL=$1
API_URL="${BACKEND_URL}/api"

echo -e "${BLUE}Testing backend: ${API_URL}${NC}"
echo ""

# Test 1: Health Check
echo -e "${BLUE}🔍 Test 1: Health Check${NC}"
if curl -s "${API_URL}/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Trying to get more details..."
    curl -v "${API_URL}/health" || echo "Request failed completely"
fi

echo ""

# Test 2: Upload Endpoint
echo -e "${BLUE}🔍 Test 2: Upload Endpoint${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "${API_URL}/upload" \
    -H "Content-Type: application/json" \
    -d '{"test": true}' || echo "failed")

if echo "$UPLOAD_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Upload endpoint responding${NC}"
else
    echo -e "${RED}❌ Upload endpoint failed${NC}"
    echo "Response: $UPLOAD_RESPONSE"
fi

echo ""

# Test 3: Deal Memo Generation
echo -e "${BLUE}🔍 Test 3: Deal Memo Generation${NC}"
DEAL_MEMO_RESPONSE=$(curl -s -X POST "${API_URL}/deal-memo/generate" \
    -H "Content-Type: application/json" \
    -d '{"sessionId": "test-session", "documentIds": ["test-doc"]}' || echo "failed")

if echo "$DEAL_MEMO_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Deal memo generation responding${NC}"
else
    echo -e "${RED}❌ Deal memo generation failed${NC}"
    echo "Response: $DEAL_MEMO_RESPONSE"
fi

echo ""

# Test 4: Export Endpoint
echo -e "${BLUE}🔍 Test 4: Export Endpoint${NC}"
EXPORT_RESPONSE=$(curl -s -X POST "${API_URL}/export" \
    -H "Content-Type: application/json" \
    -d '{"dealMemoId": "test-memo", "format": "json"}' || echo "failed")

if echo "$EXPORT_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Export endpoint responding${NC}"
else
    echo -e "${RED}❌ Export endpoint failed${NC}"
    echo "Response: $EXPORT_RESPONSE"
fi

echo ""

# Test 5: CORS Headers
echo -e "${BLUE}🔍 Test 5: CORS Headers${NC}"
CORS_RESPONSE=$(curl -s -I -X OPTIONS "${API_URL}/health" | grep -i "access-control-allow-origin" || echo "")

if [ ! -z "$CORS_RESPONSE" ]; then
    echo -e "${GREEN}✅ CORS headers present${NC}"
else
    echo -e "${RED}❌ CORS headers missing${NC}"
fi

echo ""
echo -e "${BLUE}📋 Summary${NC}"
echo "=========="
echo "Backend URL: $BACKEND_URL"
echo "API URL: $API_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your frontend .env.local with: NEXT_PUBLIC_API_URL=$API_URL"
echo "2. Deploy your frontend to Vercel"
echo "3. Test the complete application"
echo ""
echo -e "${GREEN}🎉 Deployment test completed!${NC}"