# 🔄 Supabase Auth Migration Guide

This guide walks you through migrating from the custom auth system to Supabase Auth.

## Prerequisites

1. A Supabase project set up
2. Access to Supabase dashboard
3. Database backup (just in case!)

## Step 1: Environment Variables

Add these to your `.env` file:

```bash
# Existing variables
DATABASE_URL=your-existing-supabase-url
JWT_SECRET=your-existing-jwt-secret

# New Supabase Auth variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 2: Install Dependencies

```bash
cd animal-genius-backend
npm install @supabase/supabase-js
```

## Step 3: Database Migration

### 3.1 Apply the Schema Changes

The migration has been applied to create:
- `profiles` table linked to `auth.users`
- UUID columns for foreign keys
- Helper functions for RLS
- Row Level Security policies

✅ This is already done!

### 3.2 Migrate Existing Users

Run the user migration script:

```bash
npx tsx migrations/migrate-users-to-supabase.ts
```

This will:
- Create users in Supabase Auth
- Map old numeric IDs to new UUIDs
- Send password reset emails to all users

### 3.3 Update Foreign Keys

After users are migrated, run the SQL to update foreign keys:

```sql
-- This is already in migrate_to_uuid_keys.sql
-- Run it in Supabase SQL editor
```

## Step 4: Code Updates

### 4.1 Update Backend Routes

Replace the auth endpoints in `routes.ts` with the new Supabase auth routes:

```typescript
// Import the new auth routes
import authRoutes from './routes/auth';

// Replace old auth endpoints with:
app.use('/api', authRoutes);
```

### 4.2 Update Storage Methods

The storage.ts file needs updates to:
- Use UUIDs instead of numeric IDs
- Reference `profiles` table instead of `users`
- Remove password-related methods

### 4.3 Update Frontend

The frontend needs to:
- Store Supabase access tokens instead of custom JWTs
- Handle Supabase session refresh
- Update API calls to use new token format

## Step 5: Testing

### 5.1 Test Authentication

1. Try registering a new user
2. Try logging in
3. Verify tokens work with protected endpoints

### 5.2 Test Data Access

1. Verify teachers can see their classes
2. Verify RLS policies are working
3. Test admin functions

### 5.3 Test Password Reset

1. Request password reset
2. Check email delivery
3. Verify reset works

## Step 6: Rollback Plan

If something goes wrong:

1. Keep the old `users` table intact
2. The UUID columns are additional (not replacing old ones yet)
3. Can switch back by updating environment variables

## Step 7: Final Cleanup (After Testing)

Once everything is working:

1. Drop old numeric ID columns
2. Remove old `users` table
3. Clean up old auth code

## Common Issues & Solutions

### Issue: "User already exists"
**Solution**: User was already migrated, check the mapping table

### Issue: "Invalid token"
**Solution**: Frontend might be sending old JWT format, update to Supabase tokens

### Issue: "Access denied"
**Solution**: Check RLS policies, ensure `teacher_uuid` is set correctly

### Issue: Password reset not working
**Solution**: Configure email settings in Supabase dashboard

## Benefits After Migration

✅ **Better Security**: Supabase handles auth complexities
✅ **RLS Policies**: Database-level security
✅ **Password Recovery**: Built-in email flows
✅ **Session Management**: Automatic token refresh
✅ **Future Features**: Social logins, MFA, etc.

## Need Help?

1. Check Supabase docs: https://supabase.com/docs/guides/auth
2. Review the migration scripts in `/migrations`
3. Test in development first!

Remember: Take it slow, test thoroughly, and keep backups!
