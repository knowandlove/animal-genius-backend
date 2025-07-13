# Authentication Implementation Action Plan

## Overview
Based on our comprehensive analysis, here's the step-by-step action plan to implement a secure, scalable authentication system for Animal Genius.

## Immediate Actions (Today)

### 1. Decision Point: Code Format
**Current**: XXX-XXX (6 characters, ~17K combinations)  
**Recommended**: XXX-XXX-XXX (9 characters, ~17M combinations)

**Action Required**: Confirm if we can change to 9-character format for security

### 2. Set Up Rate Limiting Infrastructure
Sign up for [Upstash Redis](https://upstash.com/) (free tier is sufficient):
- Create new Redis database
- Get connection URL and token
- Add to Edge Function secrets

### 3. Update Edge Function Secrets
Add these to your Edge Function:
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `FRONTEND_URL` (for magic link redirects)

## Phase 1: Database Setup (Day 1-2)

### Run These Migrations in Order:

```sql
-- 1. Create passport_codes table
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_passport_codes_code ON passport_codes(code);
CREATE INDEX idx_passport_codes_user_id ON passport_codes(user_id);

-- 2. Migrate existing passport codes
INSERT INTO passport_codes (code, student_id, class_id, school_year)
SELECT passport_code, id, class_id, '2024-2025'
FROM students
WHERE passport_code IS NOT NULL;

-- 3. Update RLS policies (run the policies from comprehensive plan)
```

## Phase 2: Deploy New Login Function (Day 2-3)

1. **Create new Edge Function**: `student-login-secure`
2. **Use the code from the comprehensive plan**
3. **Test with ONE student first**
4. **Monitor logs carefully**

## Phase 3: Pre-Provision Users (Day 3-4)

### For Existing Students:
```typescript
// One-time script to create users for existing students
async function migrateExistingStudents() {
  const students = await db.select().from(students).limit(10) // Start small!
  
  for (const student of students) {
    // Create auth user
    // Update passport_codes table
    // Log results
  }
}
```

### For New Classes:
- Build simple teacher UI for CSV upload
- Process in batches of 50 students
- Generate printable code cards

## Phase 4: Testing Protocol (Day 4-5)

### 1. Security Testing
- [ ] Try 10 wrong codes from same IP (should block after 5)
- [ ] Try 5 wrong attempts on one code (should lock after 3)
- [ ] Verify locked codes show proper error message

### 2. Load Testing
- [ ] Simulate 50 concurrent logins
- [ ] Monitor Edge Function logs
- [ ] Check database connection pool

### 3. User Experience Testing
- [ ] Student enters correct code → gets to room
- [ ] Student clears cookies → can re-login with same code
- [ ] Teacher can see all codes for their class
- [ ] Teacher can reset a locked code

## Phase 5: Launch Preparation (Day 5-7)

### 1. Create Teacher Documentation
- How to upload class roster
- How to print code cards
- How to reset student codes
- Troubleshooting guide

### 2. Set Up Monitoring
```sql
-- Create monitoring views
CREATE VIEW daily_login_stats AS
SELECT 
  DATE(created_at) as login_date,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as successful_logins,
  SUM(CASE WHEN locked_until IS NOT NULL THEN 1 ELSE 0 END) as locked_codes
FROM passport_codes
GROUP BY DATE(created_at);
```

### 3. Prepare Rollback
- Keep old Edge Function active but renamed
- Use environment variable to switch between old/new

## Go/No-Go Checklist

Before launching to all students:

- [ ] Rate limiting tested and working
- [ ] All existing students have auth users created
- [ ] Teachers can see and manage codes
- [ ] Load test passed (200+ concurrent logins)
- [ ] Rollback plan tested
- [ ] Monitoring dashboard active
- [ ] Support team trained

## Red Flags to Watch For

1. **Edge Function timeouts** → Need to optimize queries
2. **"User already exists" errors** → Idempotency issue
3. **Mass lockouts** → Rate limits too aggressive
4. **Slow logins (>3s)** → Database index missing

## Support Playbook

### Common Issues:

**"Invalid passport code"**
- Check if code exists in passport_codes table
- Check if school_year matches
- Check if code is expired

**"Too many attempts"**
- Check auth_rate_limits table
- Clear IP-based limit if needed
- Reset code attempts counter

**"This code is locked"**
- Find in passport_codes table
- Set locked_until = NULL
- Reset attempts = 0

## Questions for You

1. **Code Format**: Can we use XXX-XXX-XXX for better security?
2. **Timeline**: When do students return to school?
3. **Scale**: How many total students do we expect?
4. **Printing**: Do you have a way to print code cards?
5. **Support**: Who will handle password resets?

## Next Immediate Step

**Let's start with the database migrations**. Once those are in place, we can test the new Edge Function with a few students before rolling out to everyone.

Ready to proceed?