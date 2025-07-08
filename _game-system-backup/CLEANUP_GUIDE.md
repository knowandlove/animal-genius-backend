# Game System Cleanup Guide

## Current Status

The game system is **DISABLED** via feature flags:
- `GAMES_ENABLED=false`
- `WEBSOCKET_ENABLED=false`

This means the code is still present but inactive. No WebSocket server is running, and game-related endpoints return errors.

## Benefits of Feature Flag Approach

1. **Zero Risk**: No code changes, no broken imports
2. **Easy Rollback**: Just change environment variables
3. **Memory Savings**: WebSocket server doesn't initialize
4. **Clean Testing**: Can enable in development, disable in production

## Files That Can Be Safely Deleted (If Permanent Removal Desired)

### 1. Core Game Files
```bash
rm server/websocket-server.ts
rm server/websocket-auth.ts
rm server/websocket-validation.ts
rm server/game-session-manager.ts
rm shared/game-types.ts
```

### 2. Database Schema
```bash
rm server/db/schema/game-sessions.ts
```
Note: You'll need to update the schema exports

### 3. Library Files
```bash
rm server/lib/redis-game-session-store.ts
```

### 4. Test Files
```bash
rm scripts/test-websocket-limits.js
rm server/tests/financial/quiz-rewards.test.ts
```

### 5. Imports to Remove

**From `server/index.ts`:**
- Remove: `import { gameSessionManager } from "./game-session-manager";`
- Remove game cleanup handler (lines 49-57)
- Remove WebSocket cleanup handler (lines 59-70)

**From `server/routes.ts`:**
- Remove: `import { GameWebSocketServer } from "./websocket-server";`
- Remove: `import { gameSessionManager } from "./game-session-manager";`
- Remove: `import { GameSettings } from "@shared/game-types";`
- Remove: `import { wsAuthManager } from "./websocket-auth";`
- Remove WebSocket initialization block (lines 273-283)

**From `server/routes/auth.ts` (if exists):**
- Remove WebSocket ticket endpoints

**From `server/config/constants.ts`:**
- Remove WEBSOCKET section
- Remove GAME_SESSION section

### 6. Dependencies to Remove from package.json
```json
"ws": "^8.x.x",
"@types/ws": "^8.x.x"
```

### 7. Database Migration (Optional)

If you want to remove the game_sessions table:

```sql
-- Drop the table
DROP TABLE IF EXISTS game_sessions;

-- Remove from schema exports
```

## Monitoring After Cleanup

After disabling/removing the game system:

1. **Memory Usage**: Should see significant reduction
2. **Connection Count**: No WebSocket connections
3. **Error Logs**: Check for any "module not found" errors
4. **Routes**: Verify all non-game routes still work

## Quick Enable/Disable Commands

```bash
# Disable games
echo "GAMES_ENABLED=false" >> .env
echo "WEBSOCKET_ENABLED=false" >> .env

# Enable games
sed -i '' 's/GAMES_ENABLED=false/GAMES_ENABLED=true/' .env
sed -i '' 's/WEBSOCKET_ENABLED=false/WEBSOCKET_ENABLED=true/' .env

# Check status
grep "GAMES_ENABLED\|WEBSOCKET_ENABLED" .env
```

## Testing After Cleanup

1. Start the server: `npm run dev`
2. Check memory usage: `node scripts/monitor-memory.js`
3. Verify core features work:
   - Teacher registration/login
   - Class creation
   - Student quiz (non-realtime)
   - Store/avatar system
4. Confirm no WebSocket errors in console

## Rollback Plan

If you need to restore the game system:

1. Copy files from `_game-system-backup/` to original locations
2. Set environment variables:
   ```
   GAMES_ENABLED=true
   WEBSOCKET_ENABLED=true
   ```
3. Restart the server
4. Test WebSocket connectivity