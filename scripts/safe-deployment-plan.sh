#!/bin/bash
# Safe migration script that preserves all existing data

echo "🛡️ SAFE COMMUNITY HUB DEPLOYMENT PLAN"
echo "===================================="
echo ""
echo "CURRENT SITUATION:"
echo "- Community Hub tables ALREADY EXIST in database with data"
echo "- Several legacy tables exist that aren't in schema files"
echo "- Drizzle wants to drop these tables (DON'T LET IT!)"
echo ""
echo "STEP 1: Update your schema file"
echo "-------------------------------"
echo "Add the missing table definitions to your schema.ts file."
echo "I've created a file with these definitions at:"
echo "  ./shared/missing-tables-schema.ts"
echo ""
echo "Copy the contents of that file and add them to:"
echo "  ./shared/schema.ts"
echo ""
echo "STEP 2: Create a snapshot migration"
echo "-----------------------------------"
echo "Instead of using db:push, we'll create a manual migration:"
echo ""
cat > safe-migration.sql << 'EOF'
-- Safe Community Hub Deployment Migration
-- This migration does NOT drop any tables
-- It only ensures required tables exist

-- The Community Hub tables already exist, so we just need to ensure
-- they have the correct structure using IF NOT EXISTS

-- No action needed for existing Community Hub tables:
-- ✓ discussions (3 rows)
-- ✓ tags (75 rows)  
-- ✓ replies (0 rows)
-- ✓ interactions (0 rows)
-- ✓ discussion_tags (0 rows)

-- Add any missing columns to profiles table if needed
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false NOT NULL;

-- Add any missing columns to lesson_progress if needed  
ALTER TABLE lesson_progress
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'not_started' NOT NULL;

-- Ensure all required indexes exist
CREATE INDEX IF NOT EXISTS idx_discussions_teacher_id ON discussions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_discussions_category ON discussions(category);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at);
CREATE INDEX IF NOT EXISTS idx_discussions_status ON discussions(status);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);

CREATE INDEX IF NOT EXISTS idx_discussion_tags_discussion ON discussion_tags(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_tags_tag ON discussion_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_replies_discussion ON replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_replies_parent ON replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_replies_teacher ON replies(teacher_id);

CREATE INDEX IF NOT EXISTS idx_interactions_teacher_discussion ON interactions(teacher_id, discussion_id);
CREATE INDEX IF NOT EXISTS idx_interactions_teacher_reply ON interactions(teacher_id, reply_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);

-- Record this as complete
INSERT INTO __drizzle_migrations (hash, created_at) 
VALUES ('community_hub_safe_deploy_' || NOW()::text, NOW())
ON CONFLICT DO NOTHING;
EOF

echo ""
echo "STEP 3: Apply the safe migration"
echo "--------------------------------"
echo "1. Review the safe-migration.sql file"
echo "2. Run it in Supabase SQL Editor"
echo "3. Your Community Hub is ready to deploy!"
echo ""
echo "STEP 4: Update Drizzle config"
echo "-----------------------------"
echo "Add this to your package.json scripts:"
echo '  "db:pull": "drizzle-kit introspect:pg"'
echo ""
echo "Then run: npm run db:pull"
echo "This will sync your schema with the actual database"
echo ""
echo "✅ RESULT: Community Hub deployed without data loss!"