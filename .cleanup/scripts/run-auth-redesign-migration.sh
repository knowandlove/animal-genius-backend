#!/bin/bash

# Script to run the new authentication system migration
# This will apply the schema changes for the redesigned auth system

echo "🚀 Running Authentication System Redesign Migration..."
echo "================================================"

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the animal-genius-backend directory"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please copy .env.example to .env and configure DATABASE_URL"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

echo "📋 Migration Details:"
echo "- Adding 'activations' table for payment tracking"
echo "- Adding 'classroom_sessions' table for temporary access"
echo "- Updating 'students' table with fun_code and avatar_id"
echo "- Updating 'classes' table with payment fields"
echo ""
echo "⚠️  This migration will:"
echo "- Add new tables and columns"
echo "- Create indexes for performance"
echo "- Add constraints for data integrity"
echo ""
echo "Press ENTER to continue or Ctrl+C to cancel..."
read

# Run the migration
echo "🏃 Running migration..."
psql "$DATABASE_URL" -f migrations/auth-redesign/001_new_auth_system.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Update the Drizzle schema.ts file to include new tables"
    echo "2. Create the funCode generator service"
    echo "3. Build the new authentication endpoints"
    echo "4. Remove old passport code logic (in a future migration)"
else
    echo "❌ Migration failed! Check the error messages above."
    exit 1
fi