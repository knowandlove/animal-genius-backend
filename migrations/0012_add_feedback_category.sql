-- Add 'feedback' category to discussions table
ALTER TABLE discussions 
DROP CONSTRAINT IF EXISTS discussions_category_check;

ALTER TABLE discussions 
ADD CONSTRAINT discussions_category_check 
CHECK (category IN ('lessons', 'animals', 'challenges', 'success_stories', 'ask_teachers', 'feedback'));

-- Add comment to document the new category
COMMENT ON COLUMN discussions.category IS 'Discussion category: lessons, animals, challenges, success_stories, ask_teachers, feedback';