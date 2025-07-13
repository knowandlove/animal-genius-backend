# URGENT: Schema Fixes Required

## Current State Analysis (July 11, 2025)

### 🚨 CRITICAL ISSUES FOUND:

1. **Schema Mismatch**:
   - Backend code expects `isActive` but schema defines `isArchived` 
   - Migrations add columns (`is_active`, `seat_limit`, `expires_at`, `code`) not in Drizzle schema
   - This causes TypeScript to not know about these columns = runtime errors!

2. **Dangerous Migrations**:
   - `20250111_clean_start_classes.sql` - DELETES ALL DATA (moved to dangerous-migrations/)
   - Multiple conflicting migrations about `code` vs `class_code`

3. **Good News**:
   - These migrations haven't run on remote yet (only local)
   - Your existing system correctly uses `class_code` everywhere
   - We can fix this without breaking anything

## RECOMMENDED FIX PLAN:

### Option 1: Clean Slate (If you have no important data)
1. Delete all the 20250111_*.sql migrations
2. Create one clean migration that adds only what's needed
3. Keep using `class_code` (don't add `code`)

### Option 2: Fix Existing Schema (If you need to preserve data)
1. Update Drizzle schema to match what you actually need
2. Fix the `isActive` vs `isArchived` confusion
3. Create proper migrations from the schema

## What columns do you ACTUALLY need?

Current schema has:
- `class_code` (for class codes like "LT0-33B") ✅
- `isArchived` (to hide old classes) ✅

Migrations try to add:
- `code` - NOT NEEDED, you have class_code
- `is_active` - Conflicts with isArchived
- `seat_limit` - Could be useful?
- `expires_at` - Could be useful?
- `school_year` - Could be useful?

## IMMEDIATE ACTIONS:
1. DO NOT run `supabase db push` until we fix this
2. Decide which columns you actually want
3. Let's create ONE clean migration that does it right