-- Check what role the Edge Function is using
SELECT * FROM public.debug_role_logs 
ORDER BY logged_at DESC 
LIMIT 10;

-- If you see 'anon' instead of 'service_role', that's the problem!