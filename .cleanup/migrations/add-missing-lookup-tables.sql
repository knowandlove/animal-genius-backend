-- Add genius_types lookup table
CREATE TABLE IF NOT EXISTS genius_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add quiz_answer_types lookup table
CREATE TABLE IF NOT EXISTS quiz_answer_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update students table to use genius_type_id
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS genius_type_id UUID REFERENCES genius_types(id);

-- Update quiz_submissions table to use genius_type_id
ALTER TABLE quiz_submissions 
ADD COLUMN IF NOT EXISTS genius_type_id UUID REFERENCES genius_types(id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_students_genius_type ON students(genius_type_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_genius_type ON quiz_submissions(genius_type_id);
