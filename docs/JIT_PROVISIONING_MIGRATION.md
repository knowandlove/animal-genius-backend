# JIT Provisioning Migration Plan

## Overview

This document outlines the migration from dual authentication systems (Supabase for teachers, JWT for students) to a unified Supabase Auth system with Just-In-Time (JIT) provisioning.

## Current State

### Teacher Authentication
- Uses Supabase Auth with email/password
- Profiles stored in `profiles` table
- Session managed by Supabase JWT tokens

### Student Authentication  
- Uses passport codes (format: XXX-XXX)
- Custom JWT tokens with 24-hour expiry
- Session stored in httpOnly cookies
- No Supabase accounts

## Target State

### Unified Authentication
- All users (teachers and students) use Supabase Auth
- Students automatically provisioned on first login
- Backward compatibility during migration
- Single auth middleware for all routes

## Migration Strategy

### Phase 1: JIT Infrastructure (COMPLETED)
✅ Created JIT provisioning service
✅ Created unified auth middleware  
✅ Created unified auth routes
✅ Backward compatibility for legacy student sessions

### Phase 2: Gradual Migration (IN PROGRESS)
1. **Enable dual-auth mode**
   - Legacy student JWT continues to work
   - New logins create Supabase accounts
   - Sessions automatically migrate on next login

2. **Update frontend to handle migration**
   - Detect `migrationRequired` flag
   - Request new Supabase token
   - Store in standard auth header

3. **Monitor migration progress**
   - Track students with/without Supabase accounts
   - Log migration successes/failures
   - Identify any issues

### Phase 3: Route Updates
1. **Update student routes to use unified auth**
   ```typescript
   // Before
   app.get("/api/student/dashboard", requireStudentSession, ...)
   
   // After  
   app.get("/api/student/dashboard", requireUnifiedAuth, requireStudent, ...)
   ```

2. **Update teacher routes**
   ```typescript
   // Before
   app.get("/api/classes", requireAuth, ...)
   
   // After
   app.get("/api/classes", requireUnifiedAuth, requireTeacher, ...)
   ```

### Phase 4: Cleanup
1. Remove legacy auth middleware
2. Remove JWT secret dependency for students
3. Update documentation

## Implementation Details

### Student Provisioning Flow
1. Student enters passport code
2. System verifies passport code against `students` table
3. If valid:
   - Create Supabase user with internal email
   - Create profile with student metadata
   - Generate session token
   - Set legacy cookie (if enabled)

### Security Considerations
- Passport codes remain the primary student credential
- Internal emails not exposed to students
- Student metadata stored in user_metadata
- Rate limiting on passport attempts
- Lockout after failed attempts

### Database Changes
No schema changes required. The `profiles` table already supports both user types through the metadata JSONB column.

### Configuration
```env
# Enable legacy auth during migration
ENABLE_LEGACY_STUDENT_AUTH=true

# Migration monitoring
LOG_AUTH_MIGRATIONS=true
```

## Rollback Plan

If issues arise:
1. Disable unified auth routes
2. Revert to original auth middleware
3. Clear any partial Supabase accounts
4. Investigate and fix issues

## Success Metrics

- 100% of new student logins create Supabase accounts
- No increase in authentication errors
- Gradual decrease in legacy JWT usage
- All routes using unified auth

## Timeline

- Week 1: Deploy JIT infrastructure ✅
- Week 2: Enable dual-auth mode, monitor
- Week 3: Update routes progressively  
- Week 4: Complete migration, remove legacy code