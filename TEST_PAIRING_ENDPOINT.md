# Testing the Non-Blocking Pairing Endpoint

## What We Fixed

Previously, the pairing algorithm was running synchronously in the request handler:
```typescript
// OLD CODE - BLOCKS EVENT LOOP!
const pairings = generatePairings(allSubmissions); // O(n²) - freezes server
res.json(pairings);
```

Now it runs in a background job:
```typescript
// NEW CODE - NON-BLOCKING!
const job = await pairingQueue.add('generate-pairings', { classId });
res.status(202).json({
  status: 'processing',
  message: 'Pairings generation started. Please check back in a moment.',
  jobId: job.id
});
```

## How to Test

### 1. Request Pairings (Returns Immediately)
```bash
GET /api/classes/{classId}/pairings

Response (202 Accepted):
{
  "status": "processing",
  "message": "Pairings generation started. Please check back in a moment.",
  "jobId": "1"
}
```

### 2. Check Job Status
```bash
GET /api/jobs/{jobId}/status

Response:
{
  "id": "1",
  "state": "completed",
  "progress": 0,
  "data": { "classId": "abc123" },
  "result": {
    "dynamicDuos": [...],
    "puzzlePairings": [...],
    "soloWorkers": [...]
  }
}
```

### 3. Get Results (After Processing)
```bash
GET /api/classes/{classId}/pairings

Response (200 OK - from cache):
{
  "dynamicDuos": [...],
  "puzzlePairings": [...],
  "soloWorkers": [...]
}
```

## Benefits

1. **Server stays responsive** - Other requests process immediately
2. **No timeouts** - Even with 1000+ students
3. **Results cached** - Subsequent requests are instant
4. **Progress tracking** - Can show loading state to users

## Production Setup

For production, you'll need Redis:
```bash
REDIS_URL=redis://your-redis-instance:6379
```

But for development/beta, the in-memory queue works fine!