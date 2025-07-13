-- THIS IS THE FIX! 
-- service_role bypasses RLS but still needs table-level permissions

-- Grant usage on the schema first
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant SELECT permission on ALL tables to service_role
-- This allows Edge Functions to read data
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;

-- Also grant INSERT, UPDATE, DELETE for functions that modify data
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant usage on sequences (for auto-incrementing IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Verify the grants were applied
SELECT 
    tablename,
    tableowner,
    has_table_privilege('service_role', schemaname||'.'||tablename, 'SELECT') as can_select,
    has_table_privilege('service_role', schemaname||'.'||tablename, 'INSERT') as can_insert
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('classes', 'students', 'profiles')
ORDER BY tablename;