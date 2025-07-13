-- Clean up unused functions from debugging process

-- Drop the old atomic function that tried to insert into auth.users directly
DROP FUNCTION IF EXISTS public.submit_quiz_atomic(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.submit_quiz_atomic(TEXT, TEXT, TEXT, TEXT, JSONB, UUID);