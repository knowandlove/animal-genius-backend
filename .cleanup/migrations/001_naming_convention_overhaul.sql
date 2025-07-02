-- Naming Convention Overhaul Migration
-- Phase 1 Day 1-2: Fix all naming inconsistencies
-- Created: January 2025

-- CRITICAL: Rename passport_code to class_code in classes table
ALTER TABLE classes RENAME COLUMN passport_code TO class_code;

-- Fix students table: rename animalGenius to match our standard
ALTER TABLE students RENAME COLUMN animal_genius TO genius_type;

-- Create indexes with new column names
DROP INDEX IF EXISTS idx_classes_passport_code;
CREATE INDEX idx_classes_class_code ON classes(class_code);

-- Verify the changes
DO $$
BEGIN
    -- Check if class_code column exists in classes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'classes' AND column_name = 'class_code') THEN
        RAISE EXCEPTION 'Migration failed: class_code column not found in classes table';
    END IF;
    
    -- Check if genius_type column exists in students  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'students' AND column_name = 'genius_type') THEN
        RAISE EXCEPTION 'Migration failed: genius_type column not found in students table';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;