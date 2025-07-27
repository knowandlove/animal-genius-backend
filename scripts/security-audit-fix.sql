-- Security Audit and Fix Script
-- Run this in Supabase SQL Editor to identify and fix security issues

-- 1. Check which tables have RLS disabled
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ DISABLED - SECURITY RISK!'
    END as "RLS Status"
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- 2. Enable RLS on all public tables that don't have it
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = false
        AND tablename NOT IN ('schema_migrations', 'drizzle_migrations') -- Skip migration tables
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
        RAISE NOTICE 'Enabled RLS on table: %', r.tablename;
    END LOOP;
END $$;

-- 3. Check for tables without any RLS policies (RLS enabled but no policies = no access)
SELECT 
    t.tablename,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN COUNT(p.policyname) = 0 THEN '⚠️  NO POLICIES - Table is inaccessible!'
        ELSE '✅ Has ' || COUNT(p.policyname) || ' policies'
    END as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
AND t.rowsecurity = true
GROUP BY t.tablename
ORDER BY COUNT(p.policyname) ASC, t.tablename;

-- 4. Grant necessary permissions to service role
-- Service role bypasses RLS but still needs table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 5. Create a policy for profiles table if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" ON profiles
            FOR SELECT USING (auth.uid() = id);
        RAISE NOTICE 'Created policy: Users can view own profile';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON profiles
            FOR UPDATE USING (auth.uid() = id);
        RAISE NOTICE 'Created policy: Users can update own profile';
    END IF;
END $$;

-- 6. Check for overly permissive policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    CASE 
        WHEN qual IS NULL OR qual = 'true' THEN '⚠️  PERMISSIVE - Anyone can access!'
        ELSE '✅ Has restrictions'
    END as security_status
FROM pg_policies
WHERE schemaname = 'public'
AND (qual IS NULL OR qual = 'true')
ORDER BY tablename, policyname;

-- 7. Audit functions with SECURITY DEFINER
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%search_path%' THEN '✅ Has search_path'
        ELSE '❌ MISSING search_path - SQL injection risk!'
    END as security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true -- SECURITY DEFINER functions
ORDER BY security_status DESC, p.proname;

-- 8. Check for unique constraint on passport_code
SELECT 
    conname as constraint_name,
    contype,
    '✅ Passport codes are protected' as status
FROM pg_constraint
WHERE conrelid = 'students'::regclass
AND contype = 'u' -- unique constraint
AND conname LIKE '%passport_code%'
UNION ALL
SELECT 
    'MISSING UNIQUE CONSTRAINT',
    'u',
    '❌ CRITICAL - Passport codes can be duplicated!'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'students'::regclass
    AND contype = 'u'
    AND conname LIKE '%passport_code%'
);

-- 9. Summary report
SELECT 
    'Security Audit Complete' as status,
    NOW() as completed_at,
    current_user as run_by;