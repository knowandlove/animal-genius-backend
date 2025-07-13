# Deployment Instructions for Anonymous Authentication

## Prerequisites

1. Supabase CLI installed (`npm install -g supabase`)
2. Access to your Supabase project
3. Database backup (just in case)

## Step 1: Deploy Database Migration

```bash
# From the project root
cd /Users/jasonlackey/Desktop/KALPRO/animal-genius-backend

# Push the migration to Supabase
supabase db push
```

This will run the `20250111_anonymous_auth_setup.sql` migration which:
- Adds new columns to classes and students tables
- Creates database functions for quiz submission
- Sets up RLS policies

## Step 2: Set Up Rate Limiting (REQUIRED!)

Before deploying Edge Functions, set up Upstash Redis:

1. Create account at [upstash.com](https://upstash.com)
2. Create a Redis database
3. Get your REST URL and Token
4. Add to Supabase:

```bash
supabase secrets set UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=your-token-here
```

See [UPSTASH_REDIS_SETUP.md](./UPSTASH_REDIS_SETUP.md) for detailed instructions.

## Step 3: Deploy Edge Functions

```bash
# Deploy the quiz check eligibility function
supabase functions deploy quiz-check-eligibility

# Deploy the quiz submission function
supabase functions deploy quiz-submit  

# Deploy the student login function
supabase functions deploy student-login
```

## Step 4: Verify Environment Variables

Make sure your backend has these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 5: Deploy Backend Changes

The backend code has been updated to support the new auth system:
- Unified auth middleware now handles anonymous students
- All student routes support the new JWT tokens
- Currency, store, and pet routes all updated

Deploy your backend as usual (your deployment method).

## Step 6: Test the Flow

### 1. Create a Test Class (as Teacher)
```bash
# Use your admin interface or API to create a class
# Note the class code (e.g., MATH101)
```

### 2. Test Quiz Flow
- Navigate to `/quiz/MATH101` in frontend
- Enter student name and grade
- Complete the quiz
- Verify you receive a passport code

### 3. Test Student Login
```bash
# Test the Edge Function directly
curl -X POST https://your-project.supabase.co/functions/v1/student-login \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"passportCode": "XXX-XXX"}'
```

### 4. Test Authenticated Endpoints
Use the JWT token from login to test:
- Store catalog: `GET /api/store/catalog`
- Student room: `GET /api/room-page-data/XXX-XXX`
- Pet interactions: `POST /api/pets/interact`

## Step 7: Migrate Existing Students (if any)

If you have existing students without auth users:

```bash
# First, do a dry run to see what will happen
npm run migrate:students

# Then run with confirmation
npm run migrate:students -- --confirm
```

## Step 8: Monitor and Verify

1. Check Supabase dashboard for:
   - New auth users being created
   - Edge Function invocations
   - Any errors in logs

2. Monitor backend logs for:
   - Successful authentications
   - Any auth errors

## Rollback Plan

If something goes wrong:

1. **Database**: Supabase keeps automatic backups
2. **Edge Functions**: Keep previous versions in git
3. **Backend**: Can redeploy previous version

## Important Notes

- Students created before this deployment will need migration
- Passport codes are case-sensitive (XXX-XXX format)
- Each student has an anonymous Supabase user
- Rate limiting should be added before full production launch

## Next Steps After Deployment

1. **Add Rate Limiting**:
   - Set up Upstash Redis account
   - Add Redis credentials to Edge Function secrets
   - Update Edge Functions with rate limiting code

2. **Monitor First Real Class**:
   - Watch for any authentication errors
   - Check quiz submission success rate
   - Monitor Edge Function performance

3. **Teacher Training**:
   - Explain new flow to teachers
   - Show how to handle "name taken" errors
   - Demonstrate class capacity limits

## Troubleshooting

### "Invalid passport code" errors
- Check passport code format (XXX-XXX)
- Verify student exists in database
- Check if student has user_id populated

### "No session found" errors  
- Ensure JWT token is being sent in Authorization header
- Verify token hasn't expired (8 hour TTL)
- Check Supabase Auth logs

### Quiz submission failures
- Check class code is valid and active
- Verify class isn't full
- Look for name collisions

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Review backend application logs
3. Verify database migration completed successfully