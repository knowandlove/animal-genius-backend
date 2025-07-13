# Implementation Plan: Anonymous Auth System

## Overview

We're building an anonymous authentication system where:
1. Students complete a quiz → get created with Supabase auth user + dummy email
2. They receive a passport code (XXX-XXX) as their only credential
3. They can login with just this passport code

## Current Situation

### What's Working:
- Your backend uses `class_code` everywhere (format: LT0-33B)
- Existing auth works for teachers
- Database schema is defined in Drizzle ORM

### What's Confused:
- Multiple conflicting migrations exist (but haven't run yet)
- Code expects `isActive` but schema has `isArchived`
- New features need to be added properly

## Step-by-Step Fix Plan

### Step 1: Clean Up Migrations (DO THIS FIRST!)

```bash
# 1. Delete all the conflicting migrations
rm supabase/migrations/20250111_anonymous_auth_setup.sql
rm supabase/migrations/20250111_fix_class_codes.sql
rm supabase/migrations/20250111_fix_to_use_class_code.sql
rm supabase/migrations/20250111_add_school_year.sql
rm supabase/migrations/20250111_update_rls_policies.sql

# 2. Keep your database clean - no partial migrations
```

### Step 2: Update Drizzle Schema

We need to add these columns to your schema first:

#### For Classes:
- `seatLimit` - maximum students allowed
- `expiresAt` - when class expires
- `isActive` - whether class accepts new students

#### For Students:
- `userId` - links to Supabase auth.users
- `schoolYear` - for yearly cleanup

#### For Profiles:
- `isAnonymous` - marks dummy student accounts

### Step 3: Generate Clean Migration

After updating schema, we'll use Drizzle to generate proper migrations that:
1. Add the new columns
2. Create the quiz submission function
3. Set up proper indexes

### Step 4: Implement Auth Flow

1. **Quiz Completion** (Edge Function):
   - Validate class exists and is active
   - Check seat limits
   - Create Supabase user with dummy email
   - Create student record
   - Return passport code

2. **Student Login** (Edge Function):
   - Accept passport code
   - Validate it exists
   - Create session token
   - Return JWT for API access

### Step 5: Update Backend Routes

Your existing routes will work with minimal changes:
- They already use passport codes
- Just need to handle the new JWT tokens

## Why This Approach?

1. **Schema First**: Update Drizzle schema so TypeScript knows about all columns
2. **Clean Migrations**: No conflicts or confusion
3. **Atomic Operations**: Students created in one transaction
4. **Backward Compatible**: Existing code continues to work

## Next Actions

1. Should I clean up the conflicting migrations?
2. Should I update your Drizzle schema with the new columns?
3. Should I create the proper migration file?

This will give you:
- ✅ Anonymous student auth with Supabase
- ✅ Seat limits and expiration for classes
- ✅ Clean, maintainable code
- ✅ No breaking changes