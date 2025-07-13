-- Grant permission to execute RPC functions
GRANT EXECUTE ON FUNCTION public.submit_quiz_atomic TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_animal_type TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_passport_code TO service_role;

-- Also grant to anon role for direct RPC calls from frontend
GRANT EXECUTE ON FUNCTION public.submit_quiz_atomic TO anon;
GRANT EXECUTE ON FUNCTION public.calculate_animal_type TO anon;
GRANT EXECUTE ON FUNCTION public.generate_passport_code TO anon;

-- Verify the grants
SELECT 
    proname as function_name,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND proname IN ('submit_quiz_atomic', 'calculate_animal_type', 'generate_passport_code');
EOF < /dev/null