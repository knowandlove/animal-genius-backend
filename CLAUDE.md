# CLAUDE.md - AI Assistant Context

## Quick Start for AI Assistants

This codebase implements an **anonymous-first authentication system** where students use **passport codes** (format: `XXX-XXX`) instead of traditional accounts.

### Critical Understanding Points

1. **Students are created AFTER taking a quiz**, not before
2. **Passport codes are the ONLY credential** - no passwords
3. **Each student belongs to exactly ONE class**
4. **Animal types are assigned based on quiz answers**

### Key Commands to Run

When making code changes, ALWAYS run:
```bash
npm run lint
npm run typecheck
```

### Server Configuration

- **Backend runs on port 5001** (configured in `/server/config/env.ts`)
- Start backend: `npm run dev`
- Frontend runs on port 5173 (separate Vite app)

### Authentication Flow

1. Student enters class code → Takes quiz → Receives passport code
2. Passport code format: `OTT-X9K` (animal prefix + random suffix)
3. All API requests use header: `X-Passport-Code: OTT-X9K`

### Database Key Points

- **Service role needs GRANT permissions** (not just RLS bypass)
- **Passport codes MUST be UNIQUE** (security critical)
- **Use table prefixes in JOINs** to avoid ambiguity

### Common Issues & Fixes

1. **"Permission denied"** → Run `/scripts/GRANT-PERMISSIONS-FIX.sql`
2. **"Column ambiguous"** → Use `c.class_code` not just `class_code`
3. **Edge Function fails** → Check Supabase secrets are set

### File Locations

- Database functions: `/supabase/migrations/20250111_anonymous_auth_final.sql`
- Auth middleware: `/server/middleware/passport-auth.ts`
- Edge Functions: `/supabase/functions/`
- Frontend auth: `/src/lib/passport-auth.ts`

### Testing Authentication

```bash
# Test passport validation
curl -X POST http://localhost:5001/api/student-passport/validate \
  -H "Content-Type: application/json" \
  -d '{"passportCode": "OTT-X9K"}'
```

### Environment Variables

Backend needs:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Edge Functions need (via `supabase secrets set`):
- `REDIS_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Security Critical

1. **NEVER remove UNIQUE constraint on passport_code**
2. **NEVER add weak fallbacks in generate_passport_code**
3. **ALWAYS use SECURITY DEFINER with search_path**

### Quick SQL Checks

```sql
-- Find student by passport
SELECT * FROM students WHERE passport_code = 'OTT-X9K';

-- Check class status
SELECT * FROM classes WHERE class_code = 'LT0-33B' AND is_active = true;

-- Debug auth issues
SELECT * FROM auth.users WHERE email LIKE '%@anonymous.local';
```

For comprehensive documentation, see `/docs/AUTHENTICATION_SYSTEM_DOCUMENTATION.md`