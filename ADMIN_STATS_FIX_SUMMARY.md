# Admin Stats Fix Summary

## Issue Identified
The admin dashboard was showing 42 teachers when there should only be 1. This was because:

1. **Anonymous student profiles were being counted as teachers**
   - When students take a quiz, the system creates anonymous auth users and profiles
   - These anonymous profiles have `is_anonymous = true` in the database
   - The `getAdminStats()` function was counting ALL profiles as teachers

## Changes Made

### 1. Updated Database Schema (`/shared/schema.ts`)
- Added `isAnonymous: boolean('is_anonymous').default(false).notNull()` to the profiles table definition
- Added missing fields: `phoneNumber` and `avatarUrl`

### 2. Fixed Admin Stats Function (`/server/storage-uuid.ts`)
- Updated `getAdminStats()` to only count non-anonymous profiles:
  ```typescript
  const [teacherCount] = await db
    .select({ count: count() })
    .from(profiles)
    .where(eq(profiles.isAnonymous, false));
  ```
- Also fixed the recent signups count to exclude anonymous profiles

### 3. Fixed Get All Profiles Function (`/server/storage-uuid.ts`)
- Updated `getAllProfiles()` to filter out anonymous profiles:
  ```typescript
  .where(eq(profiles.isAnonymous, false))
  ```
- This ensures the admin teachers list only shows actual teachers

### 4. Created Migration (`/supabase/migrations/20250116_add_missing_profile_columns.sql`)
- Adds missing columns if they don't exist: `phone_number`, `avatar_url`
- Creates index on `is_anonymous` for performance

### 5. Created Verification Script (`/scripts/verify-anonymous-profiles.sql`)
- Helps verify the data integrity
- Can fix any profiles with incorrect `is_anonymous` flags

## Next Steps

1. **Run the migration** to add missing columns:
   ```bash
   npm run db:migrate
   ```

2. **Verify the data** using the verification script:
   ```bash
   psql $DATABASE_URL -f scripts/verify-anonymous-profiles.sql
   ```

3. **If needed, fix incorrect flags** by uncommenting the UPDATE statements in the verification script

4. **Test the admin dashboard** - it should now show the correct count of teachers (only non-anonymous profiles)

## Expected Results
- Admin stats should show only 1 teacher (your account)
- The teachers list should only display actual teacher accounts
- Anonymous student profiles will no longer be counted or displayed in admin areas