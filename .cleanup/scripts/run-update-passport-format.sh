#!/bin/bash

# Load environment variables
source .env

# Run the migration
echo "Updating passport code format to XXX-XXX..."
psql "$DATABASE_URL" -f migrations/update-passport-code-format.sql

echo "Passport code format update complete!"
