#!/bin/bash

# Test Supabase auth with curl
SUPABASE_URL="https://zqyvfnbwpagguutzdvpy.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeXZmbmJ3cGFnZ3V1dHpkdnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMDg5NzksImV4cCI6MjA2NTc4NDk3OX0.MUvI3pgXafK9vxOUW7hKPZDvRGpAY0CyA-EwBsahFjc"

echo "Testing Supabase auth endpoint with curl..."
echo "URL: $SUPABASE_URL"
echo "Key: ${ANON_KEY:0:30}..."
echo ""

curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jason@knowandlove.com",
    "password": "password123"
  }' \
  -v

echo ""
echo ""
echo "Testing health check..."
curl "$SUPABASE_URL/auth/v1/health" \
  -H "apikey: $ANON_KEY" \
  -v
