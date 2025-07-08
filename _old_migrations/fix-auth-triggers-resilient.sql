-- RESILIENT Fix for Supabase Auth User Registration Failure
-- This version handles NULL values safely with proper fallbacks

-- 1. Check current profiles table structure first
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Drop the existing function to recreate it correctly
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Create a resilient handle_new_user function with proper NULL handling
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
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'school_organization', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_title', ''),
    COALESCE(NEW.raw_user_meta_data->>'how_heard_about', ''),
    COALESCE(NEW.raw_user_meta_data->>'personality_animal', ''),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name'), ''),
      NEW.email
    ),
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error for debugging
  RAISE LOG 'handle_new_user trigger failed for user %: %', NEW.id, SQLERRM;
  -- Re-raise the exception to abort the transaction
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Test the trigger setup
SELECT 
  t.trigger_name,
  t.event_manipulation,
  t.event_object_table,
  t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_name = 'on_auth_user_created';

-- 6. Show the function definition to verify
SELECT 
  p.proname as function_name,
  'Function created successfully' as status
FROM pg_proc p
WHERE p.proname = 'handle_new_user';