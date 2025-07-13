# Removing quiz_score Column - Safe Steps

## What We're Doing
Removing the `quiz_score` column that was incorrectly added to the personality quiz system. This is a personality quiz that calculates MBTI types and animal assignments - it has NO numeric scores.

## Step 1: Check for Existing Data (DO THIS FIRST!)
Run this SQL in Supabase SQL Editor:
```sql
-- Check if there's any data in the quiz_score column
SELECT COUNT(*) as count_with_score FROM students WHERE quiz_score IS NOT NULL;

-- If there is data, show a sample
SELECT id, student_name, quiz_score, created_at 
FROM students 
WHERE quiz_score IS NOT NULL 
LIMIT 10;
```

If there's any data, confirm it's safe to delete before proceeding.

## Step 2: Apply Phase 1 Migration (Stop Writing)
Run the migration in `/supabase/migrations/20250112_phase1_stop_quiz_score_writes.sql` in Supabase SQL Editor.

This updates the `submit_quiz_atomic` function to stop trying to write to quiz_score.

## Step 3: Deploy Code Changes
The following code changes have been made:
1. ✅ Backend: `/server/routes/student-passport-api.ts` - Removed quiz_score from SELECT query
2. ✅ Frontend: `/src/components/StudentDashboard.tsx` - Removed score display
3. ✅ Schema: `/shared/schema.ts` - Removed quizScore field

Deploy these changes to your application.

## Step 4: Test Everything Works
After deploying:
1. Try taking a quiz as a new student
2. Check that existing students can still login
3. Verify the student dashboard loads without errors

## Step 5: Drop the Column (Final Step)
Once everything is working without quiz_score, run this migration:

```sql
-- Final migration to drop the quiz_score column
ALTER TABLE students DROP COLUMN quiz_score;
```

## What Changed
- **submit_quiz_atomic** function no longer tries to insert quiz_score
- **student-passport API** no longer queries quiz_score
- **Frontend** no longer displays a score (just shows animal type and completion date)
- **Schema** definition updated to match database

## Why This Was Needed
The quiz_score column was added by mistake. This is a personality quiz that:
- Calculates MBTI type (INFP, ESTJ, etc.)
- Maps to animal types (Meerkat, Panda, Owl, etc.)
- Determines learning styles
- Has NO numeric scoring

The column was causing errors when submitting quizzes because the code was looking for a 'score' field that doesn't exist in personality quiz answers.