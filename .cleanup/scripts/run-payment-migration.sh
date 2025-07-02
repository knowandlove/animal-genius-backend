#!/bin/bash

# Run the payment status enum migration

echo "🔄 Running payment status enum migration..."

# Load environment variables
source .env

# Run the migration using Supabase CLI or direct SQL
if command -v supabase &> /dev/null; then
    echo "Using Supabase CLI..."
    supabase db push --file migrations/add-payment-status-enum.sql
else
    echo "Using direct psql connection..."
    psql "$DATABASE_URL" -f migrations/add-payment-status-enum.sql
fi

echo "✅ Migration complete!"
echo ""
echo "📝 Next steps:"
echo "1. Test the payment flow with: npx tsx test-payment-flow.ts"
echo "2. Start the backend server"
echo "3. Start the frontend dev server"
echo "4. Test the mock payment flow in the UI"
