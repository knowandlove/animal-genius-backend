# Final Authentication Recommendation: JIT User Pattern

## Executive Summary

After extensive analysis including industry research and technical constraints, we recommend implementing a **Just-In-Time (JIT) User Pattern** that creates minimal Supabase users for students. This aligns with industry standards (Clever, ClassLink) and works within Supabase's current limitations.

## Why This Approach?

1. **Industry Validation**: Major educational platforms (Clever, ClassLink) create managed user accounts
2. **Technical Necessity**: Without JWT Signing Keys, this is the ONLY way to get RLS-compatible JWTs
3. **Security**: Leverages Supabase's battle-tested auth system
4. **Simplicity**: Students still just use passport codes - complexity is hidden

## Implementation Plan

### 1. Database Schema

```sql
-- Passport codes table to track student-user mappings
CREATE TABLE public.passport_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- e.g., 'ABC-123'
  student_id UUID REFERENCES students(id),
  class_id UUID REFERENCES classes(id),
  user_id UUID REFERENCES auth.users(id), -- Links to Supabase user
  school_year TEXT NOT NULL DEFAULT '2024-2025',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '1 year')
);

CREATE INDEX idx_passport_codes_code ON passport_codes(code);
CREATE INDEX idx_passport_codes_user ON passport_codes(user_id);
```

### 2. Edge Function: `passport-login`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const { passportCode } = await req.json()
    
    // Validate format
    if (!passportCode?.match(/^[A-Z]{3}-[A-Z0-9]{3}$/)) {
      return new Response(JSON.stringify({ error: 'Invalid passport code format' }), { status: 400 })
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Look up passport code
    const { data: passport, error: passportError } = await supabaseAdmin
      .from('passport_codes')
      .select('*, students!inner(*)')
      .eq('code', passportCode)
      .eq('school_year', '2024-2025')
      .single()

    if (passportError || !passport) {
      return new Response(JSON.stringify({ error: 'Invalid passport code' }), { status: 401 })
    }

    // 2. Check if user already exists
    if (passport.user_id) {
      // User exists - generate magic link for sign in
      const { data: magicLink, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: `student-${passport.id}@animalgenius.local`,
      })

      if (linkError) throw linkError

      // Extract session from magic link
      const { data: { session }, error: sessionError } = await supabaseAdmin.auth.refreshSession({ 
        refresh_token: magicLink.properties.hashed_token 
      })

      if (sessionError) throw sessionError

      return new Response(JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        student: {
          id: passport.students.id,
          name: passport.students.student_name,
          classId: passport.students.class_id
        }
      }), { status: 200 })
    }

    // 3. Create new user (first login)
    const email = `student-${passport.id}@animalgenius.local`
    const password = crypto.randomUUID() + crypto.randomUUID() // Strong, discarded password

    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      app_metadata: {
        student_id: passport.students.id,
        passport_code: passportCode,
        class_id: passport.class_id,
        school_year: passport.school_year
      },
      email_confirm: true
    })

    if (createError) throw createError

    // 4. Update passport with user_id
    await supabaseAdmin
      .from('passport_codes')
      .update({ user_id: user.id })
      .eq('id', passport.id)

    // 5. Generate session for new user
    const { data: magicLink, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError) throw linkError

    const { data: { session }, error: sessionError } = await supabaseAdmin.auth.refreshSession({ 
      refresh_token: magicLink.properties.hashed_token 
    })

    if (sessionError) throw sessionError

    return new Response(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      student: {
        id: passport.students.id,
        name: passport.students.student_name,
        classId: passport.students.class_id
      }
    }), { status: 200 })

  } catch (error) {
    console.error('Auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Authentication failed', details: error.message }), 
      { status: 500 }
    )
  }
})
```

### 3. Updated RLS Policies

```sql
-- Students can read their own data using app_metadata
CREATE POLICY "Students read own profile" ON students
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'student_id')::uuid = id
);

-- Students can see classmates
CREATE POLICY "Students see classmates" ON students
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'class_id')::uuid = class_id
);

-- Similar patterns for other tables...
```

### 4. Year-End Cleanup

```sql
-- Scheduled function to run annually
CREATE OR REPLACE FUNCTION cleanup_expired_students()
RETURNS void AS $$
BEGIN
  -- Delete auth users for expired passports
  DELETE FROM auth.users
  WHERE id IN (
    SELECT user_id 
    FROM passport_codes 
    WHERE expires_at < NOW()
    AND user_id IS NOT NULL
  );
  
  -- Delete expired passport codes
  DELETE FROM passport_codes WHERE expires_at < NOW();
  
  -- Delete student data for past years
  DELETE FROM students WHERE school_year < date_part('year', NOW())::text || '-' || (date_part('year', NOW()) + 1)::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Benefits

1. **Works Today**: No waiting for JWT Signing Keys feature
2. **Industry Standard**: Aligns with Clever/ClassLink patterns
3. **Secure**: Uses Supabase's auth system properly
4. **Simple for Students**: Still just passport codes
5. **Clean Data Lifecycle**: Annual cleanup is straightforward

## Trade-offs Accepted

1. **Creates auth.users entries**: But these are minimal and cleaned up annually
2. **Requires service role in Edge Function**: But this is properly isolated
3. **Annual cleanup required**: But this is automated via pg_cron

## Migration Path

1. Update existing Edge Function to this pattern
2. Create passport_codes table
3. Update RLS policies to use app_metadata
4. Test with existing passport codes
5. Schedule annual cleanup

This approach provides the best balance of security, usability, and maintainability given current Supabase constraints.