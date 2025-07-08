# Testing the Scaling Fixes

## 1. Test Database Connection Pool

Start the server and monitor the logs:
```bash
npm run dev
```

Look for this log message showing the increased pool:
```
📊 DB Pool Stats: { total: X, idle: Y, waiting: 0, max: 50 }
```

## 2. Test Class Analytics Performance

### Before Optimization:
Time how long the class analytics endpoint takes with many students

### After Optimization:
```bash
# Replace CLASS_ID with an actual class ID
curl -X GET http://localhost:5001/api/classes/CLASS_ID/analytics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -w "\nTime: %{time_total}s\n"
```

Should be <500ms instead of 5+ seconds

## 3. Test WebSocket Connection Limits

### Test Global Limit:
```javascript
// Quick test script - save as test-ws-limits.js
const WebSocket = require('ws');

async function testConnectionLimit() {
  const connections = [];
  
  for (let i = 0; i < 510; i++) {
    try {
      const ws = new WebSocket('ws://localhost:5001/ws/game');
      
      ws.on('open', () => {
        console.log(`Connection ${i + 1} opened`);
      });
      
      ws.on('close', (code, reason) => {
        console.log(`Connection ${i + 1} closed: ${code} ${reason}`);
      });
      
      connections.push(ws);
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      console.error(`Failed at connection ${i + 1}:`, error.message);
      break;
    }
  }
  
  console.log(`Successfully opened ${connections.length} connections`);
  
  // Cleanup
  setTimeout(() => {
    connections.forEach(ws => ws.close());
  }, 5000);
}

testConnectionLimit();
```

Run with: `node test-ws-limits.js`

You should see connections rejected after 500.

### Test Per-IP Limit:
The same script will also test the per-IP limit (10 connections from same IP).

## 4. Test Student Dashboard Caching

```bash
# First request (will be slow, hits database)
time curl http://localhost:5001/api/student/dashboard \
  -H "Authorization: Bearer STUDENT_SESSION_TOKEN"

# Second request (should be fast, hits cache)
time curl http://localhost:5001/api/student/dashboard \
  -H "Authorization: Bearer STUDENT_SESSION_TOKEN"
```

Look for "Cache hit for student dashboard" in server logs.

## 5. Monitor Error Tracking

Check the new error summary endpoint:
```bash
curl http://localhost:5001/api/admin/errors/summary \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

## Expected Results:

✅ Database pool shows max of 50  
✅ Class analytics loads in <500ms  
✅ WebSocket connections limited to 500 total  
✅ Per-IP connections limited to 10  
✅ Student dashboard cached for 5 minutes  
✅ Error tracking shows recent errors

## Production Monitoring:

After deployment, monitor:
- `/api/admin/quick-stats` - Shows performance metrics
- `/api/health/ready` - Shows system health
- Database connection count in Supabase dashboard
- Server memory usage (should stay under 1GB)