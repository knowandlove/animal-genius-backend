#!/bin/bash

# Apply the missing profile columns migration
echo "Applying migration: 20250116_add_missing_profile_columns.sql"

# Read the migration file and apply it
psql "$DATABASE_URL" < supabase/migrations/20250116_add_missing_profile_columns.sql

echo "Migration applied successfully!"