# Testing & Monitoring Scripts

**Last Updated:** July 29, 2025

## Installation

First, install the required dependencies:

```bash
cd animal-genius-backend
npm install --save-dev @faker-js/faker
```

## Available Scripts

### 1. Load Testing (`load-test.js`)
Simulates multiple students taking quizzes simultaneously.

```bash
# Test with 50 students (default)
node scripts/load-test.js

# Test with 100 students
NUM_STUDENTS=100 node scripts/load-test.js

# Test against production
API_URL=https://your-api.com node scripts/load-test.js
```

**What to watch for:**
- Success rate below 95% indicates problems
- High error rate might mean rate limiting or DB issues
- Monitor your backend logs during the test

### 2. Database Stress Test (`db-stress-test.js`)
Tests database connection pool limits.

```bash
node scripts/db-stress-test.js
```

**Warning signs:**
- "waiting > 0" means connection pool exhaustion
- Failed queries indicate pool size too small
- Slow queries (>100ms average) need optimization

### 3. Sentry Error Testing (`test-sentry.js`)
Generates errors to understand Sentry dashboard.

```bash
node scripts/test-sentry.js
```

**Check Sentry for:**
- Error grouping and categorization
- Stack traces and breadcrumbs
- User context and session info
- Performance monitoring data

### 4. Health Monitoring (`monitor-health.js`)
Real-time health dashboard for your app.

```bash
# Run continuously
node scripts/monitor-health.js

# Run in background
nohup node scripts/monitor-health.js > health.log 2>&1 &
```

**Key metrics:**
- API response times (should be <200ms)
- Database query times (should be <50ms)
- Connection pool usage (idle should be >0)
- Error rates (should be <1%)

## Understanding Sentry

### What Sentry Tracks:
1. **Errors**: Uncaught exceptions, API errors, validation failures
2. **Performance**: Slow queries, API response times, bottlenecks
3. **User Sessions**: Which users encounter errors
4. **Release Tracking**: Which code version has issues

### Sentry Dashboard Key Areas:
- **Issues**: Grouped errors with stack traces
- **Performance**: Transaction times and slow queries
- **Discover**: Custom queries on your data
- **Dashboards**: Create custom monitoring views

### Setting Up Alerts:
1. Go to Alerts → Create Alert Rule
2. Set conditions (e.g., error rate > 5%)
3. Add actions (email, Slack, etc.)

## Load Testing Scenarios

### Scenario 1: Normal Load
```bash
# 50 students over 5 minutes
node scripts/load-test.js
```

### Scenario 2: Class Rush
```bash
# 200 students in 1 minute (beginning of class)
NUM_STUDENTS=200 DELAY_BETWEEN=300 node scripts/load-test.js
```

### Scenario 3: Sustained Load
```bash
# Run for 1 hour with continuous students
while true; do
  NUM_STUDENTS=20 node scripts/load-test.js
  sleep 60
done
```

## Performance Benchmarks

Based on your current setup, aim for:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| API Response Time | <200ms | 200-500ms | >500ms |
| DB Query Time | <50ms | 50-200ms | >200ms |
| Success Rate | >99% | 95-99% | <95% |
| DB Pool Waiting | 0 | 1-5 | >5 |
| Error Rate | <0.1% | 0.1-1% | >1% |

## Troubleshooting Common Issues

### High API Response Times
- Check database query performance
- Look for N+1 query problems
- Add caching for repeated queries

### Database Pool Exhaustion
- Increase pool size in `.env`
- Check for connection leaks
- Optimize long-running queries

### Memory Leaks
- Monitor Node.js heap usage
- Check for event listener leaks
- Use `--inspect` flag for profiling

### Rate Limiting Issues
- Adjust rate limits for testing
- Implement request queuing
- Add retry logic with backoff