-- Add missing columns to profiles table if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create index on is_anonymous if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_profiles_is_anonymous ON profiles(is_anonymous);

-- Update the getAdminStats query to exclude anonymous profiles
-- This is handled in the application code now