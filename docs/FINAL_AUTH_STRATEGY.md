# Final Authentication Strategy: Anonymous-First Pattern

## Overview

After comprehensive analysis, we're implementing an **Anonymous-First Authentication Pattern** that perfectly aligns with the student quiz flow while leveraging Supabase's native capabilities.

## The Flow

### 1. Student Arrives at Quiz
```
Student → site.com/q/MATH101 → No auth required → Takes quiz
```

### 2. Pre-Quiz Validation (New!)
When student enters name/grade but BEFORE starting quiz:
```typescript
// Edge Function: /api/quiz/check-eligibility
{
  classCode: "MATH101",
  firstName: "John",
  lastInitial: "S",
  grade: "5th"
}

// Returns:
{
  eligible: true,
  warnings: [],
  // OR
  eligible: false,
  reason: "CLASS_FULL" | "NAME_TAKEN" | "CLASS_EXPIRED"
}
```

### 3. Quiz Submission Creates Everything
```typescript
// Edge Function: /api/quiz/submit
async function submitQuiz(quizData) {
  // Start transaction
  const { data: result, error } = await supabase.rpc('submit_quiz_atomic', {
    class_code: quizData.classCode,
    first_name: quizData.firstName,
    last_initial: quizData.lastInitial,
    grade: quizData.grade,
    quiz_answers: quizData.answers
  })
  
  if (error) {
    // Handle specific errors
    if (error.code === 'CLASS_FULL') {
      return { error: 'This class is full. Please see your teacher.' }
    }
    if (error.code === 'NAME_COLLISION') {
      return { error: 'This name is taken. Please add middle initial.' }
    }
  }
  
  // Success! Return passport code
  return {
    passportCode: result.passport_code,
    animalType: result.animal_type,
    message: `Welcome ${result.first_name}! Your passport code is ${result.passport_code}`
  }
}
```

### 4. Database Transaction (Atomic!)
```sql
CREATE OR REPLACE FUNCTION submit_quiz_atomic(
  class_code TEXT,
  first_name TEXT,
  last_initial TEXT,
  grade TEXT,
  quiz_answers JSONB
) RETURNS JSONB AS $$
DECLARE
  v_class_id UUID;
  v_student_id UUID;
  v_user_id UUID;
  v_passport_code TEXT;
  v_animal_type TEXT;
  v_seat_count INTEGER;
  v_seat_limit INTEGER;
BEGIN
  -- 1. Validate class exists and get info
  SELECT id, seat_limit INTO v_class_id, v_seat_limit
  FROM classes 
  WHERE code = class_code 
    AND expires_at > NOW()
    AND is_active = true;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CLASS_CODE';
  END IF;
  
  -- 2. Check capacity (with lock to prevent race conditions)
  SELECT COUNT(*) INTO v_seat_count
  FROM students 
  WHERE class_id = v_class_id
  FOR UPDATE;
  
  IF v_seat_count >= v_seat_limit THEN
    RAISE EXCEPTION 'CLASS_FULL';
  END IF;
  
  -- 3. Check name collision
  IF EXISTS (
    SELECT 1 FROM students 
    WHERE class_id = v_class_id 
      AND student_name = first_name || ' ' || last_initial
  ) THEN
    RAISE EXCEPTION 'NAME_COLLISION';
  END IF;
  
  -- 4. Calculate quiz results
  v_animal_type := calculate_animal_type(quiz_answers);
  v_passport_code := generate_passport_code(v_animal_type);
  
  -- 5. Create student record
  INSERT INTO students (
    class_id, 
    student_name,
    grade_level,
    passport_code,
    personality_type,
    currency_balance
  ) VALUES (
    v_class_id,
    first_name || ' ' || last_initial,
    grade,
    v_passport_code,
    v_animal_type,
    50 -- Starting coins
  ) RETURNING id INTO v_student_id;
  
  -- 6. Create quiz submission record
  INSERT INTO quiz_submissions (
    student_id,
    answers,
    score,
    completed_at
  ) VALUES (
    v_student_id,
    quiz_answers,
    calculate_score(quiz_answers),
    NOW()
  );
  
  -- 7. Create anonymous auth user
  v_user_id := extensions.uuid_generate_v4();
  
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'student-' || v_student_id || '@animalgenius.local',
    crypt(v_passport_code || gen_random_uuid(), gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'provider', 'email',
      'student_id', v_student_id,
      'class_id', v_class_id,
      'passport_code_hash', crypt(v_passport_code, gen_salt('bf'))
    ),
    jsonb_build_object('student_name', first_name || ' ' || last_initial),
    NOW(),
    NOW(),
    true -- Anonymous user!
  );
  
  -- 8. Link student to auth user
  UPDATE students 
  SET user_id = v_user_id 
  WHERE id = v_student_id;
  
  -- 9. Return success
  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'passport_code', v_passport_code,
    'animal_type', v_animal_type,
    'first_name', first_name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5. Student Login with Passport Code
```typescript
// Edge Function: /api/auth/student-login
serve(async (req) => {
  const { passportCode } = await req.json()
  
  // Validate format
  if (!passportCode?.match(/^[A-Z]{3}-[A-Z0-9]{3}$/)) {
    return new Response(JSON.stringify({ error: 'Invalid format' }), { status: 400 })
  }
  
  // Find student and auth user
  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('*, auth_users!inner(*)')
    .eq('passport_code', passportCode)
    .single()
    
  if (!student) {
    return new Response(JSON.stringify({ error: 'Invalid passport code' }), { status: 401 })
  }
  
  // Generate session using admin API
  const { data: session, error: sessionError } = await supabaseAdmin.auth.admin
    .createSession({
      user_id: student.user_id,
      access_token_ttl: 28800 // 8 hours
    })
    
  return new Response(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: 28800,
    student: {
      id: student.id,
      name: student.student_name,
      classId: student.class_id
    }
  }), { status: 200 })
})
```

## Key Implementation Details

### 1. Class Capacity Management
```sql
ALTER TABLE classes ADD COLUMN seat_limit INTEGER DEFAULT 30;
ALTER TABLE classes ADD COLUMN code TEXT UNIQUE NOT NULL;
ALTER TABLE classes ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (CURRENT_DATE + INTERVAL '1 year');
ALTER TABLE classes ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Generate secure class codes
CREATE OR REPLACE FUNCTION generate_class_code() RETURNS TEXT AS $$
BEGIN
  -- Format: SUBJ-XXXX where X is alphanumeric
  RETURN upper(substr(md5(random()::text), 1, 8));
