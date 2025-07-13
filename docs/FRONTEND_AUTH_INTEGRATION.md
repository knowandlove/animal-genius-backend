# Frontend Authentication Integration Guide

## Overview

This guide explains how to integrate the new anonymous-first authentication system into your React frontend.

## Authentication Flow

### 1. Quiz Page Flow

```typescript
// QuizPage.tsx
import { supabase } from '@/lib/supabase-client';

interface QuizPageProps {
  classCode: string; // From URL: /quiz/MATH101
}

export function QuizPage({ classCode }: QuizPageProps) {
  const [step, setStep] = useState<'info' | 'quiz' | 'result'>('info');
  const [studentInfo, setStudentInfo] = useState({
    firstName: '',
    lastInitial: '',
    grade: '5th'
  });
  const [eligibility, setEligibility] = useState<any>(null);

  // Step 1: Check eligibility when student enters their info
  const checkEligibility = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('quiz-check-eligibility', {
        body: {
          classCode,
          firstName: studentInfo.firstName,
          lastInitial: studentInfo.lastInitial,
          grade: studentInfo.grade
        }
      });

      if (error) throw error;
      
      setEligibility(data);
      
      if (data.eligible) {
        setStep('quiz');
      } else {
        // Show error message based on reason
        showError(data.message, data.suggestion);
      }
    } catch (error) {
      console.error('Eligibility check failed:', error);
      showError('Unable to verify eligibility. Please try again.');
    }
  };

  // Step 2: Submit quiz when completed
  const submitQuiz = async (answers: any[]) => {
    try {
      const { data, error } = await supabase.functions.invoke('quiz-submit', {
        body: {
          classCode,
          firstName: studentInfo.firstName,
          lastInitial: studentInfo.lastInitial,
          grade: studentInfo.grade,
          answers
        }
      });

      if (error) throw error;

      // Store passport code securely
      localStorage.setItem('animalgenius_passport', data.passportCode);
      
      // Show result
      setStep('result');
      setQuizResult({
        passportCode: data.passportCode,
        animalType: data.animalType,
        message: data.message
      });
      
    } catch (error) {
      console.error('Quiz submission failed:', error);
      showError('Failed to submit quiz. Please try again.');
    }
  };
}
```

### 2. Student Login Flow

```typescript
// StudentLogin.tsx
import { supabase } from '@/lib/supabase-client';
import { useNavigate } from 'react-router-dom';

export function StudentLogin() {
  const [passportCode, setPassportCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call Edge Function for student login
      // Note: Database auto-converts to uppercase, but we do it here for consistency
      const { data, error } = await supabase.functions.invoke('student-login', {
        body: { passportCode: passportCode.toUpperCase() }
      });

      if (error) throw error;

      // Set the session in Supabase client
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      // Store student info
      localStorage.setItem('student_info', JSON.stringify(data.student));

      // Redirect to dashboard
      navigate('/student/dashboard');
      
    } catch (error) {
      console.error('Login failed:', error);
      showError('Invalid passport code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="XXX-XXX"
        value={passportCode}
        onChange={(e) => setPassportCode(e.target.value.toUpperCase())}
        pattern="[A-Z]{3}-[A-Z0-9]{3}"
        maxLength={7}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Enter Room'}
      </button>
    </form>
  );
}
```

### 3. Supabase Client Setup

```typescript
// lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Helper to get current student
export async function getCurrentStudent() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  // Get student info from metadata
  const studentId = user.app_metadata?.student_id;
  const classId = user.app_metadata?.class_id;
  
  return {
    id: studentId,
    classId,
    name: user.user_metadata?.student_name,
    isAnonymous: user.is_anonymous
  };
}
```

### 4. Protected Routes

```typescript
// components/StudentRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function StudentRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  if (!user || !user.app_metadata?.student_id) {
    return <Navigate to="/student/login" />;
  }
  
  return <>{children}</>;
}
```

### 5. Auth Hook

```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('student_info');
    localStorage.removeItem('animalgenius_passport');
  };

  return { user, loading, signOut };
}
```

