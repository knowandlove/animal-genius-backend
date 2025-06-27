-- Add icon, backgroundColor, and numberOfStudents columns to classes table
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'book',
ADD COLUMN IF NOT EXISTS background_color VARCHAR(7) DEFAULT '#829B79',
ADD COLUMN IF NOT EXISTS number_of_students INTEGER;
