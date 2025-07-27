#!/bin/bash

# Simple test script for community endpoints
# You need to replace AUTH_TOKEN with a valid teacher auth token

AUTH_TOKEN="YOUR_AUTH_TOKEN_HERE"
BASE_URL="http://localhost:5001"

echo "Testing Community Endpoints..."
echo "=============================="
echo ""

# Test 1: Get discussions
echo "1. Testing GET /api/community/discussions"
curl -s -H "Authorization: Bearer $AUTH_TOKEN" \
  "$BASE_URL/api/community/discussions" | jq '.discussions | length' || echo "Failed"

echo ""
echo "To use this script:"
echo "1. Get your auth token from browser console: localStorage.getItem('authToken')"
echo "2. Replace YOUR_AUTH_TOKEN_HERE with your actual token"
echo "3. Run: bash test-community-simple.sh"