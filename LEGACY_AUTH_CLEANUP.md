# Legacy Authentication Cleanup Plan

## Files to DELETE completely:

### 1. Auth Cleanup Utilities (No longer needed)
- `/src/lib/auth-cleanup.ts` - JWT token cleanup utilities
- `/src/lib/auth-utils.ts` - Legacy authentication utilities with token expiration

### 2. Traditional Teacher Authentication (Replace with Supabase Auth)
- `/src/pages/teacher-login.tsx` - Traditional email/password login page
- `/src/pages/teacher-registration.tsx` - Traditional registration page
- `/src/hooks/useAuth.ts` - Legacy JWT-based authentication hook

## Files to KEEP but UPDATE:

### 1. Student Authentication (Already Modernized)
- `/src/lib/passport-auth.ts` ✅ Already using new passport system
- `/src/hooks/useStudentAuth.ts` ✅ Already using passport codes
- `/src/pages/StudentLogin.tsx` ✅ Already using passport codes
- `/src/components/PassportCodeEntry.tsx` ✅ Part of new system

### 2. Student-specific Files (Keep as-is)
- `/src/lib/student-auth.ts` ✅ Already using passport system
- `/src/pages/StudentDashboard.tsx` ✅ Already using passport system
- `/src/pages/StudentRoom.tsx` ✅ Already using passport system

## What Should Replace Removed Files:

### Replace teacher-login.tsx with Supabase Auth
- Use Supabase's built-in authentication
- Remove custom JWT token handling
- Update to use Supabase session management

### Replace useAuth.ts with Supabase Auth Hook
- Use `@supabase/auth-helpers-react` or similar
- Remove custom token storage logic
- Integrate with existing Supabase client

## API Endpoints to Check:

### Backend Authentication Routes (Need to verify)
- Check if `/api/auth/login` is used by teacher login
- Check if `/api/me` is used by useAuth hook
- These should be replaced with Supabase Auth

## Summary:

**Safe to Delete:** 3 files (auth-cleanup.ts, auth-utils.ts, teacher-login.tsx, teacher-registration.tsx, useAuth.ts)
**Need to Update:** Teacher authentication to use Supabase Auth instead of custom JWT
**Keep:** All student passport-based authentication (already modernized)

The student authentication system is already fully modernized with passport codes. Only the teacher authentication system still uses legacy JWT tokens.