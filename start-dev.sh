#!/bin/bash
# Development startup script with SSL disabled and in-memory cache

echo "🚀 Starting backend in development mode..."
echo "   - SSL validation disabled (for self-signed certificates)"
echo "   - Using in-memory cache (no Redis required)"
echo ""

export CACHE_TYPE=node
export NODE_TLS_REJECT_UNAUTHORIZED=0

npm run dev