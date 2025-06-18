-- Phase 1: Create the new students table
-- This is safe to run - it doesn't affect any existing functionality

-- Create the students table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id INTEGER REFERENCES public.classes(id),
    display_name TEXT NOT NULL,
    passport_code VARCHAR(8) NOT NULL UNIQUE,
    wallet_balance INTEGER NOT NULL DEFAULT 0,
    pending_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_passport_code ON public.students(passport_code);

-- Add student_id column to quiz_submissions (nullable for now)
ALTER TABLE public.quiz_submissions 
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id);

-- Index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student_id ON public.quiz_submissions(student_id);

-- This doesn't break anything! The app will continue working as before.
