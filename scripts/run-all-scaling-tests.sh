#!/bin/bash

# Run all scaling tests
# Make sure your server is running before executing this script

echo "🚀 Animal Genius Backend - Scaling Tests"
echo "========================================"
echo ""
echo "⚠️  Prerequisites:"
echo "1. Make sure your server is running (npm run dev)"
echo "2. Set required environment variables"
echo "3. Have a test class with students"
echo ""
echo "Press Enter to continue or Ctrl+C to cancel..."
read

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Connection Pool
echo -e "\n${GREEN}1. Testing Database Connection Pool${NC}"
echo "-----------------------------------"
if [ -f "test-connection-pool.js" ]; then
  node test-connection-pool.js
else
  echo -e "${RED}Error: test-connection-pool.js not found${NC}"
fi

echo -e "\n${YELLOW}Press Enter to continue to WebSocket test...${NC}"
read

# Test 2: WebSocket Limits
echo -e "\n${GREEN}2. Testing WebSocket Connection Limits${NC}"
echo "-------------------------------------"
if [ -f "test-websocket-limits.js" ]; then
  node test-websocket-limits.js
else
  echo -e "${RED}Error: test-websocket-limits.js not found${NC}"
fi

echo -e "\n${YELLOW}Press Enter to continue to analytics test...${NC}"
read

# Test 3: Class Analytics Performance
echo -e "\n${GREEN}3. Testing Class Analytics Performance${NC}"
echo "-------------------------------------"
echo "Set these environment variables first:"
echo "  export AUTH_TOKEN=your_teacher_jwt_token"
echo "  export CLASS_ID=your_class_id"
echo ""
echo "Have you set the variables? (y/n)"
read answer
if [ "$answer" = "y" ]; then
  if [ -f "test-class-analytics.js" ]; then
    node test-class-analytics.js
  else
    echo -e "${RED}Error: test-class-analytics.js not found${NC}"
  fi
else
  echo "Skipping analytics test..."
fi

echo -e "\n${YELLOW}Press Enter to continue to cache test...${NC}"
read

# Test 4: Dashboard Cache
echo -e "\n${GREEN}4. Testing Student Dashboard Cache${NC}"
echo "---------------------------------"
echo "Set this environment variable first:"
echo "  export STUDENT_TOKEN=your_student_session_token"
echo ""
echo "Have you set the variable? (y/n)"
read answer
if [ "$answer" = "y" ]; then
  if [ -f "test-dashboard-cache.js" ]; then
    node test-dashboard-cache.js
  else
    echo -e "${RED}Error: test-dashboard-cache.js not found${NC}"
  fi
else
  echo "Skipping cache test..."
fi

# Summary
echo -e "\n${GREEN}✅ All tests completed!${NC}"
echo "======================="
echo ""
echo "📊 Summary of improvements:"
echo "- Database pool: 25 → 50 connections"
echo "- WebSocket limits: 500 total, 10 per IP"
echo "- Class analytics: Optimized query (should be <500ms)"
echo "- Dashboard caching: 5-minute TTL"
echo ""
echo "🔍 Next steps:"
echo "1. Monitor /api/admin/quick-stats for performance metrics"
echo "2. Check /api/admin/errors/summary for any errors"
echo "3. Watch Supabase dashboard for connection usage"
echo ""