-- Check ALL policies on classes table (including DENY policies)
SELECT
    p.polname AS policy_name,
    c.relname AS table_name,
    p.polpermissive AS is_permissive,
    CASE
        WHEN p.polroles = '{0}' THEN 'public'
        ELSE array_to_string(
            ARRAY(
                SELECT rolname
                FROM pg_roles
                WHERE oid = ANY(p.polroles)
            ),
            ','
        )
    END AS roles,
    p.polcmd AS command_type,
    pg_get_expr(p.polqual, p.polrelid) AS using_expression,
    pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM
    pg_policy p
JOIN
    pg_class c ON c.oid = p.polrelid
LEFT JOIN
    pg_namespace n ON n.oid = c.relnamespace
WHERE
    c.relname = 'classes';

-- Also check what role the SQL Editor is using
SELECT current_user, session_user, current_role;