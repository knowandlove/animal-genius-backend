-- Migration: Update quiz_submissions table to use lookup tables
-- Date: January 2025
-- Purpose: Add foreign keys to animal_types and genius_types tables

-- First, check if the columns already exist
DO $$ 
BEGIN 
    -- Add animal_type_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quiz_submissions' 
        AND column_name = 'animal_type_id'
    ) THEN
        ALTER TABLE quiz_submissions 
        ADD COLUMN animal_type_id UUID REFERENCES animal_types(id);
    END IF;

    -- Add genius_type_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quiz_submissions' 
        AND column_name = 'genius_type_id'
    ) THEN
        ALTER TABLE quiz_submissions 
        ADD COLUMN genius_type_id UUID REFERENCES genius_types(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_animal_type_id ON quiz_submissions(animal_type_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_genius_type_id ON quiz_submissions(genius_type_id);

-- Note: The old string columns (animal_type, animal_genius) can remain for backward compatibility
-- New code will use the ID columns, old data can still be accessed via the string columns
