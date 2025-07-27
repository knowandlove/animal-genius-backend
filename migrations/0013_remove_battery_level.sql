-- Remove battery_level column from discussions table
ALTER TABLE discussions 
DROP COLUMN IF EXISTS battery_level;

-- Remove energy_level tag category
DELETE FROM tags WHERE category = 'energy_level';

-- Update tag category constraint to remove energy_level
-- First drop the existing constraint
ALTER TABLE tags 
DROP CONSTRAINT IF EXISTS tags_category_check;

-- Add new constraint without energy_level
ALTER TABLE tags 
ADD CONSTRAINT tags_category_check 
CHECK (category IN ('grade', 'animal_mix', 'challenge_type', 'class_dynamic', 'time_of_year'));

-- Update comment
COMMENT ON COLUMN tags.category IS 'Tag category: grade, animal_mix, challenge_type, class_dynamic, time_of_year';