-- Check if quiz_submissions table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'quiz_submissions'
) AS table_exists;

-- Check what tables are currently in the supabase_realtime publication
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Add quiz_submissions table to realtime publication
-- This is the key command to enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_submissions;

-- Also add students table for future use
ALTER PUBLICATION supabase_realtime ADD TABLE students;

-- Verify the tables were added
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;