# Final Authentication Implementation Plan

## Overview
Implement a hybrid authentication system using Supabase as the sole identity provider, with different storage mechanisms for students (sessionStorage) and teachers (httpOnly cookies).

## Phase 1: Database & Environment Cleanup
- [ ] Backup current test data (optional)
- [ ] Remove `JWT_SECRET` from .env
- [ ] Remove `ENABLE_LEGACY_STUDENT_AUTH` from .env
- [ ] Ensure Supabase environment variables are set:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`  
  - `SUPABASE_SERVICE_ROLE_KEY`

## Phase 2: Remove Legacy Code
- [ ] Delete `/server/middleware/student-auth.ts`
- [ ] Delete `/server/lib/student-auth.ts`
- [ ] Remove all imports and references to `requireStudentSession`
- [ ] Remove legacy cookie handling code

## Phase 3: Implement Core Authentication

### 3.1 Create Unified Auth Middleware
```typescript
// server/middleware/unified-auth.ts
import { createServerClient } from '@supabase/ssr';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = user;
  req.studentId = user.user_metadata?.studentId;
  req.teacherId = user.user_metadata?.teacherId;
  req.userRole = user.user_metadata?.role;
  
  next();
}

export function requireStudent(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
}

export function requireTeacher(req: Request, res: Response, next: NextFunction) {
  if (req.userRole !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
}
```

### 3.2 Student Login Endpoint
```typescript
// server/routes/auth/student-login.ts
import { generateSecurePassword } from '../../utils/auth-utils';

const SALT = process.env.STUDENT_PASSWORD_SALT || 'default-salt';

app.post('/api/auth/student-login', async (req, res) => {
  const { passportCode } = req.body;
  
  // Validate format
  if (!isValidPassportCode(passportCode)) {
    return res.status(400).json({ error: 'Invalid passport code format' });
  }
  
  // Find student
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.passportCode, passportCode))
    .limit(1);
    
  if (!student) {
    return res.status(401).json({ error: 'Invalid passport code' });
  }
  
  // Generate deterministic Supabase credentials
  const email = `${passportCode.toLowerCase()}@students.animalgenius.local`;
  const password = generateSecurePassword(passportCode, SALT);
  
  try {
    // Try to sign in first
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    // If user doesn't exist, create them (JIT provisioning)
    if (error?.message?.includes('Invalid login credentials')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            studentId: student.id,
            role: 'student',
            passportCode: passportCode
          }
        }
      });
      
      if (signUpError) throw signUpError;
      
      // Sign in after creation
      ({ data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      }));
    }
    
    if (error) throw error;
    
    // Return token for sessionStorage
    res.json({
      success: true,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: 28800, // 8 hours
      student: {
        id: student.id,
        name: student.studentName,
        passportCode: student.passportCode
      }
    });
    
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
```

### 3.3 Teacher Login Endpoint (Cookie-based)
```typescript
// server/routes/auth/teacher-login.ts
app.post('/api/auth/teacher-login', async (req, res) => {
  const { email, password } = req.body;
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Set httpOnly cookies for teachers
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/'
  };
  
  res.cookie('sb-access-token', data.session.access_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 1000 // 1 hour
  });
  
  res.cookie('sb-refresh-token', data.session.refresh_token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  res.json({
    success: true,
    teacher: {
      id: data.user.id,
      email: data.user.email
    }
  });
});
```

## Phase 4: Frontend Implementation

### 4.1 API Client Updates
```typescript
// frontend/lib/api-client.ts
export class ApiClient {
  private token: string | null = null;
  
  constructor() {
    // For students, get token from sessionStorage
    this.token = sessionStorage.getItem('auth_token');
  }
  
  async request(method: string, url: string, data?: any) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    // Add bearer token for students
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const response = await fetch(url, {
      method,
      headers,
      credentials: 'include', // For teacher cookies
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (response.status === 401) {
      // Handle token refresh or redirect to login
      this.handleAuthError();
    }
    
    return response.json();
  }
}
```

### 4.2 Student Login Component
```typescript
// frontend/components/StudentLogin.tsx
const handleLogin = async (passportCode: string) => {
  const response = await fetch('/api/auth/student-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passportCode })
  });
  
  if (response.ok) {
    const data = await response.json();
    
    // Store tokens in sessionStorage
    sessionStorage.setItem('auth_token', data.token);
    sessionStorage.setItem('refresh_token', data.refreshToken);
    sessionStorage.setItem('token_expires', Date.now() + (data.expiresIn * 1000));
    
    // Start inactivity timer
    startInactivityTimer();
    
    // Redirect to student dashboard
    navigate(`/room/${passportCode}`);
  }
};
```

### 4.3 Inactivity Timer
```typescript
// frontend/utils/inactivity-timer.ts
let inactivityTimer: NodeJS.Timeout;

export function startInactivityTimer() {
  const TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(logout, TIMEOUT);
  };
  
  // Reset on any user activity
  document.addEventListener('mousemove', resetTimer);
  document.addEventListener('keypress', resetTimer);
  document.addEventListener('click', resetTimer);
  document.addEventListener('touchstart', resetTimer);
  
  // Start the timer
  resetTimer();
}

function logout() {
  sessionStorage.clear();
  window.location.href = '/login';
}
```

## Phase 5: Update All Endpoints

Replace all instances of `requireStudentSession` with `requireAuth, requireStudent`:

```typescript
// Before
router.post('/purchase', requireStudentSession, validateOwnDataAccess, async (req, res) => {

// After  
router.post('/purchase', requireAuth, requireStudent, validateOwnDataAccess, async (req, res) => {
```

## Phase 6: Security Enhancements

### 6.1 CSRF Protection for Teachers
```typescript
// server/middleware/csrf.ts
import { randomBytes } from 'crypto';

export function generateCSRFToken(req: Request, res: Response, next: NextFunction) {
  if (req.userRole === 'teacher' && !req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  next();
}

export function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  if (req.userRole === 'teacher') {
    const token = req.headers['x-csrf-token'];
    if (token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  next();
}
```

### 6.2 Content Security Policy
```typescript
// server/middleware/security.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust as needed
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL]
    }
  }
}));
```

## Phase 7: Testing

### 7.1 Unit Tests
- [ ] Test student login with valid/invalid passport codes
- [ ] Test teacher login with valid/invalid credentials
- [ ] Test token storage and retrieval
- [ ] Test inactivity timeout
- [ ] Test CSRF protection

### 7.2 Integration Tests
- [ ] Test full student flow: login → purchase → logout
- [ ] Test full teacher flow: login → manage class → logout
- [ ] Test session persistence across requests
- [ ] Test automatic logout scenarios

### 7.3 Security Tests
- [ ] Test XSS prevention
- [ ] Test CSRF protection
- [ ] Test session hijacking prevention
- [ ] Test rate limiting on login endpoints

## Phase 8: Deployment Checklist

- [ ] Set all required environment variables
- [ ] Enable HTTPS in production
- [ ] Configure Supabase Row Level Security (RLS)
- [ ] Set up monitoring for auth failures
- [ ] Document the new auth flow
- [ ] Train support team on new system

## Rollback Plan

If critical issues arise:
1. Keep the old code in a `legacy-auth` branch
2. Have database backup before migration
3. Can quickly revert by:
   - Restoring old middleware files
   - Re-adding environment variables
   - Deploying previous version

## Success Metrics

- Zero authentication errors in production
- Student login time < 5 seconds
- Teacher session persistence working correctly
- No security vulnerabilities in auth flow
- Clean, maintainable codebase