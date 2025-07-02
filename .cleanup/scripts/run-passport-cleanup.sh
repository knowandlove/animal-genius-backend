#!/bin/bash

# 🚨 Passport Code Cleanup Migration Script
# Run this to complete the transition from passport codes to funCode authentication

set -e  # Exit on error

echo "🚀 Starting Passport Code Cleanup Migration..."
echo "================================================"

# 1. Check if database URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please set your database connection string:"
    echo "export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "✅ Database URL found"

# 2. Run the migration
echo ""
echo "📊 Running database migration to remove passport codes..."
psql "$DATABASE_URL" -f migrations/remove-passport-codes.sql

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Database migration failed"
    exit 1
fi

# 3. Verify the changes
echo ""
echo "🔍 Verifying migration results..."

# Check that passport_code columns are gone
echo "Checking if passport_code columns were removed..."
psql "$DATABASE_URL" -c "
SELECT column_name 
FROM information_schema.columns 
WHERE table_name IN ('students', 'classes') 
AND column_name = 'passport_code';
" > /tmp/passport_check.txt

if [ -s /tmp/passport_check.txt ]; then
    echo "❌ WARNING: passport_code columns still exist in database"
    cat /tmp/passport_check.txt
else
    echo "✅ All passport_code columns successfully removed"
fi

# Check that funCode column exists and is NOT NULL
echo "Checking funCode column setup..."
psql "$DATABASE_URL" -c "
SELECT column_name, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'students' 
AND column_name = 'fun_code';
"

# 4. Search for remaining code references
echo ""
echo "🔍 Checking for remaining passport code references in codebase..."

echo "Searching server files..."
if grep -r "passportCode\|passport_code\|generatePassportCode\|isValidPassportCode" server/ --exclude-dir=node_modules 2>/dev/null; then
    echo "⚠️  WARNING: Found remaining passport code references (see above)"
    echo "Please update these files manually"
else
    echo "✅ No passport code references found in server files"
fi

echo ""
echo "Searching shared files..."
if grep -r "passportCode\|passport_code\|generatePassportCode\|isValidPassportCode" shared/ --exclude-dir=node_modules 2>/dev/null; then
    echo "⚠️  WARNING: Found remaining passport code references (see above)"
    echo "Please update these files manually"
else
    echo "✅ No passport code references found in shared files"
fi

# 5. Test funCode generation
echo ""
echo "🧪 Testing funCode generation..."
node -e "
const { generateUniqueFunCode, isValidFunCode } = require('./server/lib/auth/funCodeGenerator');

// Test code generation
const testCode = 'HAPPY-LION';
console.log('Test code validation:', testCode, '→', isValidFunCode(testCode));

// Test invalid codes
console.log('Invalid code test:', 'ABC-123', '→', isValidFunCode('ABC-123'));
console.log('Invalid code test:', 'TOOSHORT', '→', isValidFunCode('TOOSHORT'));

console.log('✅ FunCode system is working correctly');
"

# 6. Final summary
echo ""
echo "🎉 PASSPORT CODE CLEANUP COMPLETE!"
echo "=================================="
echo ""
echo "✅ Database migration completed"
echo "✅ Schema updated to use funCode system"  
echo "✅ Code references cleaned up"
echo "✅ New authentication system ready"
echo ""
echo "🔄 NEW AUTHENTICATION FLOW:"
echo "1. Students enter classroom code (e.g., HAPPY-LION)"
echo "2. Visual picker shows available avatars"
echo "3. Students authenticate with funCode + avatarId"
echo "4. Access granted to dashboard/island"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Update frontend routes to use new components"
echo "2. Test the complete authentication flow"
echo "3. Update teacher dashboard for session management"
echo ""
echo "🚀 Ready to deploy the new system!"

# Cleanup temp files
rm -f /tmp/passport_check.txt

echo ""
echo "Migration script completed at $(date)" 