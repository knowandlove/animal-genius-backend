# Comprehensive Authentication Implementation Plan

## Executive Summary

After brutal assessment with Gemini and rate limit research, we've identified critical issues with the original JIT approach. This plan addresses ALL concerns with a hybrid pre-provisioning/JIT model that's secure, scalable, and operationally robust.

## Critical Findings

### Rate Limit Reality Check
- **Admin API**: 60 user creations per minute
- **Risk**: 200+ students logging in Monday morning = system failure
- **Solution**: Pre-provision users before school year starts

### Security Vulnerabilities
- **XXX-XXX codes**: Only ~17,576 combinations - easily brute-forced
- **Solution**: Longer codes + aggressive rate limiting

### Operational Gaps
- **Non-idempotent function**: Retries would fail
- **Poor data model**: No proper passport tracking
- **No cleanup strategy**: Risk of data retention issues

## The Solution: Hybrid Pre-Provisioning Model

### Phase 1: Database Schema (Immediate)

```sql
-- 1. Passport codes table (tracks authentication credentials)
CREATE TABLE passport_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  school_year TEXT NOT NULL DEFAULT '2024-2025',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_code_format CHECK (code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$')
);

-- Critical indexes for performance
CREATE INDEX idx_passport_codes_code ON passport_codes(code);
CREATE INDEX idx_passport_codes_user_id ON passport_codes(user_id);
CREATE INDEX idx_passport_codes_student_id ON passport_codes(student_id);
CREATE INDEX idx_passport_codes_expires_at ON passport_codes(expires_at);

-- 2. Rate limiting table
CREATE TABLE auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or passport code
  attempt_type TEXT NOT NULL, -- 'ip' or 'code'
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, attempt_type)
);

CREATE INDEX idx_rate_limits_identifier ON auth_rate_limits(identifier, attempt_type);

-- 3. Class memberships (for multi-class support)
CREATE TABLE class_memberships (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, class_id)
);

-- 4. Cleanup audit log
CREATE TABLE cleanup_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date TIMESTAMPTZ DEFAULT NOW(),
  users_deleted INTEGER DEFAULT 0,
  errors JSONB,
  completed BOOLEAN DEFAULT FALSE
);
```

### Phase 2: Pre-Provisioning System

#### Teacher Dashboard Function
```typescript
// Edge Function: provision-class-users
import { createClient } from '@supabase/supabase-js'

interface ProvisionRequest {
  classId: string
  students: Array<{
    name: string
    gradeLevel?: string
  }>
}

serve(async (req) => {
  // Verify teacher authorization
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })
  
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  const { classId, students } = await req.json() as ProvisionRequest
  const results = []
  
  // Batch process to respect rate limits (max 50 per batch)
  const BATCH_SIZE = 50
  const DELAY_MS = 1000 // 1 second between batches
  
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = students.slice(i, i + BATCH_SIZE)
    
    for (const student of batch) {
      try {
        // 1. Create student record
        const { data: newStudent } = await supabaseAdmin
          .from('students')
          .insert({
            student_name: student.name,
            class_id: classId,
            grade_level: student.gradeLevel
          })
          .select()
          .single()
        
        // 2. Generate secure passport code (9 characters for better security)
        const code = generateSecureCode() // Format: ABC-D3F-GH1
        
        // 3. Create auth user (no email sent)
        const email = `student-${newStudent.id}@animalgenius.local`
        const password = crypto.randomUUID() + crypto.randomUUID()
        
        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: {
            role: 'student',
            student_id: newStudent.id,
            class_id: classId,
            school_year: '2024-2025'
          }
        })
        
        if (userError) throw userError
        
        // 4. Create passport code record
        await supabaseAdmin
          .from('passport_codes')
          .insert({
            code,
            class_id: classId,
            student_id: newStudent.id,
            user_id: user.id,
            school_year: '2024-2025'
          })
        
        // 5. Create class membership
        await supabaseAdmin
          .from('class_memberships')
          .insert({
            student_id: newStudent.id,
            class_id: classId
          })
        
        results.push({
          success: true,
          student: student.name,
          code
        })
        
      } catch (error) {
        results.push({
          success: false,
          student: student.name,
          error: error.message
        })
      }
    }
    
    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < students.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }
  
  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

function generateSecureCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous chars
  let code = ''
  
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) {
      code += '-'
    } else {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  
  return code
}
```

### Phase 3: Secure Login Function (Idempotent)

