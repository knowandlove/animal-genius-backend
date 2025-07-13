# Frontend Implementation Guide for Custom JWT Authorizer

This guide outlines the frontend changes needed to implement the new Custom JWT Authorizer pattern for student authentication.

## Overview

Students now authenticate using passport codes through a Supabase Edge Function that generates custom JWTs. These JWTs are used for all API requests and RLS policies.

## Key Changes

1. **No Supabase accounts for students** - Students don't have Supabase auth accounts
2. **8-hour sessions** - JWTs expire after 8 hours (school day)
3. **SessionStorage** - Tokens stored in sessionStorage (cleared on browser close)
4. **Year-based data** - All student data expires at end of school year

## Implementation Steps

### 1. Update Student Login Component

```typescript
// components/StudentLogin.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/router';

export function StudentLogin() {
  const [passportCode, setPassportCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('student-auth', {
        body: { passportCode: passportCode.toUpperCase() }
      });

      if (fnError) throw fnError;

      // Store token and metadata
      sessionStorage.setItem('auth_token', data.access_token);
      sessionStorage.setItem('token_expires', String(Date.now() + (data.expires_in * 1000)));
      sessionStorage.setItem('student_info', JSON.stringify(data.student));

      // Set session in Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.access_token, // Same as access token
      });

      if (sessionError) throw sessionError;

      // Start inactivity timer
      startInactivityTimer();

      // Redirect to room
      router.push(`/room/${passportCode}`);

    } catch (error) {
      console.error('Login failed:', error);
      setError('Invalid passport code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label htmlFor="passport" className="block text-sm font-medium">
          Enter Your Passport Code
        </label>
        <input
          id="passport"
          type="text"
          placeholder="XXX-XXX"
          value={passportCode}
          onChange={(e) => setPassportCode(e.target.value.toUpperCase())}
          pattern="[A-Z]{3}-[A-Z0-9]{3}"
          className="mt-1 block w-full rounded-md border-gray-300"
          required
          disabled={loading}
        />
      </div>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white"
      >
        {loading ? 'Loading...' : 'Enter Room'}
      </button>
    </form>
  );
}
```

### 2. Create Inactivity Timer Utility

```typescript
// utils/inactivity-timer.ts
let inactivityTimer: NodeJS.Timeout;
let lastActivity = Date.now();

export function startInactivityTimer() {
  const TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  const resetTimer = () => {
    lastActivity = Date.now();
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(handleInactivity, TIMEOUT);
  };
  
  // Track user activity
  const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
  events.forEach(event => {
    document.addEventListener(event, resetTimer, { passive: true });
  });
  
  // Start timer
  resetTimer();
  
  // Check token expiry every minute
  setInterval(checkTokenExpiry, 60000);
}

function handleInactivity() {
  console.log('Session expired due to inactivity');
  logout();
}

function checkTokenExpiry() {
  const expiresAt = sessionStorage.getItem('token_expires');
  if (expiresAt && Date.now() > parseInt(expiresAt)) {
    console.log('Token expired');
    logout();
  }
}

export function logout() {
  // Clear session storage
  sessionStorage.clear();
  
  // Clear Supabase session
  supabase.auth.signOut();
  
  // Redirect to login
  window.location.href = '/login';
}
```

### 3. Update API Client

```typescript
// lib/api-client.ts
import { supabase } from './supabase';

class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Get token from sessionStorage
    const token = sessionStorage.getItem('auth_token');
    
    // Check if token is expired
    const expiresAt = sessionStorage.getItem('token_expires');
    if (expiresAt && Date.now() > parseInt(expiresAt)) {
      throw new Error('Session expired');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token invalid or expired
        logout();
        throw new Error('Authentication required');
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }
      
      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Convenience methods
  get<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### 4. Create Auth Context

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { startInactivityTimer } from '@/utils/inactivity-timer';

interface StudentInfo {
  id: string;
  name: string;
  classId: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  studentInfo: StudentInfo | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  studentInfo: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = sessionStorage.getItem('auth_token');
      const expiresAt = sessionStorage.getItem('token_expires');
      const info = sessionStorage.getItem('student_info');
      
      if (token && expiresAt && Date.now() < parseInt(expiresAt)) {
        // Valid token exists
        setIsAuthenticated(true);
        if (info) {
          setStudentInfo(JSON.parse(info));
        }
        
        // Ensure Supabase session is set
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.setSession({
            access_token: token,
            refresh_token: token,
          });
        }
        
        // Start inactivity timer
        startInactivityTimer();
      } else {
        // No valid token
        logout();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.clear();
    supabase.auth.signOut();
    setIsAuthenticated(false);
    setStudentInfo(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, studentInfo, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 5. Create Protected Route Component

```typescript
// components/ProtectedRoute.tsx
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

### 6. Update Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false, // Disabled for student JWTs
    persistSession: false,   // Use sessionStorage instead
    detectSessionInUrl: false,
  },
});
```

## Migration Checklist

- [ ] Update all student login components to use Edge Function
- [ ] Replace cookie-based auth with Bearer token auth
- [ ] Implement sessionStorage for token management
- [ ] Add inactivity timer (30 minutes)
- [ ] Update API client to include Bearer tokens
- [ ] Create auth context for managing auth state
- [ ] Update protected routes to check sessionStorage
- [ ] Remove any Supabase user creation for students
- [ ] Test 8-hour session expiry
- [ ] Test browser close clears session
- [ ] Update error handling for 401 responses

## Testing the Implementation

1. **Login Flow**:
   - Enter valid passport code
   - Verify JWT stored in sessionStorage
   - Check redirect to student room

2. **Session Management**:
   - Verify 8-hour expiry works
   - Test 30-minute inactivity logout
   - Confirm browser close clears session

3. **API Requests**:
   - Verify Bearer token sent with requests
   - Test 401 handling redirects to login
   - Check RLS policies work with JWT claims

4. **Edge Cases**:
   - Invalid passport codes
   - Expired tokens
   - Network errors
   - Multiple tabs/windows

## Common Issues and Solutions

### Issue: "No session found" errors
**Solution**: Ensure Bearer token is included in Authorization header

### Issue: RLS policies failing
**Solution**: Check JWT claims match expected format in policies

### Issue: Session persists after browser close
**Solution**: Use sessionStorage, not localStorage

### Issue: Students can't see classmates
**Solution**: Verify class_id claim is included in JWT