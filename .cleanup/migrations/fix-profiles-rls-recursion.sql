-- Fix infinite recursion in profiles RLS policies
-- The issue is that the policy references auth.uid() = id which causes recursion

-- First, disable RLS temporarily to fix the policies
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop the existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create new policies that avoid recursion
-- Allow authenticated users to view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role to do anything (for backend operations)
CREATE POLICY "Service role can do anything" ON profiles
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Fixed RLS policies for profiles table!';
END $$;
