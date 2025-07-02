-- Drop the unused passport_code column from students table
-- We're using funcode for the animal-based codes (e.g., MEE-X7K)

ALTER TABLE students DROP COLUMN IF EXISTS passport_code;
