-- Update the handle_new_user function to properly handle user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO profiles (
    id, 
    email, 
    full_name,
    first_name,
    last_name,
    school_organization,
    role_title,
    how_heard_about,
    personality_animal,
    is_admin,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 
             CONCAT(
               COALESCE(NEW.raw_user_meta_data->>'first_name', ''), 
               CASE 
                 WHEN NEW.raw_user_meta_data->>'first_name' IS NOT NULL 
                  AND NEW.raw_user_meta_data->>'last_name' IS NOT NULL 
                 THEN ' ' 
                 ELSE '' 
               END,
               COALESCE(NEW.raw_user_meta_data->>'last_name', '')
             )
    ),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'school_organization',
    NEW.raw_user_meta_data->>'role_title',
    NEW.raw_user_meta_data->>'how_heard_about',
    NEW.raw_user_meta_data->>'personality_animal',
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    NEW.created_at,
    NEW.created_at
  );
  RETURN NEW;
END;
$function$;