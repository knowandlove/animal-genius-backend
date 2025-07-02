-- Add the missing fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS school_organization VARCHAR(255),
ADD COLUMN IF NOT EXISTS role_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS how_heard_about VARCHAR(255),
ADD COLUMN IF NOT EXISTS personality_animal VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create a function to sync user metadata to profiles
CREATE OR REPLACE FUNCTION sync_user_metadata_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the profiles table with metadata from auth.users
  UPDATE profiles
  SET
    first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
    last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name),
    school_organization = COALESCE(NEW.raw_user_meta_data->>'school_organization', school_organization),
    role_title = COALESCE(NEW.raw_user_meta_data->>'role_title', role_title),
    how_heard_about = COALESCE(NEW.raw_user_meta_data->>'how_heard_about', how_heard_about),
    personality_animal = COALESCE(NEW.raw_user_meta_data->>'personality_animal', personality_animal),
    email = NEW.email,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync on user update
DROP TRIGGER IF EXISTS sync_user_metadata_trigger ON auth.users;
CREATE TRIGGER sync_user_metadata_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
EXECUTE FUNCTION sync_user_metadata_to_profile();

-- Also sync existing users
UPDATE profiles p
SET
  first_name = COALESCE(u.raw_user_meta_data->>'first_name', p.first_name),
  last_name = COALESCE(u.raw_user_meta_data->>'last_name', p.last_name),
  school_organization = COALESCE(u.raw_user_meta_data->>'school_organization', p.school_organization),
  role_title = COALESCE(u.raw_user_meta_data->>'role_title', p.role_title),
  how_heard_about = COALESCE(u.raw_user_meta_data->>'how_heard_about', p.how_heard_about),
  personality_animal = COALESCE(u.raw_user_meta_data->>'personality_animal', p.personality_animal),
  updated_at = NOW()
FROM auth.users u
WHERE p.id = u.id;

-- Also update the handle_new_user function to include these fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name,
    first_name,
    last_name,
    school_organization,
    role_title,
    how_heard_about,
    personality_animal
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'school_organization',
    NEW.raw_user_meta_data->>'role_title',
    NEW.raw_user_meta_data->>'how_heard_about',
    NEW.raw_user_meta_data->>'personality_animal'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
