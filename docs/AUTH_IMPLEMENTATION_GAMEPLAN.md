# Animal Genius Authentication Implementation Gameplan

## Overview
Implementing a year-based authentication system where:
- Teachers use standard Supabase auth (email/password)
- Students use passport codes that generate Supabase-compatible JWTs
- All data expires at end of school year

## Current State Assessment

### What We Have
- ✅ Working teacher authentication via Supabase
- ✅ Database tables: students, classes, enrollments
- ⚠️ Partially implemented unified auth middleware
- ❌ Complex Supabase user provisioning for students (needs removal)
- ❌ Fake email generation code

### What We Need
- Custom JWT Edge Function for students
- Updated RLS policies using JWT claims
- Simple frontend login flow
- Year-based data management

---

## PHASE 0: Preparation & Cleanup (2-3 hours)

### 0.1 Code Removal Checklist
```bash
# Files to clean up:
- [ ] server/routes/room-secure.ts - Remove Supabase signUp/signIn for students
- [ ] server/utils/auth-utils.ts - Delete generateStudentEmail function
- [ ] server/middleware/unified-auth.ts - Remove Supabase user handling for students
```

### 0.2 Simplified Student Auth Logic
```typescript
// Keep in unified-auth.ts:
if (studentToken) {
  try {
    // Verify JWT with our secret (not Supabase's yet)
    const decoded = jwt.verify(studentToken, process.env.SUPABASE_JWT_SECRET);
    req.auth = {
      role: 'student',
      studentId: decoded.student_id,
      classId: decoded.class_id
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session' });
  }
}
```

### 0.3 Database Cleanup
```sql
-- Remove any test student accounts from auth.users
-- BACKUP FIRST!
DELETE FROM auth.users 
WHERE raw_user_meta_data->>'role' = 'student';

-- Add school_year to tables that need it
ALTER TABLE students ADD COLUMN IF NOT EXISTS 
  school_year TEXT DEFAULT '2024-2025';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS 
  academic_year TEXT DEFAULT '2024-2025';
```

---

## PHASE 1: Backend Foundation (3-4 hours)

### 1.1 Database Schema Updates
```sql
-- Passport codes table (simpler than Gemini's version)
CREATE TABLE IF NOT EXISTS passport_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_passport_codes_code ON passport_codes(code);
CREATE INDEX idx_passport_codes_student ON passport_codes(student_id);
```

### 1.2 Edge Function: student-auth
```typescript
// supabase/functions/student-auth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jwt from 'https://deno.land/x/djwt@v2.8/mod.ts'

const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const { passportCode } = await req.json()
    
    // Validate format (XXX-XXX)
    if (!passportCode?.match(/^[A-Z]{3}-[A-Z0-9]{3}$/)) {
      return new Response(
        JSON.stringify({ error: 'Invalid passport code format' }), 
        { status: 400 }
      )
    }

    // Get student info via service role
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    
    const { data: student, error } = await supabase
      .from('students')
      .select('id, student_name, class_id, school_year')
      .eq('passport_code', passportCode)
      .eq('school_year', '2024-2025')
      .single()

    if (error || !student) {
      console.log(`Failed login attempt: ${passportCode}`)
      return new Response(
        JSON.stringify({ error: 'Invalid passport code' }), 
        { status: 401 }
      )
    }

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      sub: student.id,
      role: 'student',
      student_id: student.id,
      student_name: student.student_name,
      class_id: student.class_id,
      school_year: student.school_year,
      aud: 'authenticated',
      iat: now,
      exp: now + (60 * 60 * 8), // 8 hour session
      iss: 'supabase',
    }

    // Sign with Supabase's secret
    const token = await jwt.create(
      { alg: 'HS256', typ: 'JWT' }, 
      payload, 
      JWT_SECRET
    )

    return new Response(JSON.stringify({ 
      access_token: token,
      token_type: 'bearer',
      expires_in: 28800,
      student: {
        id: student.id,
        name: student.student_name,
        classId: student.class_id
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }), 
      { status: 500 }
    )
  }
})
```

### 1.3 Deployment Command
```bash
supabase functions deploy student-auth --no-verify-jwt
```

---

## PHASE 2: Security (RLS Policies) (2-3 hours)

### 2.1 Remove Old Policies
```sql
-- Drop policies that use auth.uid() for students
DROP POLICY IF EXISTS "Students can read own data" ON students;
DROP POLICY IF EXISTS "Students can update own data" ON students;
```

### 2.2 Create New JWT-Based Policies
```sql
-- Enable RLS on all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_transactions ENABLE ROW LEVEL SECURITY;

-- Students can read their own data
CREATE POLICY "Students read own profile" ON students
FOR SELECT USING (
  auth.jwt() ->> 'role' = 'student' AND
  (auth.jwt() ->> 'student_id')::uuid = id
);

-- Students can see classmates (for class island)
CREATE POLICY "Students see classmates" ON students
FOR SELECT USING (
  auth.jwt() ->> 'role' = 'student' AND
  (auth.jwt() ->> 'class_id')::uuid = class_id
);

-- Students can read their own inventory
CREATE POLICY "Students read own inventory" ON student_inventory
FOR SELECT USING (
  auth.jwt() ->> 'role' = 'student' AND
  (auth.jwt() ->> 'student_id')::uuid = student_id
);

-- Teachers can see all students in their classes
CREATE POLICY "Teachers see their students" ON students
FOR SELECT USING (
  auth.uid() IN (
    SELECT teacher_id FROM classes WHERE id = students.class_id
  )
);
```

