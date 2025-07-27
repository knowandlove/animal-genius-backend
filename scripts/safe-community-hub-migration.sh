#!/bin/bash
# Safe migration script for Community Hub deployment

echo "🔍 Step 1: Backing up current schema..."
# First, let's pull the current database schema
cd /Users/jasonlackey/Desktop/KALPRO/animal-genius-backend

# Create a backup of the current migrations folder
cp -r migrations migrations_backup_$(date +%Y%m%d_%H%M%S)

echo "🔍 Step 2: Pulling current database schema..."
# Use drizzle-kit introspect to understand what's in the database
npm run drizzle-kit introspect:pg

echo "🔍 Step 3: Generating safe migration..."
# Generate a migration that will only add missing tables
npm run drizzle-kit generate:pg

echo "📋 Step 4: Review the generated migration"
echo "Please review the generated migration file before proceeding!"
echo "Look for the latest file in ./migrations/"

echo ""
echo "⚠️  IMPORTANT: Before running the migration:"
echo "1. Check the latest migration file in ./migrations/"
echo "2. Remove any DROP TABLE statements"
echo "3. Keep only CREATE TABLE statements for Community Hub tables"
echo "4. Save the edited migration"
echo "5. Run: npm run db:push"