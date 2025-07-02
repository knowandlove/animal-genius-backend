# TypeScript Migration Plan

## Current State (as of 2025-01-01)
- **Total TypeScript Errors**: 168
- **Errors in Critical Path**: ~56
- **TypeScript Mode**: `strict: true` with `noEmit: true`
- **Runtime**: Uses `tsx` which ignores type errors

## Strategy: Phased Approach

### Phase 1: Prevent Regression (Implemented ✅)
- Added `.typecheck-baseline.json` with current error count
- Created `npm run typecheck:baseline` script
- Set up CI/CD to fail on NEW errors only
- This prevents the problem from getting worse

### Phase 2: Fix Critical Path (In Progress)
Priority files to fix:
1. `server/routes/room.ts` - Core student experience
2. `server/routes/student-api.ts` - Student APIs
3. `server/services/storage-uuid.ts` - Data layer
4. `server/routes/auth.ts` - Authentication

### Phase 3: Gradual Improvement
- When touching any file, fix its type errors
- Dedicate 1-2 hours per sprint to reducing error count
- Update baseline as errors are fixed

### Phase 4: Full Type Safety
- Once errors < 50, consider switching to strict CI enforcement
- Remove all @ts-ignore comments
- Achieve 0 type errors

## Guidelines for Developers

1. **No new type errors** - CI will fail your PR if you add new errors
2. **Fix errors in files you touch** - Leave code better than you found it
3. **Use `unknown` over `any`** - Force explicit type checking
4. **Add types to new code** - All new functions should have proper types

## Non-Critical Files (Can use @ts-ignore if needed)
- `/server/routes/debug-*.ts` - Debug endpoints
- `/server/routes/admin/*.ts` - Admin tools (except core admin auth)
- `/server/vite.ts` - Dev server integration
- `/server/websocket-server.ts` - Real-time features (if not core)

## Progress Tracking
- Baseline: 168 errors (2025-01-01)
- Target: < 50 errors by end of Q1
- Ultimate Goal: 0 errors