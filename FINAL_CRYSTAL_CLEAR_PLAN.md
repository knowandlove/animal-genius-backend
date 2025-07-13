# FINAL IMPLEMENTATION - CRYSTAL CLEAR

## What We're Building

### Anonymous Student Auth System:
1. Student takes quiz at `/quiz/LT0-33B` (using existing class_code)
2. After quiz completion → We create:
   - Supabase auth user with dummy email: `student-UUID@animalgenius.local`
   - Student record linked to that auth user
   - Passport code: `OWL-X9Y` (their only credential)
3. Student logs in with JUST the passport code
4. They get a JWT token to access the app

## What Will NOT Change (No Breaking):
- ✅ Keep using `class_code` field (format: LT0-33B)
- ✅ All existing backend routes continue working
- ✅ Teacher auth stays exactly the same
- ✅ Passport codes work the same way

## What We're Adding (New Features):
1. **For Classes table:**
   - `seat_limit` - max students (nullable = unlimited)
   - `expires_at` - class expiration (nullable = never expires)
   - `is_active` - whether accepting new students (default true)

2. **For Students table:**
   - `user_id` - links to Supabase auth.users
   - `school_year` - for yearly cleanup

3. **For Profiles table:**
   - `is_anonymous` - flag for student accounts

## Implementation Steps:

### 1. Clean Slate (Since you're OK clearing classes)
```bash
# Delete ALL conflicting migrations
rm supabase/migrations/20250111_*.sql

# Clear existing data
DELETE FROM students;
DELETE FROM classes;
```

### 2. Update Drizzle Schema First
Add the new columns to `shared/schema.ts` so TypeScript knows about them

### 3. Create ONE Clean Migration
This migration will:
- Add the new columns
- Create the atomic quiz submission function
- Keep using `class_code` (NOT adding a `code` column)

### 4. Edge Functions Will:
- Check eligibility: `quiz-check-eligibility` 
  - Uses `class_code` to find class
  - Checks `is_active`, `expires_at`, `seat_limit`
  
- Submit quiz: `quiz-submit`
  - Creates Supabase user + student in one transaction
  - Returns passport code
  
- Student login: `student-login`
  - Takes passport code
  - Returns JWT token

## Critical Points:
1. **NO NEW `code` COLUMN** - We use existing `class_code`
2. **Backend routes don't break** - They already expect `class_code`
3. **Fix the isActive check** - Add `is_active` column so code works
4. **Atomic creation** - Student + auth user created together

## The Result:
- Students created AFTER quiz (not before)
- Supabase manages auth (more secure)
- Rate limiting protects endpoints
- All existing code continues working
- You get seat limits + expiration features

## Ready to proceed?
1. Delete conflicting migrations ✓
2. Update Drizzle schema ✓
3. Generate clean migration ✓
4. Deploy and test ✓