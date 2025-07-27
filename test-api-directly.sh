#!/bin/bash

# Test the discussion API endpoint directly
DISCUSSION_ID="8af34da8-a548-4929-9b0e-2dafc4155a07"
API_URL="http://localhost:5001/api/community/discussions/$DISCUSSION_ID"

echo "Testing discussion API endpoint..."
echo "URL: $API_URL"
echo ""

# Make the request without auth (will need to add token if required)
curl -X GET "$API_URL" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.replies | length' || echo "Failed to get response"

echo ""
echo "Full response:"
curl -X GET "$API_URL" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.' || echo "Failed to get response"