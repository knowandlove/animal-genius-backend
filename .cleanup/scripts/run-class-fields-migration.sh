#!/bin/bash

echo "🔧 Running migration to add class customization fields..."
echo ""

# Load environment variables
source .env

# Run the migration using psql
psql "$DATABASE_URL" -f migrations/add_class_customization_fields.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "Added fields: icon, background_color, number_of_students"
else
    echo "❌ Migration failed!"
    exit 1
fi
