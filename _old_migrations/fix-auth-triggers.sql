-- Fix for Supabase Auth User Registration Failure
-- This file creates the missing trigger and fixes RLS policies

-- 1. Create the handle_new_user function that should run when a user signs up
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
    full_name
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
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Enable RLS on profiles table (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;

-- 5. Create proper RLS policies for profiles table
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to insert their own profile (for the trigger)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow service role to manage all profiles (for admin operations)
CREATE POLICY "Service role can manage all profiles" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read basic profile info for collaborations
CREATE POLICY "Authenticated users can view basic profile info" ON public.profiles
  FOR SELECT USING (
    auth.role() = 'authenticated' AND 
    id IN (
      -- Allow viewing profiles of users who share classes (teachers + collaborators)
      SELECT DISTINCT p.id FROM public.profiles p
      JOIN public.classes c ON p.id = c.teacher_id
      WHERE c.teacher_id = auth.uid()
      
      UNION
      
      SELECT DISTINCT cc.teacher_id FROM public.class_collaborators cc
      JOIN public.classes c ON cc.class_id = c.id
      WHERE c.teacher_id = auth.uid() OR cc.teacher_id = auth.uid()
    )
  );

-- 6. Grant necessary permissions to the authenticated role
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO service_role;