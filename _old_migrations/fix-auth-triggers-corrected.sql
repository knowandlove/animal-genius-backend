-- CORRECTED Fix for Supabase Auth User Registration Failure
-- This file creates the missing trigger with correct column names

-- 1. Drop the existing function to recreate it correctly
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Create the corrected handle_new_user function with proper column names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    school_organization,
    role_title,
    how_heard_about,
    personality_animal,
    full_name,
    is_admin
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'school_organization',
    NEW.raw_user_meta_data->>'role_title',
    NEW.raw_user_meta_data->>'how_heard_about',
    NEW.raw_user_meta_data->>'personality_animal',
    COALESCE(
      NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name',
      NEW.email
    ),
    false -- Default is_admin to false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Test the trigger by checking if it exists
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.event_object_table,
  t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_name = 'on_auth_user_created';

-- 5. Show the function definition to verify
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname = 'handle_new_user';