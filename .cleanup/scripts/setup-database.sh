#!/bin/bash

echo "🔧 Setting up Animal Genius Database"
echo "===================================="
echo ""

# Check if we have required environment variables
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with your database credentials"
    exit 1
fi

# Source the .env file
export $(grep -v '^#' .env | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env file!"
    exit 1
fi

echo "📊 Database URL found"
echo ""

# Try different migration approaches
echo "1. Attempting to push schema with Drizzle..."
npm run db:push

if [ $? -eq 0 ]; then
    echo "✅ Schema pushed successfully!"
else
    echo "⚠️  Schema push failed, trying generate & migrate..."
    
    # Try generate and migrate
    npm run db:generate
    npm run db:migrate
    
    if [ $? -eq 0 ]; then
        echo "✅ Migrations completed successfully!"
    else
        echo "❌ Migration failed. Please check your database connection."
        echo ""
        echo "Common issues:"
        echo "1. Check if your Supabase project is running"
        echo "2. Verify DATABASE_URL is correct"
        echo "3. Make sure you have the correct password"
        exit 1
    fi
fi

echo ""
echo "2. Running payment status migration..."
if [ -f "migrations/add-payment-status-enum.sql" ]; then
    npm run db:migrate -- migrations/add-payment-status-enum.sql
    echo "✅ Payment migration completed"
else
    echo "⚠️  Payment migration file not found"
fi

echo ""
echo "3. Starting backend server..."
npm run dev
