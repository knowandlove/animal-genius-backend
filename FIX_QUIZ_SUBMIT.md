# Fix Quiz Submit Edge Function

The quiz submission is failing because the Edge Function sends capitalized animal names (e.g., "Panda") but the database expects lowercase (e.g., "panda").

## The Fix

In `/supabase/functions/quiz-submit/index.ts`, line 190:

**Changed from:**
```typescript
calculated_animal: quizResults.animal,
```

**To:**
```typescript
calculated_animal: quizResults.animal.toLowerCase().replace(' ', '_'),
```

This ensures:
- "Panda" becomes "panda"
- "Border Collie" becomes "border_collie"

## How to Deploy

1. Go to your Supabase Dashboard
2. Navigate to Edge Functions
3. Find the `quiz-submit` function
4. Click "Edit"
5. Find line 190 and make the change above
6. Click "Deploy"

## Why This Works

The `animal_types` table uses lowercase codes:
- `panda`, `owl`, `meerkat`, etc.
- `border_collie` (not `Border Collie`)

But the quiz scoring returns capitalized names from the `animalMap`.