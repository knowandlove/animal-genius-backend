# Monitoring and Error Tracking

## Overview

We've implemented a comprehensive monitoring and error tracking system that provides:
- Real-time error tracking and aggregation
- HTTP request metrics and performance monitoring
- System health checks
- Dashboard for monitoring application status

## Components

### 1. Error Tracking Service (`/server/monitoring/error-tracker.ts`)

Tracks and aggregates application errors:
- Collects all errors with context (endpoint, user, request ID)
- Maintains error statistics and trends
- Provides detailed error analysis
- Automatically cleans up old errors after 7 days

### 2. HTTP Metrics (`/server/middleware/observability.ts`)

Tracks HTTP request performance:
- Request duration and response times
- Status code distribution
- Error rates
- Slowest endpoints
- Request volume by method

### 3. Health Checks (`/server/routes/health.ts`)

Multiple health check endpoints:
- `/api/health` - Basic health check
- `/api/health/live` - Liveness probe
- `/api/health/ready` - Readiness probe with subsystem checks
- `/api/health/detailed` - Detailed health information (admin only)

### 4. Monitoring Dashboard (`/server/routes/monitoring.ts`)

Comprehensive monitoring endpoints:
- `/api/monitoring/metrics` - System and HTTP metrics
- `/api/monitoring/errors` - Error tracking summary
- `/api/monitoring/errors/:code` - Detailed error analysis
- `/api/monitoring/dashboard` - Full dashboard view with KPIs and alerts

## Usage

### Viewing the Dashboard

```bash
# Get dashboard overview (requires authentication)
GET /api/monitoring/dashboard

# Response includes:
{
  "kpis": {
    "uptime": 3600,
    "activeConnections": 25,
    "requestsPerMinute": 120,
    "errorRate": 0.5,
    "averageResponseTime": 45,
    "memoryUsage": 256
  },
  "alerts": [
    {
      "level": "warning",
      "message": "High error rate: 5.2 errors/minute",
      "metric": "errorRate"
    }
  ],
  "charts": {
    "requestsOverTime": [...],
    "errorsOverTime": {...},
    "slowestEndpoints": [...],
    "errorsByCode": {...}
  }
}
```

### Checking System Health

```bash
# Basic health check
GET /api/health

# Readiness check (includes database)
GET /api/health/ready

# Detailed health (admin only)
GET /api/health/detailed
```

### Analyzing Errors

```bash
# Get error summary
GET /api/monitoring/errors

# Get details for specific error code
GET /api/monitoring/errors/AUTH_001
```

## Error Codes Reference

Errors are automatically tracked with these codes:
- `AUTH_XXX` - Authentication errors
- `VAL_XXX` - Validation errors
- `BIZ_XXX` - Business logic errors
- `SYS_XXX` - System errors
- `RES_XXX` - Resource errors

## Alerts and Thresholds

The system automatically generates alerts when:
- Error rate exceeds 5 errors/minute
- Average response time exceeds 1000ms
- Memory usage exceeds 500MB
- Database response time exceeds 1000ms

## Performance Impact

The monitoring system has minimal overhead:
- Error tracking: ~1ms per error
- HTTP metrics: <1ms per request
- Health checks: Database check adds ~5-10ms
- Memory usage: ~10MB for storing recent metrics

## Integration with Error Handler

All errors are automatically tracked through the global error handler:
```typescript
// In error-handler.ts
errorTracker.trackError({
  code: appError.code,
  message: appError.message,
  statusCode: appError.statusCode,
  endpoint: req.path,
  userId: req.user?.userId,
  requestId,
  stack: process.env.NODE_ENV === 'development' ? appError.stack : undefined
});
```

## Best Practices

1. **Check dashboard regularly** - Monitor for trends and anomalies
2. **Set up alerts** - Use the alerts API to integrate with monitoring tools
3. **Review slow endpoints** - Focus optimization on endpoints in the slowest list
4. **Analyze error patterns** - Use error details to identify systemic issues
5. **Monitor after deployments** - Watch error rates and response times closely

## Future Enhancements

Potential improvements:
1. Integration with external monitoring services (Datadog, New Relic)
2. Custom alert thresholds per endpoint
3. Anomaly detection for error patterns
4. Performance budgets and SLA tracking
5. User session tracking for error correlation