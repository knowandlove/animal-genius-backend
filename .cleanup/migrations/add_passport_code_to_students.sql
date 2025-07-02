-- Add passport_code column to students table
ALTER TABLE students 
ADD COLUMN passport_code varchar(20) UNIQUE;

-- Generate passport codes for existing students
UPDATE students 
SET passport_code = generate_passport_code()
WHERE passport_code IS NULL;

-- Make the column NOT NULL after populating existing rows
ALTER TABLE students 
ALTER COLUMN passport_code SET NOT NULL;

-- Add index for faster lookups
CREATE INDEX idx_students_passport_code ON students(passport_code);
