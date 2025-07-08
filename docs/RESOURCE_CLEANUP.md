# Resource Cleanup System

## Overview
The Animal Genius backend now has a comprehensive resource cleanup system that ensures all resources are properly released during shutdown, preventing:
- Memory leaks
- Hanging connections
- Data loss
- Zombie processes

## Architecture

### Centralized Cleanup Manager
All cleanup operations are managed through a single `ResourceCleanupManager` located in `/server/lib/resource-cleanup.ts`.

### Priority-Based Execution
Cleanup handlers run in priority order (lower numbers first):
1. **Priority 0-19**: Critical data persistence
2. **Priority 20-49**: Service cleanup (games, sessions)
3. **Priority 50-79**: External connections (Redis, WebSocket)
4. **Priority 80-99**: Core infrastructure (HTTP server)
5. **Priority 100+**: Final cleanup (database pool)

## Registered Handlers

| Handler | Priority | Timeout | Description |
|---------|----------|---------|-------------|
| game-session-manager | 20 | 5s | Saves game state, cleans up sessions |
| websocket-server | 30 | 5s | Closes WebSocket connections gracefully |
| metrics-service | 40 | 5s | Flushes metrics, saves reports |
| redis-cache | 50 | 5s | Closes Redis connections |
| http-server | 90 | 8s | Stops accepting new requests |
| database-pool | 100 | 5s | Closes all database connections |

## Features

### Automatic Interval/Timeout Management
```typescript
// Instead of:
const interval = setInterval(doWork, 1000);

// Use:
import { createManagedInterval } from './lib/resource-cleanup';
const interval = createManagedInterval(doWork, 1000, 'worker-name');
```

Managed intervals are automatically cleared during shutdown.

### Graceful Shutdown Process
1. Receive SIGTERM/SIGINT signal
2. Stop accepting new connections
3. Execute cleanup handlers in priority order
4. Wait for handlers to complete (with timeout)
5. Exit process

### Error Handling
- Each handler runs independently
- Failures don't block other handlers
- All errors are logged
- Process exits with error code if any handler fails

## Usage

### Registering a New Cleanup Handler
```typescript
import { cleanupManager } from './lib/resource-cleanup';

cleanupManager.register({
  name: 'my-service',
  priority: 35,
  timeout: 3000, // Optional, defaults to 5000ms
  handler: async () => {
    // Your cleanup code here
    await myService.shutdown();
  }
});
```

### Creating Managed Resources
```typescript
import { createManagedInterval, createManagedTimeout } from './lib/resource-cleanup';

// These are automatically cleaned up on shutdown
const interval = createManagedInterval(() => {
  console.log('Working...');
}, 1000, 'my-worker');

const timeout = createManagedTimeout(() => {
  console.log('Delayed task');
}, 5000, 'delayed-task');
```

## Testing Shutdown

### Manual Test
```bash
# Start the server
npm run dev

# In another terminal, send SIGTERM
kill -TERM <process-id>

# Or SIGINT (Ctrl+C)
kill -INT <process-id>
```

### Expected Output
```
2:30:00 PM [express] Received SIGTERM, starting graceful shutdown...
[ResourceCleanup] Starting cleanup with 6 handlers...
[ResourceCleanup] Running cleanup handler: game-session-manager
2:30:00 PM [express] Cleaning up game session manager...
[ResourceCleanup] ✓ Completed cleanup handler: game-session-manager
[ResourceCleanup] Running cleanup handler: websocket-server
2:30:00 PM [express] Cleaning up WebSocket server...
[ResourceCleanup] ✓ Completed cleanup handler: websocket-server
...
[ResourceCleanup] Cleanup completed in 1234ms
[ResourceCleanup] Graceful shutdown completed
```

## Monitoring

The cleanup system logs:
- Handler registration
- Cleanup start/completion
- Individual handler execution
- Errors and timeouts
- Total cleanup time

## Best Practices

1. **Register Early**: Register cleanup handlers during service initialization
2. **Fast Handlers**: Keep cleanup operations under 5 seconds
3. **Idempotent**: Handlers should be safe to call multiple times
4. **No Dependencies**: Don't depend on other services in cleanup
5. **Log Progress**: Log what your handler is doing for debugging

## Common Issues

### Handler Timeout
If a handler exceeds its timeout:
- The handler is abandoned
- Cleanup continues with next handler
- Process may exit before handler completes

### Database Queries During Shutdown
The database pool closes late (priority 100) to allow other handlers to persist data. However, avoid long-running queries during cleanup.

### Hanging Process
If the process doesn't exit after cleanup:
- Check for active handles: `process._getActiveHandles()`
- Look for unclosed servers, timers, or streams
- The system forces exit after 10 seconds as last resort