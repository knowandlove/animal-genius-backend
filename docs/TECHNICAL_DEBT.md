# Technical Debt - Class Island Implementation

This document tracks technical debt and future improvements identified during the Class Island implementation review.

## Security & Architecture

### 1. Consolidate Duplicated Auth Middleware
**Priority**: Medium  
**Location**: `server/middleware/room-access.ts`, `server/middleware/student-auth.ts`  
**Issue**: JWT verification logic is duplicated between middlewares  
**Solution**: Create `optionalStudentSession` middleware to handle cases where auth may or may not be present  

### 2. Remove Unscoped Authentication Endpoint
**Priority**: Medium  
**Location**: `server/routes/room-secure.ts:103`  
**Issue**: `/api/room/authenticate` allows authentication without class context  
**Solution**: Remove this endpoint and use only the class-scoped version  

## Code Quality

### 3. Refactor Database Queries into Repository Pattern
**Priority**: Low  
**Location**: Multiple route files  
**Issue**: Similar student data queries are repeated across endpoints  
**Solution**: Create a `StudentRepository` class with reusable query methods  

### 4. Simplify Complex State Management
**Priority**: Medium  
**Location**: `frontend/src/pages/StudentRoom.tsx`  
**Issue**: Complex nested if/else blocks for handling auth and error states  
**Solution**: Use react-query's built-in error handling and simplify render logic  

## Performance

### 5. Implement Virtualization for Large Classes
**Priority**: Low  
**Location**: `frontend/src/pages/ClassIsland.tsx`  
**Issue**: Rendering 100+ student cards could cause performance issues  
**Solution**: Use `@tanstack/react-virtual` for windowing  

### 6. Add Database Indexes
**Priority**: Medium  
**Issue**: Missing indexes on frequently queried columns  
**Solution**: Add indexes for:
- `students.classId`
- `students.passportCode`
- `classes.classCode`

## User Experience

### 7. Accessibility Improvements
**Priority**: High  
**Location**: All frontend components  
**Issues**:
- Missing ARIA labels and live regions
- No reduced motion support
- Limited keyboard navigation
**Solution**: 
- Add ARIA-live for auth errors
- Respect `prefers-reduced-motion`
- Ensure all interactive elements are keyboard accessible

### 8. Better Error Messages
**Priority**: Medium  
**Location**: Frontend error handling  
**Issue**: Generic error messages not kid-friendly  
**Solution**: Create age-appropriate error messages with helpful suggestions  

### 9. Mobile Responsive Improvements
**Priority**: Medium  
**Location**: Dialog components  
**Issue**: Some dialogs don't scale well on very small screens  
**Solution**: Test and adjust breakpoints for 320px+ screens  

## Future Features

### 10. Offline Support
**Priority**: Low  
**Issue**: No offline capability for poor connectivity  
**Solution**: Implement service worker with basic caching  

### 11. Session Management UI
**Priority**: Low  
**Issue**: No way for students to see/manage their session  
**Solution**: Add "Logged in as" indicator and logout option  

### 12. Batch Operations
**Priority**: Low  
**Issue**: No way to perform bulk actions (e.g., reset all rooms)  
**Solution**: Add teacher admin tools for batch operations  

## Testing

### 13. Add Integration Tests
**Priority**: High  
**Coverage Needed**:
- Authentication flow
- Cross-class access prevention
- Room visibility rules
- Session persistence

### 14. Add E2E Tests
**Priority**: Medium  
**Scenarios**:
- Student journey from class URL to room editing
- Teacher viewing class island
- Privacy settings enforcement

## Documentation

### 15. API Documentation
**Priority**: Medium  
**Need**: Document all API endpoints with examples  

### 16. Deployment Guide
**Priority**: High  
**Need**: Document environment variables and deployment steps  

---

## Completed Fixes

✅ Fixed teacher auth to use admin client  
✅ Removed insecure JWT fallbacks  
✅ Added caching to public endpoints  
✅ Added debouncing to prevent race conditions  

## Next Sprint Priorities

1. Accessibility audit and fixes (high impact on usability)
2. Integration tests (ensure security features work correctly)
3. Database indexes (quick performance win)
4. Kid-friendly error messages (improve user experience)