---

## PHASE 3: Frontend Updates (2-3 hours)

### 3.1 Student Login Component
```typescript
// components/StudentLogin.tsx
import { supabase } from '@/lib/supabase'

export function StudentLogin() {
  const [passportCode, setPassportCode] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // Call our Edge Function
      const { data, error } = await supabase.functions.invoke('student-auth', {
        body: { passportCode }
      })

      if (error) throw error

      // Set the session in Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.access_token, // Same as access for our JWTs
      })

      if (sessionError) throw sessionError

      // Store student info
      localStorage.setItem('student_info', JSON.stringify(data.student))

      // Redirect to room
      router.push(`/room/${passportCode}`)

    } catch (error) {
      console.error('Login failed:', error)
      alert('Invalid passport code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="Enter your passport code (XXX-XXX)"
        value={passportCode}
        onChange={(e) => setPassportCode(e.target.value.toUpperCase())}
        pattern="[A-Z]{3}-[A-Z0-9]{3}"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Enter Room'}
      </button>
    </form>
  )
}
```

### 3.2 Update API Client
```typescript
// lib/api-client.ts
export async function apiRequest(endpoint: string, options = {}) {
  const { data: session } = await supabase.auth.getSession()
  
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token && {
        'Authorization': `Bearer ${session.access_token}`
      }),
      ...options.headers,
    },
  })

  if (response.status === 401) {
    // Session expired, redirect to login
    window.location.href = '/login'
  }

  return response
}
```

---

## PHASE 4: Testing Strategy (2-3 hours)

### 4.1 Unit Tests
```typescript
// tests/student-auth.test.ts
describe('Student Authentication', () => {
  it('accepts valid passport codes', async () => {
    const response = await supabase.functions.invoke('student-auth', {
      body: { passportCode: 'OWL-9ON' }
    })
    expect(response.data.access_token).toBeDefined()
  })

  it('rejects invalid formats', async () => {
    const response = await supabase.functions.invoke('student-auth', {
      body: { passportCode: 'invalid' }
    })
    expect(response.error).toBeDefined()
  })

  it('rejects expired codes', async () => {
    // Test with code that has expires_at in the past
  })
})
```

### 4.2 RLS Testing
```typescript
// tests/rls-policies.test.ts
describe('RLS Policies', () => {
  it('students can only see own data', async () => {
    // Set session as student A
    // Try to read student B's data
    // Should fail
  })

  it('students can see classmates', async () => {
    // Set session as student in class
    // Read all students in same class
    // Should succeed
  })
})
```

### 4.3 E2E Flow Test
```typescript
// e2e/student-flow.spec.ts
test('complete student flow', async ({ page }) => {
  // 1. Navigate to login
  await page.goto('/login')
  
  // 2. Enter passport code
  await page.fill('input', 'OWL-9ON')
  await page.click('button[type="submit"]')
  
  // 3. Verify redirect to room
  await expect(page).toHaveURL('/room/OWL-9ON')
  
  // 4. Verify can see own data
  await expect(page.locator('.student-name')).toContainText('Alex')
})
```

---

## PHASE 5: Deployment & Rollback Plan

### 5.1 Pre-Deployment Checklist
- [ ] Full database backup taken
- [ ] All tests passing
- [ ] Edge Function deployed and tested
- [ ] RLS policies reviewed by team
- [ ] Frontend changes tested locally

### 5.2 Deployment Sequence
1. **Thursday Evening** (low traffic):
   - Deploy Edge Function
   - Apply database migrations
   - Deploy RLS policies

2. **Friday Morning**:
   - Deploy frontend changes
   - Monitor error logs
   - Test with real passport code

### 5.3 Rollback Plan
```bash
# If issues arise:
1. Revert frontend deployment (immediate)
2. Disable new RLS policies:
   ALTER TABLE students DISABLE ROW LEVEL SECURITY;
3. Restore from backup if needed (nuclear option)
```

---

## Phase 6: Post-Launch Tasks

### 6.1 Monitoring
- Set up alerts for failed auth attempts
- Monitor Edge Function execution time
- Track session expiration patterns

### 6.2 Teacher Tools
- Create passport code generator UI
- Add "reveal passport" feature
- Build class management dashboard

### 6.3 Year-End Process
- Document data archival process
- Plan for September 2025 reset
- Design "legacy badge" system

---

## Key Decisions & Rationale

1. **8-hour sessions**: Matches school day, forces daily login
2. **No refresh tokens**: Simpler, more secure for young users
3. **Passport codes in students table**: Simpler than separate table
4. **Year-based data**: Automatic cleanup, fair competition

## Success Metrics
- Student login time < 5 seconds
- Zero unauthorized data access
- 95%+ login success rate
- Teacher satisfaction with management tools

## Questions for Team
1. Is 8-hour session acceptable or need longer?
2. Should passport codes be single-use or reusable?
3. How to handle student who forgets code mid-day?
4. Need parent access consideration?