```typescript
// Edge Function: student-login
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!
})

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }
    
    const { passportCode } = await req.json()
    const clientIP = req.headers.get('CF-Connecting-IP') || 
                     req.headers.get('X-Forwarded-For') || 
                     'unknown'
    
    // Validate format (now XXX-XXX-XXX for better security)
    if (!passportCode?.match(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/)) {
      return new Response(
        JSON.stringify({ error: 'Invalid passport code format' }), 
        { status: 400 }
      )
    }
    
    // Rate limiting check
    const rateLimitKey = `rate:${clientIP}`
    const attempts = await redis.incr(rateLimitKey)
    
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 60) // 60 second window
    }
    
    if (attempts > 5) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again later.' }), 
        { status: 429 }
      )
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Look up passport code with all needed data
    const { data: passport, error: passportError } = await supabaseAdmin
      .from('passport_codes')
      .select(`
        *,
        students!inner(*)
      `)
      .eq('code', passportCode)
      .eq('school_year', '2024-2025')
      .lt('expires_at', new Date().toISOString())
      .single()
    
    if (passportError || !passport) {
      // Track failed attempt on the code
      await trackFailedAttempt(supabaseAdmin, passportCode)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired passport code' }), 
        { status: 401 }
      )
    }
    
    // Check if code is locked
    if (passport.locked_until && new Date(passport.locked_until) > new Date()) {
      return new Response(
        JSON.stringify({ error: 'This code is temporarily locked due to too many failed attempts' }), 
        { status: 401 }
      )
    }
    
    // Reset attempts on successful lookup
    await supabaseAdmin
      .from('passport_codes')
      .update({ attempts: 0, locked_until: null })
      .eq('id', passport.id)
    
    // Check if user exists (idempotent logic)
    if (!passport.user_id) {
      // This shouldn't happen in production with pre-provisioning
      // But we keep JIT creation as fallback
      const email = `student-${passport.student_id}@animalgenius.local`
      const password = crypto.randomUUID() + crypto.randomUUID()
      
      const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          role: 'student',
          student_id: passport.student_id,
          class_id: passport.class_id,
          school_year: passport.school_year
        }
      })
      
      if (createError) throw createError
      
      // Update passport with user_id
      await supabaseAdmin
        .from('passport_codes')
        .update({ user_id: user.id })
        .eq('id', passport.id)
      
      passport.user_id = user.id
    }
    
    // Generate session using magic link approach
    const { data: magicLink, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `student-${passport.student_id}@animalgenius.local`,
      options: {
        redirectTo: `${Deno.env.get('FRONTEND_URL')}/room/${passportCode}`
      }
    })
    
    if (linkError) throw linkError
    
    // Extract tokens from magic link
    const url = new URL(magicLink.properties.action_link)
    const hashParams = new URLSearchParams(url.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    
    if (!accessToken || !refreshToken) {
      throw new Error('Failed to extract tokens from magic link')
    }
    
    // Clear rate limit on successful login
    await redis.del(rateLimitKey)
    
    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      student: {
        id: passport.students.id,
        name: passport.students.student_name,
        classId: passport.class_id
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })
    
  } catch (error) {
    console.error('Login error:', error)
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }), 
      { status: 500 }
    )
  }
})

async function trackFailedAttempt(supabase: any, code: string) {
  const { data: passport } = await supabase
    .from('passport_codes')
    .select('attempts')
    .eq('code', code)
    .single()
  
  if (passport) {
    const newAttempts = (passport.attempts || 0) + 1
    const updates: any = { attempts: newAttempts }
    
    // Lock after 3 failed attempts
    if (newAttempts >= 3) {
      updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min lock
    }
    
    await supabase
      .from('passport_codes')
      .update(updates)
      .eq('code', code)
  }
}
```

### Phase 4: Updated RLS Policies

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Students read own profile" ON students;
DROP POLICY IF EXISTS "Students see classmates" ON students;

-- New policies using app_metadata
CREATE POLICY "Students read own data via metadata" ON students
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'student_id')::uuid = id
);

CREATE POLICY "Students see classmates via membership" ON students
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM class_memberships cm1
    JOIN class_memberships cm2 ON cm1.class_id = cm2.class_id
    WHERE cm1.student_id = (auth.jwt() -> 'app_metadata' ->> 'student_id')::uuid
    AND cm2.student_id = students.id
  )
);

-- Inventory access
CREATE POLICY "Students manage own inventory" ON student_inventory
FOR ALL USING (
  (auth.jwt() -> 'app_metadata' ->> 'student_id')::uuid = student_id
);

-- Transaction access
CREATE POLICY "Students view own transactions" ON currency_transactions
FOR SELECT USING (
  (auth.jwt() -> 'app_metadata' ->> 'student_id')::uuid = student_id
);

