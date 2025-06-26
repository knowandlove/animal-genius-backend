#!/bin/bash

# Load environment variables
source .env

# Run the migration
echo "Fixing get_student_balance function ambiguity..."
psql "$DATABASE_URL" -f migrations/fix-get-student-balance-ambiguity.sql

echo "Function fix complete!"
