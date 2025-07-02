-- Add missing profile fields that the frontend expects
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS school_organization VARCHAR(255),
ADD COLUMN IF NOT EXISTS role_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS how_heard_about VARCHAR(255),
ADD COLUMN IF NOT EXISTS personality_animal VARCHAR(50);

-- Migrate data from full_name to first_name and last_name if needed
UPDATE profiles 
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN full_name LIKE '% %' THEN 
      SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE 
      ''
  END
WHERE full_name IS NOT NULL 
  AND first_name IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.school_organization IS 'School or organization name';
COMMENT ON COLUMN profiles.role_title IS 'User role or title (e.g., Teacher, Counselor)';
COMMENT ON COLUMN profiles.how_heard_about IS 'How the user heard about the platform';
COMMENT ON COLUMN profiles.personality_animal IS 'User personality animal from quiz';
