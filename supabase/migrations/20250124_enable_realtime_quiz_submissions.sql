-- Enable Realtime on quiz_submissions table
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_submissions;

-- Also ensure students table is in realtime (for potential future use)
ALTER PUBLICATION supabase_realtime ADD TABLE students;

-- Verify what tables are currently enabled for realtime
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';