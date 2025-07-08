# Real-Time Game System Documentation

## Overview

The real-time game system was built to allow teachers to run live quiz games with their students. It used WebSockets for real-time communication and supported features like:

- Live quiz games with multiple students
- Real-time score updates
- Timed questions with countdown
- Teacher controls (start, next question, end game)
- Student avatar customization during game setup

## Architecture

### 1. WebSocket Server (`websocket-server.ts`)

The core of the real-time system. Key features:

- **Connection Management**: Limited to 500 total connections, 10 per IP
- **Authentication**: Teachers authenticate with tickets, students join with game codes
- **Message Routing**: Handles various message types (join-game, submit-answer, etc.)
- **Memory Leak Issues**: Had problems with:
  - Question timers not being cleaned up
  - Rate limit maps growing unbounded

### 2. Game Session Manager (`game-session-manager.ts`)

Managed the game state:

- Game creation by teachers
- Player joining and leaving
- Question progression
- Score calculation
- Leaderboard generation

### 3. WebSocket Authentication (`websocket-auth.ts`)

- Teachers got authentication tickets from the REST API
- Tickets were validated before allowing WebSocket connections
- Students could join games directly with game codes

### 4. Message Flow

```
Teacher Dashboard -> REST API -> WebSocket Ticket
                                      |
                                      v
                              WebSocket Server
                                      ^
                                      |
Student Quiz Page -> Join with Game Code
```

## Key Components

### Message Types

- `authenticate` - Teacher authentication
- `teacher-create-game` - Create a new game session
- `join-game` - Student joins a game
- `select-animal` - Student selects their animal type
- `customize-avatar` - Student customizes avatar
- `player-ready` - Student ready to start
- `start-game` - Teacher starts the game
- `submit-answer` - Student submits an answer
- `show-answer` - Teacher reveals correct answer
- `next-question` - Move to next question
- `end-game` - End the game session

### Game State

Games tracked:
- Teacher socket ID
- Player list with avatars
- Current question index
- Player scores
- Question timers
- Game settings (time per question, etc.)

## Problems Encountered

### 1. Memory Leaks
- Question timers using `setInterval` weren't always cleaned up
- In-memory game queue never removed completed jobs
- Rate limit maps grew without bounds

### 2. Complexity
- WebSocket server added significant complexity
- Connection management was tricky
- Scaling concerns with 500+ students

### 3. Error Handling
- Disconnections during games caused issues
- Teacher disconnecting left games in limbo
- No graceful recovery for network issues

## Database Schema

The game sessions were stored in a PostgreSQL table:

```typescript
// game-sessions.ts
export const gameSessions = {
  id: uuid primary key
  teacherId: uuid (references teachers)
  gameCode: text unique
  status: enum ('waiting', 'in_progress', 'completed')
  startedAt: timestamp
  endedAt: timestamp
  settings: jsonb
  createdAt: timestamp
}
```

## Integration Points

### Server Integration (`server/index.ts`)
```typescript
// WebSocket server was attached to the HTTP server
const wss = new GameWebSocketServer(server);
```

### Route Integration
- `/api/auth/ws-ticket` - Get WebSocket authentication ticket
- `/api/teacher/:teacherId/games` - List teacher's games
- Quiz submission service integrated with game results

## Frontend Integration

The frontend had several game-related components:
- Real-time quiz interface
- WebSocket connection management
- Live score updates
- Teacher control panel

## Why It Was Removed

1. **Complexity**: Added 30%+ complexity to the codebase
2. **Memory Issues**: Recurring memory leaks were hard to debug
3. **Scaling Concerns**: WebSocket scaling is complex and expensive
4. **MVP Focus**: Core features work fine without real-time games
5. **Alternative Solutions**: Could use Supabase Realtime or separate game server

## Future Considerations

If reimplementing:

1. **Use External Service**: Supabase Realtime, Ably, or Pusher
2. **Separate Service**: Deploy game server separately
3. **Stateless Design**: Store game state in Redis, not memory
4. **Better Cleanup**: Ensure all timers/listeners are cleaned up
5. **Connection Pooling**: Better connection management
6. **Health Monitoring**: Track memory usage and connection counts

## Restoration Guide

To restore the game system:

1. Copy all files from `_game-system-backup/` back to their original locations
2. Re-add WebSocket server initialization in `server/index.ts`
3. Re-add game routes to the router
4. Install any missing dependencies (ws, etc.)
5. Update environment variables for Redis
6. Test memory usage carefully

## Lessons Learned

1. **Start Simple**: Real-time features should be added gradually
2. **Monitor Memory**: Set up memory monitoring from day one
3. **Clean Up Resources**: Every timer/listener needs explicit cleanup
4. **Consider Alternatives**: Managed services can save significant complexity
5. **Separate Concerns**: Game servers have different scaling needs than CRUD apps