-- Clean fix for Supabase Auth User Registration

-- 1. Drop the existing problematic trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Create the corrected function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the profile
  INSERT INTO public.profiles (
    id, email, first_name, last_name, school_organization,
    role_title, how_heard_about, personality_animal, full_name, is_admin
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
    false
  );
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger with AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();