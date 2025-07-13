-- Migration: Add Class Values fields to classes table
-- Created: 2025-07-13
-- Description: Add has_values_set and values_set_at columns for Class Values feature

-- Add the missing columns to the classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS has_values_set BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS values_set_at TIMESTAMP WITH TIME ZONE;

-- Update any existing classes that might have already gone through values voting
-- (Check if they have results in class_values_results)
UPDATE classes 
SET has_values_set = TRUE, 
    values_set_at = COALESCE(
        (SELECT MIN(created_at) FROM class_values_results WHERE class_id = classes.id),
        NOW()
    )
WHERE id IN (
    SELECT DISTINCT class_id 
    FROM class_values_results 
    WHERE is_winner = TRUE
);