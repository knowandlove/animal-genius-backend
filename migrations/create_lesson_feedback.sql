-- Create lesson_feedback table
CREATE TABLE IF NOT EXISTS lesson_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id INTEGER NOT NULL,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate feedback
CREATE UNIQUE INDEX IF NOT EXISTS unique_teacher_lesson_feedback ON lesson_feedback(teacher_id, lesson_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_feedback_teacher ON lesson_feedback(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_feedback_lesson ON lesson_feedback(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_feedback_rating ON lesson_feedback(rating);

-- Add comment length check constraint
ALTER TABLE lesson_feedback ADD CONSTRAINT comment_length_check CHECK (
  comment IS NULL OR length(comment) <= 1000
);