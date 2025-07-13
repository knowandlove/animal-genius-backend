-- Clean up debug policies and restore original
DROP POLICY IF EXISTS "Temporary - Allow all for debugging" ON public.classes;
DROP POLICY IF EXISTS "Service role can access all classes" ON public.classes;

-- Restore the original service role policy
CREATE POLICY "Service role can access all classes" ON public.classes
  FOR ALL
  USING (auth.role() = 'service_role');

-- Clean up debug artifacts
DROP FUNCTION IF EXISTS public.log_and_pass();
DROP TABLE IF EXISTS public.debug_role_logs;

-- Verify current policies
SELECT policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'classes';