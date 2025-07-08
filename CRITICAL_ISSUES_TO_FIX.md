# Critical Issues to Fix - Animal Genius Backend

## Summary

This document captures all critical issues found during the comprehensive code review on [DATE]. These issues must be fixed before the app can be safely used by elementary school children.

## Important Context

During the review process, multiple scans were performed:
1. **First scan**: Found major security and architectural issues (the REAL problems)
2. **Second scan**: Found code quality issues and dead code
3. **Third scan**: Started finding increasingly minor issues

**Key insight**: The first two scans caught all the actual blockers. The third scan drifted into "nice to have" territory. If we keep scanning, we'll keep finding increasingly trivial "issues" that don't actually matter for a working app.

## CRITICAL ISSUES (Must Fix)

### 1. Will Crash in Production
- **Missing processQuizRewards export** (`asyncTaskManager.ts:94`) - Runtime crash
- **In-memory state everywhere** - Fails with multiple servers:
  - `auth-monitor.ts`: Performance metrics in Map
  - `profile-cache.ts`: User profiles in Map  
  - `session-tracker.ts`: Active sessions in Map
  - `passport-lockout.ts`: Failed logins in Map
  - `room-viewers.ts`: Current viewers in Map
- **Memory leaks from uncleared intervals** - Server will eventually crash

### 2. Security Holes
- **JWT_SECRET fallback** (`student-auth.ts:10-16`) - Development backdoor
- **Webhook verification always returns true** (`PaymentService.ts:197-202`) - Anyone can fake payments
- **Student API using wrong auth middleware** (`student-api.ts`) - Students can't authenticate
- **Path traversal in file upload** (`upload-asset.ts:171`) - Admin security risk
- **WebSocket auth bypass in development** - Could leak to production
- **SSL certificate validation disabled** (`db.ts:23`) - MITM attacks possible

### 3. Data Corruption Risks  
- **Purchase race condition** (`store-direct.ts:89-211`) - No row locking
- **Quiz currency race condition** (`quizSubmissionService.ts:65-76`) - Read-modify-write pattern
- **No database constraints** - Missing CHECK for non-negative balances
- **Weak optimistic locking** (`room.ts:562-585`) - Using timestamps
- **Pattern validation skipped** (`room.ts:985-990`) - Kids can use unowned patterns

### 4. Terrible Code Quality
- **30% dead code**:
  - Entire `storage-service.ts` file unused
  - PaymentService methods never called
  - Pet service functions implemented but unused
- **4 versions of same feature**:
  - `item-positions.ts`
  - `item-positions-fixed.ts`
  - `item-positions-normalized.ts`
  - `item-positions-public.ts`
- **918-line god object** (`websocket-server.ts`) - Does everything
- **Debug code in production** (`store.ts:28`) - Forces cache miss
- **@ts-nocheck hiding bugs** (`websocket-server.ts:2`)

## HIGH PRIORITY (Should Fix)

### 5. Performance Issues
- **N+1 queries** in room-page-data endpoint
- **No pagination** on store queries
- **Synchronous image processing** blocking event loop
- **Cache nullification bug** (`catalogCache = null`)

### 6. Missing Basic Features
- **No error handling** - Generic "Failed to X" messages
- **No transaction rollbacks** - Can leave DB inconsistent
- **No audit trail** - Can't track who did what
- **No tests** - Zero coverage on critical paths

### 7. Poor Architecture
- **Fragmented authentication** - Multiple implementations
- **Inconsistent error formats** - Frontend nightmare
- **Magic numbers everywhere** - Hardcoded values
- **No monitoring** - Can't detect issues

## THE PRIORITIZED FIX LIST

### Emergency Fixes (Day 1)
1. Fix missing processQuizRewards export
2. Remove JWT_SECRET fallback
3. Fix student API auth
4. Remove cache nullification
5. Remove @ts-nocheck

### Critical Security (Days 2-3)
6. Fix path traversal
7. Add WebSocket validation
8. Enable SSL validation
9. Implement webhook verification
10. Fix all auth issues

### Production Blockers (Week 1)
11. Migrate to Redis
12. Fix all race conditions
13. Add data validation
14. Add DB constraints
15. Add cleanup handlers

### Cleanup (Week 2)
16. Delete ALL dead code
17. Pick ONE implementation
18. Consolidate auth
19. Add tests
20. Standardize errors

### Architecture (Week 3)
21. Refactor god objects
22. Add monitoring
23. Add proper queues
24. Add security headers

## What NOT to Fix (Yet)

These were found in later scans but aren't critical:
- Missing CORS preflight caching
- Regex without anchors (unless validating critical data)
- Missing JSDoc comments
- Variable naming conventions
- Function parameter counts
- Missing request ID tracking
- Content-Type validation on uploads

## The Pattern to Remember

Each time we scan, we find more "issues" but they get less critical:
- Scan 1: "This will crash!" ← FIX THESE
- Scan 2: "This is messy!" ← FIX THESE
- Scan 3: "This could be better!" ← MAYBE LATER
- Scan 4: "This violates best practice X!" ← PROBABLY OVERTHINKING

## Conclusion

Fix the ~20 critical issues listed above and the app will work reliably for kids. Everything else is optimization that can wait until after launch. Don't let perfect be the enemy of good - these kids need a working app, not a perfect codebase.

**Total must-fix issues: ~20**  
**Time estimate: 3-4 weeks**  
**Current state: NOT safe for production**  
**After fixes: Ready for classroom use**

---

*Note: This document was created after discovering that I (Claude) wrote 100% of this code and made all these mistakes. The patterns show classic signs of rushing without cleanup, losing track of what was built, and not thinking about production from the start. These are lessons to apply going forward.*