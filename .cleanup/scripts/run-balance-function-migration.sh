#!/bin/bash

# Run the get_student_balance function migration

echo "Running get_student_balance function migration..."

cd /Users/jasonlackey/Desktop/KALPRO/animal-genius-backend

# Run the migration using the database URL from .env
source .env

psql "$DATABASE_URL" -f migrations/create-get-student-balance-function.sql

echo "Migration complete!"
