# Upstash Redis Setup for Rate Limiting

## Why Upstash?

Upstash is a serverless Redis service that's perfect for Edge Functions because:
- HTTP/REST API (no persistent connections needed)
- Pay-per-request pricing (cost effective)
- Global edge locations
- Works perfectly with Deno/Edge Functions

## Setup Instructions

### 1. Create Upstash Account

1. Go to [upstash.com](https://upstash.com)
2. Sign up for a free account
3. Verify your email

### 2. Create Redis Database

1. In Upstash Console, click "Create Database"
2. Choose configuration:
   - **Name**: `animal-genius-rate-limit`
   - **Region**: Choose closest to your Supabase region
   - **Type**: Regional (or Global for multi-region)
3. Click "Create"

### 3. Get Credentials

After creation, you'll see:
- **REST URL**: `https://xxx.upstash.io`
- **REST Token**: `AX3lA...` (long string)

Save these - you'll need them for the Edge Functions.

### 4. Add to Supabase Edge Functions

```bash
# Set the secrets for your Edge Functions
supabase secrets set UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=AX3lA...
```

### 5. Verify Setup

After deploying Edge Functions with rate limiting:

```bash
# Test rate limiting is working
curl -X POST https://your-project.supabase.co/functions/v1/student-login \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"passportCode": "TEST-123"}' \
  -v

# Look for rate limit headers in response:
# X-RateLimit-Limit: 1
# X-RateLimit-Remaining: 4
# X-RateLimit-Reset: 1705339200000
```

## Rate Limit Configuration

Current limits set in the code:

### Student Login
- **Per IP**: 5 attempts per minute
- **Per Passport Code**: 10 attempts per hour

### Quiz Submission  
- **Per IP**: 10 submissions per minute
- **Per Class**: 50 submissions per hour

### Eligibility Check
- **Per IP**: 20 checks per minute

## Monitoring

In Upstash Console you can see:
- Request count
- Data usage
- Latency metrics
- Error rates

## Testing Rate Limits

```bash
# Test script to verify rate limiting
for i in {1..10}; do
  echo "Attempt $i:"
  curl -X POST https://your-project.supabase.co/functions/v1/student-login \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"passportCode": "XXX-999"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 1
done
```

After 5 attempts within a minute, you should get 429 errors.

## Cost Estimation

With Upstash free tier:
- 10,000 requests/day free
- Perfect for development and small schools

For production:
- Pay-as-you-go: $0.2 per 100K requests
- Example: 1000 students × 10 logins/day = 10K requests = ~$0.02/day

## Fallback Behavior

If Redis is unavailable or not configured:
- Edge Functions will log a warning
- Requests will be allowed (fail open)
- This ensures the system works during development

## Production Checklist

- [ ] Upstash account created
- [ ] Redis database provisioned
- [ ] Secrets added to Supabase
- [ ] Edge Functions deployed
- [ ] Rate limiting tested
- [ ] Monitoring dashboard bookmarked

## Troubleshooting

### "Upstash Redis not configured" warning
- Check environment variables are set correctly
- Verify secrets in Supabase dashboard

### Rate limits not working
- Check Redis connection in Upstash console
- Verify IP detection is working
- Check for typos in Redis URL/token

### Getting 429 errors too quickly
- Adjust limits in `_shared/rate-limit.ts`
- Consider different limits for development vs production