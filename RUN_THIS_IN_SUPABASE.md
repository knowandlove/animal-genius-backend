# Instructions to Apply the Migration

Since there's a migration sync issue, let's apply this directly in Supabase:

## Step 1: Clear Test Data (if you have any)
Go to Supabase Dashboard > SQL Editor and run:

```sql
-- Clear test data
DELETE FROM students;
DELETE FROM classes;
```

## Step 2: Apply the Migration
Then run the contents of this file in the SQL Editor:
`supabase/migrations/20250111_anonymous_auth_final.sql`

## Step 3: Verify
After running, check:
1. Classes table has new columns: `seat_limit`, `expires_at`, `is_active`
2. Students table has new columns: `user_id`, `school_year`, `quiz_score`
3. Profiles table has new column: `is_anonymous`

## Step 4: Update Edge Functions
The Edge Functions are already updated to use `class_code` (not `code`).
Just redeploy them:

```bash
npx supabase functions deploy quiz-check-eligibility
npx supabase functions deploy quiz-submit
npx supabase functions deploy student-login
```

## That's it!
Your system will now:
- Create students with Supabase auth when they complete quiz
- Use passport codes for login
- Support seat limits and class expiration
- Work with your existing `class_code` format (LT0-33B)