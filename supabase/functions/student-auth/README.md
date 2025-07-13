# Student Auth Edge Function

This Edge Function generates Supabase-compatible JWTs for students using passport codes.

## Deployment

1. Deploy the function:
```bash
supabase functions deploy student-auth --no-verify-jwt
```

2. The function requires these environment variables (automatically available in Supabase):
   - `SUPABASE_JWT_SECRET` - Used to sign JWTs
   - `SUPABASE_URL` - Database URL  
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

## Usage

```javascript
// Call from frontend
const { data, error } = await supabase.functions.invoke('student-auth', {
  body: { passportCode: 'OWL-9ON' }
});

if (data) {
  // Store token in sessionStorage
  sessionStorage.setItem('auth_token', data.access_token);
  
  // Set session in Supabase client
  await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.access_token
  });
}
```

## Response Format

```json
{
  "access_token": "jwt_token_here",
  "token_type": "bearer",
  "expires_in": 28800,
  "student": {
    "id": "uuid",
    "name": "Student Name",
    "classId": "uuid"
  }
}
```

## JWT Claims

The JWT includes these claims:
- `sub`: Student ID
- `role`: "student"
- `student_id`: Student ID
- `student_name`: Student's display name
- `class_id`: Class ID
- `school_year`: Academic year
- `exp`: Expiration (8 hours)
- `aud`: "authenticated"
- `iss`: "supabase"