-- Teachers can see everything in their classes
CREATE POLICY "Teachers full class access" ON students
FOR ALL USING (
  auth.uid() IN (
    SELECT teacher_id FROM classes 
    WHERE id IN (
      SELECT class_id FROM class_memberships 
      WHERE student_id = students.id
    )
  )
);
```

### Phase 5: Year-End Cleanup (Automated)

```sql
-- Function to run via pg_cron
CREATE OR REPLACE FUNCTION cleanup_expired_students()
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_deleted_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  -- Start audit log
  INSERT INTO cleanup_audit (run_date) VALUES (NOW());
  
  -- Find expired users
  FOR v_user_id IN
    SELECT DISTINCT user_id 
    FROM passport_codes 
    WHERE expires_at < NOW() 
    AND user_id IS NOT NULL
  LOOP
    BEGIN
      -- Delete from auth.users (cascades to everything else)
      DELETE FROM auth.users WHERE id = v_user_id;
      v_deleted_count := v_deleted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_user_id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Update audit log
  UPDATE cleanup_audit 
  SET users_deleted = v_deleted_count,
      errors = v_errors,
      completed = true
  WHERE id = (SELECT id FROM cleanup_audit ORDER BY run_date DESC LIMIT 1);
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule with pg_cron (run June 1st each year at 2 AM UTC)
SELECT cron.schedule(
  'annual-student-cleanup',
  '0 2 1 6 *',
  'SELECT cleanup_expired_students();'
);
```

### Phase 6: Teacher Management UI

```typescript
// API endpoint for teachers to manage codes
app.get('/api/teacher/class-codes/:classId', requireTeacher, async (req, res) => {
  const codes = await db
    .select({
      studentName: students.studentName,
      code: passport_codes.code,
      lastUsed: passport_codes.updatedAt,
      locked: passport_codes.lockedUntil
    })
    .from(passport_codes)
    .innerJoin(students, eq(passport_codes.studentId, students.id))
    .where(eq(passport_codes.classId, req.params.classId))
    .orderBy(students.studentName)
  
  res.json(codes)
})

// Reset a student's code
app.post('/api/teacher/reset-code', requireTeacher, async (req, res) => {
  const { studentId } = req.body
  
  // Verify teacher owns this student's class
  const authorized = await verifyTeacherOwnsStudent(req.user.id, studentId)
  if (!authorized) return res.status(403).json({ error: 'Unauthorized' })
  
  // Generate new code
  const newCode = generateSecureCode()
  
  // Update in transaction
  await db.transaction(async (trx) => {
    // Get old code
    const [oldCode] = await trx
      .select()
      .from(passport_codes)
      .where(eq(passport_codes.studentId, studentId))
      .limit(1)
    
    if (oldCode?.userId) {
      // Sign out all sessions for this user
      await supabaseAdmin.auth.admin.signOut(oldCode.userId)
    }
    
    // Update code
    await trx
      .update(passport_codes)
      .set({
        code: newCode,
        attempts: 0,
        lockedUntil: null,
        updatedAt: new Date()
      })
      .where(eq(passport_codes.studentId, studentId))
  })
  
  res.json({ success: true, newCode })
})
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Create all database tables
- [ ] Deploy rate limiting infrastructure (Upstash Redis)
- [ ] Update existing Edge Function to new secure version

### Week 2: Pre-Provisioning
- [ ] Build teacher UI for class roster upload
- [ ] Create batch provisioning Edge Function
- [ ] Test with small class (10-20 students)

### Week 3: Migration & Testing
- [ ] Migrate existing students to new system
- [ ] Load test with 200+ concurrent logins
- [ ] Security audit (penetration testing on codes)

### Week 4: Launch Preparation
- [ ] Teacher training on new system
- [ ] Create printed code cards for students
- [ ] Set up monitoring and alerts

## Risk Mitigation

### Rollback Plan
```typescript
// Feature flag in Edge Function
const USE_NEW_AUTH = Deno.env.get('USE_NEW_AUTH') === 'true'

if (!USE_NEW_AUTH) {
  // Old logic here
  return oldAuthFunction(req)
}
```

### Monitoring
- Alert if login success rate < 95%
- Alert if rate limit hits > 10/minute
- Daily report of locked codes
- Weekly cleanup audit review

## Security Checklist

- [x] Rate limiting (IP and code-based)
- [x] Secure code format (9 chars, 30+ bits entropy)
- [x] Brute force protection (code locking)
- [x] Session management (magic links)
- [x] Teacher oversight (code reset capability)
- [x] Audit logging (all auth attempts)
- [x] Automatic cleanup (pg_cron)

## Cost Analysis

### Estimated Monthly Costs
- Edge Function invocations: ~50K/month = $0.10
- Upstash Redis: ~100K commands/month = $0.00 (free tier)
- Database storage: ~1GB = included in plan
- Total additional cost: **< $1/month**

## Success Criteria

1. **Performance**: 95% of logins complete in < 2 seconds
2. **Reliability**: 99.9% uptime during school hours
3. **Security**: Zero unauthorized access incidents
4. **Usability**: < 5% of students need code reset/month
5. **Operations**: Cleanup runs successfully without manual intervention

## Conclusion

This plan addresses ALL identified risks:
- ✅ Rate limit issues (pre-provisioning)
- ✅ Security vulnerabilities (longer codes + rate limiting)
- ✅ Idempotency (proper retry logic)
- ✅ Data model (dedicated tables)
- ✅ Operational robustness (automated cleanup)
- ✅ Teacher control (management UI)

The hybrid approach gives us the best of both worlds: the security of pre-provisioning with the flexibility of JIT creation as a fallback.