### 6. API Calls with Auth

```typescript
// services/api.ts
import { supabase } from '@/lib/supabase-client';

// Example: Get student's room data
export async function getMyRoom() {
  const { data, error } = await supabase
    .from('students')
    .select('*, pets:student_pets(*)')
    .single();
    
  if (error) throw error;
  return data;
}

// Example: Purchase store item
export async function purchaseItem(itemId: string) {
  const { data, error } = await supabase
    .rpc('purchase_store_item', { 
      p_item_id: itemId 
    });
    
  if (error) throw error;
  return data;
}

// Example: Update pet stats
export async function feedPet(petId: string) {
  const { data, error } = await supabase
    .rpc('interact_with_pet', {
      p_pet_id: petId,
      p_interaction_type: 'feed'
    });
    
  if (error) throw error;
  return data;
}
```

## Environment Variables

Add these to your `.env` file:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Security Best Practices

1. **Never store passport codes in plain text** - Use secure session storage
2. **Validate passport code format** on the frontend before sending
   - Format: XXX-XXX where X is A-Z or 0-9
   - Auto-convert to uppercase for user convenience
   - Database enforces uniqueness and format validation
3. **Handle session expiry gracefully** - Auto redirect to login
4. **Clear sensitive data on logout** - Remove all localStorage items
5. **Use HTTPS in production** - Ensure all API calls are encrypted
6. **Case-insensitive passport codes** - Database auto-converts to uppercase
7. **No duplicate codes possible** - Database UNIQUE constraint prevents this

## Error Handling

```typescript
// utils/error-handler.ts
export function handleAuthError(error: any): string {
  if (error.message?.includes('Invalid passport code')) {
    return 'Invalid passport code. Please check and try again.';
  }
  
  if (error.message?.includes('Session expired')) {
    // Auto redirect to login
    window.location.href = '/student/login';
    return 'Session expired. Please log in again.';
  }
  
  if (error.message?.includes('Class full')) {
    return 'This class is full. Please contact your teacher.';
  }
  
  if (error.message?.includes('Name taken')) {
    return 'This name is already taken. Try adding your middle initial.';
  }
  
  return 'Something went wrong. Please try again.';
}
```

## Testing

```typescript
// __tests__/auth.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

describe('Authentication', () => {
  it('should handle student login', async () => {
    const { result } = renderHook(() => useAuth());
    
    // Mock successful login
    await result.current.login('OWL-9ON');
    
    await waitFor(() => {
      expect(result.current.user).toBeDefined();
      expect(result.current.user?.app_metadata?.student_id).toBeDefined();
    });
  });
});
```

## Migration from Legacy System

If you have existing passport codes stored differently:

```typescript
// Check for legacy format and migrate
const legacyPassport = localStorage.getItem('passport_code');
if (legacyPassport && !localStorage.getItem('animalgenius_passport')) {
  localStorage.setItem('animalgenius_passport', legacyPassport);
  localStorage.removeItem('passport_code');
}
```

## Troubleshooting

### Common Issues

1. **"No session found" error**
   - Check if user is logged in: `const { data: { user } } = await supabase.auth.getUser()`
   - Verify access token is being sent with requests

2. **CORS errors**
   - Ensure your domain is whitelisted in Supabase dashboard
   - Check Edge Function CORS headers

3. **Session not persisting**
   - Verify `persistSession: true` in Supabase client config
   - Check browser localStorage is not disabled

4. **Rate limiting**
   - Implement exponential backoff for retries
   - Cache frequently accessed data

5. **"Invalid passport code" with correct code**
   - Passport codes are case-insensitive (auto-uppercase)
   - Format must be XXX-XXX (6 characters with dash)
   - Check if student exists in database

6. **"Duplicate passport code" errors**
   - This should never happen with new security constraints
   - If it does, the generate_passport_code function will retry up to 100 times

## Next Steps

1. Implement the quiz flow components
2. Set up protected routes
3. Add session management
4. Test with multiple concurrent students
5. Monitor Edge Function performance