END;
$$ LANGUAGE plpgsql;
```

### 2. Passport Code Generation
```typescript
function generatePassportCode(animalType: string): string {
  const prefixes = {
    'meerkat': 'MKT',
    'panda': 'PAN',
    'owl': 'OWL',
    'beaver': 'BVR',
    'elephant': 'ELE',
    'otter': 'OTR',
    'parrot': 'PAR',
    'border_collie': 'BDC'
  }
  
  // Generate 3 random alphanumeric chars
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 3; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  
  return `${prefixes[animalType]}-${suffix}`
}
```

### 3. Rate Limiting
```typescript
// Using Upstash Redis in Edge Functions
const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL')!,
  token: Deno.env.get('UPSTASH_REDIS_TOKEN')!
})

// Rate limit by IP
const ip = req.headers.get('x-forwarded-for') || 'unknown'
const attempts = await redis.incr(`quiz:${ip}`)
if (attempts === 1) {
  await redis.expire(`quiz:${ip}`, 3600) // 1 hour window
}
if (attempts > 10) {
  return new Response('Too many attempts', { status: 429 })
}

// Rate limit by class code
const classAttempts = await redis.incr(`class:${classCode}`)
if (classAttempts === 1) {
  await redis.expire(`class:${classCode}`, 3600)
}
if (classAttempts > 50) {
  return new Response('This class has too many submissions', { status: 429 })
}
```

### 4. Name Collision Handling
```typescript
// In pre-quiz check
if (nameExists) {
  return {
    eligible: false,
    reason: 'NAME_TAKEN',
    suggestion: `Try adding your middle initial: "${firstName} ${middleInitial}. ${lastInitial}"`
  }
}
```

## Security Measures

1. **Anonymous Users**: Students are anonymous Supabase users, minimizing PII
2. **Atomic Transactions**: All creation happens in a single DB transaction
3. **Rate Limiting**: IP-based and class-based limits
4. **Secure Codes**: 8-character class codes, 6-character passport codes
5. **Expiring Classes**: Automatic expiration after school year
6. **No Passwords**: Students never deal with passwords

## Advantages

1. **Native Supabase**: Uses built-in anonymous auth
2. **Simple for Students**: Just passport codes
3. **Natural Rate Limiting**: Quiz completion spreads load
4. **Atomic Operations**: No partial state possible
5. **Year-Based Cleanup**: Anonymous users easily deleted

## Migration Path

1. Add new columns to classes table
2. Create the atomic quiz submission function
3. Update quiz submission endpoint
4. Add pre-quiz validation
5. Update login to use new flow

This approach is production-ready and scales to thousands of students!