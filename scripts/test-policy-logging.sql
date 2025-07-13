-- Test if our logging policy works
-- This should create a log entry

-- First, try to select from classes
SELECT * FROM classes LIMIT 1;

-- Now check if it logged
SELECT * FROM public.debug_role_logs ORDER BY logged_at DESC LIMIT 5;

-- Also check what role we're using in SQL Editor
SELECT auth.role(), current_user;