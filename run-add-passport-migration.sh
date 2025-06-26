#!/bin/bash

# Load environment variables
source .env

# Run the migration
echo "Adding passport_code to students table..."
psql "$DATABASE_URL" -f migrations/add_passport_code_to_students.sql

echo "Migration complete!"
