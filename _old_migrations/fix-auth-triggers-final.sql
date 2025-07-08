-- FINAL Fix for Supabase Auth User Registration
-- This addresses the foreign key constraint issue

-- 1. First, let's check if auth schema exists and has proper access
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO postgres;

-- 2. Drop the existing trigger to recreate it correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Create a more robust handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _profile_exists boolean;
BEGIN
  -- Check if profile already exists (in case of race conditions)
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = NEW.id) INTO _profile_exists;
  
  IF _profile_exists THEN
    RAISE LOG 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Log for debugging
  RAISE LOG 'Creating profile for new user: % with email: %', NEW.id, NEW.email;
  
  -- Insert the profile with defensive programming
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
    is_admin,
    created_at,
    updated_at
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
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'last_name', '')), ''),
      NEW.email
    ),
    false,
    NOW(),
    NOW()
  );
  
  RAISE LOG 'Successfully created profile for user %', NEW.id;
  RETURN NEW;
  
EXCEPTION 
  WHEN foreign_key_violation THEN
    RAISE LOG 'Foreign key violation creating profile for user %: %', NEW.id, SQLERRM;
    RAISE;
  WHEN unique_violation THEN
    RAISE LOG 'Profile already exists for user % (unique violation)', NEW.id;
    RETURN NEW; -- Don't fail if profile already exists
  WHEN OTHERS THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger on auth.users table
-- Use AFTER INSERT to ensure the user exists before creating profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Grant necessary permissions to ensure trigger can execute
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 6. Verify the foreign key constraint exists
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM 
  information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'id';

-- 7. Test that auth.users table is accessible
SELECT COUNT(*) as user_count FROM auth.users;

-- 8. Create a test to verify everything works
DO $$
BEGIN
  RAISE NOTICE 'Trigger setup completed. To test:';
  RAISE NOTICE '1. Try creating a new user via Supabase auth';
  RAISE NOTICE '2. Check Postgres logs for debug messages';
  RAISE NOTICE '3. Verify profile was created in public.profiles';
END $$;