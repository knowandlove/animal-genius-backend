-- Add the missing is_anonymous column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false NOT NULL;

-- Now get a teacher ID
SELECT id, email FROM profiles LIMIT 5;