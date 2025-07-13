# Authentication Implementation Plan

## Overview
Implement a hybrid authentication system using Supabase JIT provisioning with httpOnly cookie storage for student sessions.

## Phase 1: Create Unified Authentication Middleware (Week 1)

### 1.1 Create new middleware: `requireUnifiedAuth`
```typescript
// server/middleware/unified-auth.ts
export async function requireUnifiedAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Check for JWT in httpOnly cookie
  const token = req.cookies.supabase_session;
  
  // 2. Validate token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  // 3. Attach user to request
  if (user) {
    req.user = user;
    req.studentId = user.user_metadata.studentId;
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}
```

### 1.2 Update student login endpoint
```typescript
// server/routes/unified-auth.ts
app.post('/api/student/login', async (req, res) => {
  const { passportCode } = req.body;
  
  // 1. Validate passport code
  const student = await validatePassportCode(passportCode);
  if (!student) return res.status(401).json({ error: 'Invalid passport code' });
  
  // 2. JIT provision or retrieve Supabase user
  const supabaseUser = await jitProvisionStudent(student);
  
  // 3. Create session
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: `${passportCode}@students.animalgenius.local`,
    password: generateDeterministicPassword(passportCode)
  });
  
  // 4. Set httpOnly cookie
  res.cookie('supabase_session', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  res.json({ 
    success: true,
    student: {
      id: student.id,
      name: student.studentName,
      passportCode: student.passportCode
    }
  });
});
```

## Phase 2: Migrate Routes (Week 2-3)

### 2.1 Update all student routes
Replace `requireStudentSession` with `requireUnifiedAuth`:

```typescript
// Before
router.post('/purchase', requireStudentSession, validateOwnDataAccess, async (req, res) => {

// After
router.post('/purchase', requireUnifiedAuth, validateOwnDataAccess, async (req, res) => {
```

### 2.2 Routes to migrate:
- [ ] `/api/store-direct/*` - Store purchases
- [ ] `/api/pets/*` - Pet interactions
- [ ] `/api/room/:passportCode/*` - Room management
- [ ] `/api/currency/*` - Currency operations
- [ ] `/api/quiz/submissions` - Quiz submissions

## Phase 3: Frontend Updates (Week 3)

### 3.1 Update login flow
```typescript
// Frontend: PassportCodeEntry.tsx
const handleLogin = async (passportCode: string) => {
  const response = await fetch('/api/student/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important for cookies
    body: JSON.stringify({ passportCode })
  });
  
  if (response.ok) {
    // Redirect to student room
    navigate(`/room/${passportCode}`);
  }
};
```

### 3.2 Update API client
```typescript
// lib/apiClient.ts
export async function apiRequest(method: string, url: string, data?: any) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Always include cookies
    body: data ? JSON.stringify(data) : undefined
  });
  
  if (!response.ok) {
    throw new Error(await response.text());
  }
  
  return response.json();
}
```

## Phase 4: Cleanup (Week 4)

### 4.1 Remove legacy code
- [ ] Delete `server/middleware/student-auth.ts`
- [ ] Remove `ENABLE_LEGACY_STUDENT_AUTH` from .env
- [ ] Remove `JWT_SECRET` from .env (only use Supabase JWT secret)
- [ ] Remove all references to `requireStudentSession`

### 4.2 Update documentation
- [ ] Update API documentation
- [ ] Update deployment guides
- [ ] Create migration guide for any external integrations

## Security Considerations

### CSRF Protection
Add CSRF token validation for state-changing operations:

```typescript
// middleware/csrf.ts
export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;
  
  if (token === sessionToken) {
    next();
  } else {
    res.status(403).json({ error: 'Invalid CSRF token' });
  }
}
```

### Session Management
- Set appropriate cookie expiration (7 days recommended)
- Implement session refresh before expiration
- Add logout endpoint to clear cookies

## Testing Plan

### Unit Tests
- Test unified auth middleware with valid/invalid tokens
- Test JIT provisioning logic
- Test cookie setting/clearing

### Integration Tests
- Test full login flow
- Test protected endpoints with/without auth
- Test session persistence across requests

### E2E Tests
- Student login and purchase flow
- Session timeout handling
- Cross-browser cookie support

## Rollback Plan
If issues arise:
1. Re-enable `ENABLE_LEGACY_STUDENT_AUTH=true`
2. Revert middleware changes
3. Frontend will continue working with legacy cookies
4. Fix issues and retry migration

## Success Metrics
- Zero authentication errors in production
- Successful migration of all student routes
- No increase in support tickets
- Improved code maintainability scores