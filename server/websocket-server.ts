// WebSocket Server for Real-time Game Communication
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { gameSessionManager } from './game-session-manager';
import { 
  WSMessage,
  JoinGameData,
  SelectAnimalData,
  CustomizeAvatarData,
  SubmitAnswerData,
  PlayerJoinedData,
  GameStartedData,
  QuestionResultData,
  AnimalType
} from '../shared/game-types';
import { randomBytes } from 'crypto';
import { wsAuthManager } from './websocket-auth';
import { WSErrorCode, createWSError } from '../shared/error-codes';
import { logger } from './utils/logger';
import { metricsService } from './monitoring/metrics-service';

interface ExtendedWebSocket extends WebSocket {
  playerId?: string;
  gameId?: string;
  isTeacher?: boolean;
  isAlive?: boolean;
  authenticated?: boolean;
  userId?: string;
}

export class GameWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ExtendedWebSocket> = new Map();
  private rateLimits: Map<string, { answers: number; lastReset: number }> = new Map();
  private questionTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private rateLimitCleanupInterval?: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/game' // Use a specific path for game WebSocket connections
    });
    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startRateLimitCleanup();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: ExtendedWebSocket, request) => {
      // For development and Replit, be more permissive with origins
      const origin = request.headers.origin;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('WebSocket connection from origin:', origin);
      }
      
      logger.wsConnection('connect', { origin });
      
      // Track connection in metrics (we don't know if teacher yet)
      metricsService.trackConnection(false);
      
      ws.isAlive = true;
      ws.playerId = undefined;
      ws.gameId = undefined;
      ws.isTeacher = false;
      
      ws.on('pong', () => { ws.isAlive = true; });

      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          if (process.env.NODE_ENV === 'development') {
            console.log('📨 Received WebSocket message:', message.type);
          }
          this.handleMessage(ws, message);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to parse WebSocket message:', error);
          }
          this.sendError(ws, WSErrorCode.MESSAGE_INVALID_FORMAT);
        }
      });

      ws.on('close', (code, reason) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('WebSocket connection closed, code:', code, 'reason:', reason.toString());
        }
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('WebSocket error:', error);
        }
      });
    });
  }

  private handleMessage(ws: ExtendedWebSocket, message: WSMessage) {
    logger.wsMessage(message.type, 'in', {
      playerId: ws.playerId,
      gameId: ws.gameId,
      isTeacher: ws.isTeacher,
      authenticated: ws.authenticated
    });

    // Track message in metrics
    metricsService.trackMessage(message.type, false);

    switch (message.type) {
      case 'authenticate':
        this.handleAuthenticate(ws, message.data);
        break;
      case 'teacher-create-game':
        this.handleTeacherCreateGame(ws, message.data);
        break;
      case 'join-game':
        // Allow direct game joining without strict authentication for player connections
        this.handleJoinGame(ws, message.data as JoinGameData);
        break;
      case 'select-animal':
        this.handleSelectAnimal(ws, message.data as SelectAnimalData);
        break;
      case 'customize-avatar':
        this.handleCustomizeAvatar(ws, message.data as CustomizeAvatarData);
        break;
      case 'player-ready':
        this.handlePlayerReady(ws);
        break;
      case 'start-game':
        this.handleStartGame(ws);
        break;
      case 'submit-answer':
        this.handleSubmitAnswer(ws, message.data as SubmitAnswerData);
        break;
      case 'show-answer':
        this.handleShowAnswer(ws);
        break;
      case 'next-question':
        this.handleNextQuestion(ws);
        break;
      case 'end-game':
        this.handleEndGame(ws);
        break;
      case 'kick-player':
        this.handleKickPlayer(ws, message.data);
        break;
      default:
        this.sendError(ws, WSErrorCode.MESSAGE_UNKNOWN_TYPE, { type: message.type });
    }
  }

  private handleAuthenticate(ws: ExtendedWebSocket, data: { ticket: string }) {
    if (!data.ticket) {
      this.sendError(ws, WSErrorCode.AUTH_REQUIRED);
      return;
    }

    const validation = wsAuthManager.validateTicket(data.ticket);
    if (!validation.valid) {
      this.sendError(ws, WSErrorCode.AUTH_INVALID_TICKET);
      ws.close(1008, 'Invalid authentication');
      return;
    }

    ws.authenticated = true;
    ws.userId = validation.userId;
    
    logger.info('WebSocket authenticated', {
      userId: validation.userId,
      gameId: validation.gameId
    });
    
    this.sendToClient(ws, {
      type: 'authenticated',
      data: { success: true }
    });
  }

  private handleTeacherCreateGame(ws: ExtendedWebSocket, data: { gameId: string }) {
    // For development, allow teacher game creation without strict authentication
    if (process.env.NODE_ENV === 'development') {
      console.log('🎓 Teacher creating game:', data.gameId);
    }

    const game = gameSessionManager.getGameById(data.gameId);
    if (!game) {
      this.sendError(ws, WSErrorCode.GAME_NOT_FOUND, { gameId: data.gameId });
      return;
    }

    ws.gameId = data.gameId;
    ws.isTeacher = true;
    ws.playerId = `teacher_${game.teacherId}`;
    this.clients.set(ws.playerId, ws);

    // Update metrics - this connection is now identified as a teacher
    metricsService.trackDisconnection(false); // Remove from player count
    metricsService.trackConnection(true);     // Add to teacher count

    // Update game with teacher socket ID
    game.teacherSocketId = ws.playerId;

    this.sendToClient(ws, {
      type: 'game-created',
      data: {
        gameId: game.id,
        gameCode: game.code,
        settings: game.settings
      }
    });

    // Send current players if any
    if (game.players.size > 0) {
      const players = Array.from(game.players.values());
      this.sendToClient(ws, {
        type: 'players-sync',
        data: {
          players,
          totalPlayers: game.players.size
        }
      });
    }
  }

  private async handleJoinGame(ws: ExtendedWebSocket, data: JoinGameData) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎮 Handling join game request:', data);
    }
    
    const game = gameSessionManager.getGameByCode(data.gameCode);
    if (!game) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Game not found for code:', data.gameCode);
      }
      this.sendError(ws, WSErrorCode.GAME_CODE_INVALID);
      return;
    }

    // Sanitize player name to prevent XSS
    const sanitizedName = this.sanitizePlayerName(data.playerName);
    if (!sanitizedName) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Invalid player name:', data.playerName);
      }
      this.sendError(ws, WSErrorCode.PLAYER_NAME_INVALID);
      return;
    }

    // Allow rejoining if game has started and player already exists
    const existingPlayer = Array.from(game.players.values()).find(p => p.name === sanitizedName);
    
    if (game.status !== 'lobby' && !existingPlayer) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Game already started and player not found');
      }
      this.sendError(ws, WSErrorCode.GAME_ALREADY_STARTED);
      return;
    }
    
    // If player is rejoining an active game, restore their connection
    if (existingPlayer && game.status !== 'lobby') {
      ws.playerId = existingPlayer.id;
      ws.gameId = game.id;
      ws.isTeacher = false;
      this.clients.set(existingPlayer.id, ws);
      
      // Mark player as reconnected
      gameSessionManager.reconnectPlayer(game.id, existingPlayer.id);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Player ${existingPlayer.id} rejoined active game ${game.id}`);
      }
      
      // Send current game state to rejoining player
      this.sendToClient(ws, {
        type: 'joined-game',
        data: {
          gameId: game.id,
          playerId: existingPlayer.id,
          playerName: existingPlayer.name,
          gameSettings: game.settings,
          gameMode: game.settings.mode,  // Include gameMode directly for backward compatibility
          gameStatus: game.status
        }
      });
      
      // If game is in progress, send current question
      if (game.status === 'playing' && game.currentQuestionIndex < game.questions.length) {
        const currentQuestion = game.questions[game.currentQuestionIndex];
        this.sendToClient(ws, {
          type: 'game-started',
          data: {
            firstQuestion: currentQuestion,
            questionNumber: game.currentQuestionIndex + 1,
            totalQuestions: game.questions.length
          }
        });
      }
      
      return;
    }

    // Check max players limit
    if (game.players.size >= 100) {
      this.sendError(ws, WSErrorCode.GAME_FULL);
      return;
    }

    // Generate unique player ID
    const playerId = `player_${Date.now()}_${randomBytes(6).toString('hex')}`;
    
    const player = await gameSessionManager.addPlayer(game.id, playerId, sanitizedName);
    if (!player) {
      this.sendError(ws, WSErrorCode.SERVER_ERROR);
      return;
    }

    ws.playerId = playerId;
    ws.gameId = game.id;
    ws.isTeacher = false;
    this.clients.set(playerId, ws);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Player ${playerId} joined game ${game.id}, WebSocket context set`);
      console.log(`✅ Total clients now: ${this.clients.size}`);
    }

    // Send success to joining player
    this.sendToClient(ws, {
      type: 'joined-game',
      data: {
        gameId: game.id,
        playerId: playerId,
        playerName: data.playerName,
        gameSettings: game.settings,
        gameMode: game.settings.mode  // Include gameMode directly for backward compatibility
      }
    });

    // Send existing players to the new player
    if (game.players.size > 1) { // More than just the new player
      const existingPlayers = Array.from(game.players.values()).filter(p => p.id !== playerId);
      this.sendToClient(ws, {
        type: 'players-sync',
        data: {
          players: existingPlayers,
          totalPlayers: game.players.size
        }
      });
    }

    // Notify all players and teacher
    const playerJoinedData: PlayerJoinedData = {
      player,
      totalPlayers: game.players.size
    };

    this.broadcastToGame(game.id, {
      type: 'player-joined',
      data: playerJoinedData
    }, playerId); // Exclude the joining player
  }

  private handleSelectAnimal(ws: ExtendedWebSocket, data: SelectAnimalData) {
    if (!ws.playerId || !ws.gameId) {
      this.sendError(ws, WSErrorCode.CONNECTION_NOT_IN_GAME);
      return;
    }

    const success = gameSessionManager.updatePlayerAnimal(ws.gameId, ws.playerId, data.animal);
    if (!success) {
      this.sendError(ws, WSErrorCode.SERVER_ERROR);
      return;
    }

    this.sendToClient(ws, {
      type: 'animal-selected',
      data: { animal: data.animal }
    });

    // Notify others
    this.broadcastToGame(ws.gameId, {
      type: 'player-updated',
      data: {
        playerId: ws.playerId,
        animal: data.animal
      }
    }, ws.playerId);
  }

  private handleCustomizeAvatar(ws: ExtendedWebSocket, data: CustomizeAvatarData) {
    if (!ws.playerId || !ws.gameId) {
      this.sendError(ws, WSErrorCode.CONNECTION_NOT_IN_GAME);
      return;
    }

    const success = gameSessionManager.updatePlayerAvatar(ws.gameId, ws.playerId, data.customization);
    if (!success) {
      this.sendError(ws, WSErrorCode.SERVER_ERROR);
      return;
    }

    this.sendToClient(ws, {
      type: 'avatar-customized',
      data: { customization: data.customization }
    });

    // Notify others
    this.broadcastToGame(ws.gameId, {
      type: 'player-avatar-updated',
      data: {
        playerId: ws.playerId,
        customization: data.customization
      }
    }, ws.playerId);
  }

  private handlePlayerReady(ws: ExtendedWebSocket) {
    if (!ws.playerId || !ws.gameId) {
      this.sendError(ws, WSErrorCode.CONNECTION_NOT_IN_GAME);
      return;
    }

    // Notify teacher that player is ready
    const game = gameSessionManager.getGameById(ws.gameId);
    if (game && game.teacherSocketId) {
      const teacherWs = this.clients.get(game.teacherSocketId);
      if (teacherWs) {
        this.sendToClient(teacherWs, {
          type: 'player-ready',
          data: { playerId: ws.playerId }
        });
      }
    }
  }

  private handleStartGame(ws: ExtendedWebSocket) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎮 Start game request - Teacher: ${ws.isTeacher}, GameId: ${ws.gameId}, Authenticated: ${ws.authenticated}`);
    }
    
    if (!ws.isTeacher || !ws.gameId || !ws.authenticated) {
      this.sendError(ws, WSErrorCode.AUTH_REQUIRED);
      return;
    }

    // Get game first to check if it exists and has players
    const game = gameSessionManager.getGameById(ws.gameId);
    if (!game) {
      this.sendError(ws, WSErrorCode.GAME_NOT_FOUND, { gameId: ws.gameId });
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🎮 Game found - Status: ${game.status}, Players: ${game.players.size}, Questions: ${game.questions?.length || 0}`);
    }

    // Check if game has at least one player
    if (game.players.size === 0) {
      this.sendError(ws, WSErrorCode.GAME_NO_PLAYERS, { action: 'start_game' });
      return;
    }

    // Check if game has questions
    if (!game.questions || game.questions.length === 0) {
      this.sendError(ws, WSErrorCode.GAME_NO_QUESTIONS, { action: 'start_game' });
      return;
    }

    const success = gameSessionManager.startGame(ws.gameId);
    if (!success) {
      this.sendError(ws, WSErrorCode.SERVER_ERROR, { action: 'start_game', reason: 'failed_to_start' });
      return;
    }
    
    logger.gameEvent('game_started', {
      gameId: ws.gameId,
      teacherId: ws.userId,
      playerCount: game.players.size
    });

    const firstQuestion = game.questions[0];
    const gameStartedData: GameStartedData = {
      firstQuestion,
      questionNumber: 1,
      totalQuestions: game.questions.length
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 Broadcasting game-started message to game ${ws.gameId}`);
      console.log(`🚀 First question:`, firstQuestion);
    }

    this.broadcastToGame(ws.gameId, {
      type: 'game-started',
      data: gameStartedData
    });

    // Start question timer
    this.startQuestionTimer(ws.gameId, game.settings.timePerQuestion);
  }

  private async handleSubmitAnswer(ws: ExtendedWebSocket, data: SubmitAnswerData) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 Answer submission attempt from player ${ws.playerId} in game ${ws.gameId}:`, data);
      console.log(`🎯 WebSocket context - playerId: ${ws.playerId}, gameId: ${ws.gameId}, isTeacher: ${ws.isTeacher}`);
    }
    
    if (!ws.playerId || !ws.gameId || ws.isTeacher) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Not authorized - playerId: ${ws.playerId}, gameId: ${ws.gameId}, isTeacher: ${ws.isTeacher}`);
        console.log(`❌ All connected clients:`, Array.from(this.clients.keys()));
      }
      this.sendError(ws, WSErrorCode.CONNECTION_INVALID_STATE, { reason: 'missing_player_context' });
      return;
    }

    // Rate limiting - max 3 answers per question (prevents spam but allows retries)
    const rateLimit = this.rateLimits.get(ws.playerId) || { answers: 0, lastReset: Date.now() };
    const now = Date.now();
    
    // Reset counter after 20 seconds (same as question time)
    if (now - rateLimit.lastReset > 20000) {
      rateLimit.answers = 0;
      rateLimit.lastReset = now;
    }
    
    rateLimit.answers++;
    if (rateLimit.answers > 3) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Rate limit exceeded for player ${ws.playerId}: ${rateLimit.answers} attempts`);
      }
      this.sendError(ws, WSErrorCode.CONNECTION_RATE_LIMITED, { action: 'submit_answer' });
      return;
    }
    
    this.rateLimits.set(ws.playerId, rateLimit);

    const points = await gameSessionManager.submitAnswer(
      ws.gameId, 
      ws.playerId, 
      data.questionId,
      data.answer, 
      data.timeRemaining
    );

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Answer processed - Player: ${ws.playerId}, Answer: ${data.answer}, Points: ${points}`);
    }

    this.sendToClient(ws, {
      type: 'answer-submitted',
      data: { points, answer: data.answer }
    });

    // Notify teacher
    const game = gameSessionManager.getGameById(ws.gameId);
    if (game && game.teacherSocketId) {
      const teacherWs = this.clients.get(game.teacherSocketId);
      if (teacherWs) {
        const answeredCount = Array.from(game.players.values())
          .filter(p => p.currentAnswer !== undefined).length;
        
        this.sendToClient(teacherWs, {
          type: 'player-answered',
          data: {
            playerId: ws.playerId,
            answeredCount,
            totalPlayers: game.players.size
          }
        });
      }
    }
  }

  private handleShowAnswer(ws: ExtendedWebSocket) {
    if (!ws.isTeacher || !ws.gameId || !ws.authenticated) {
      this.sendError(ws, WSErrorCode.AUTH_REQUIRED);
      return;
    }

    const game = gameSessionManager.getGameById(ws.gameId);
    if (!game) return;

    const currentQuestion = gameSessionManager.getCurrentQuestion(ws.gameId);
    if (!currentQuestion) return;

    const leaderboard = gameSessionManager.getLeaderboard(ws.gameId);
    
    // Calculate results for each player
    const playerResults = Array.from(game.players.values()).map(player => ({
      playerId: player.id,
      correct: player.currentAnswer === currentQuestion.correctAnswer,
      points: player.score,
      newScore: player.score
    }));

    const questionResultData: QuestionResultData = {
      correctAnswer: currentQuestion.correctAnswer,
      playerResults,
      leaderboard: {
        players: leaderboard.individual.map((player, index) => ({
          player,
          rank: index + 1
        })),
        teams: leaderboard.teams ? 
          Array.from(leaderboard.teams.entries()).map(([animal, data], index) => ({
            animal,
            score: data.score,
            rank: index + 1
          })) : undefined
      }
    };

    this.broadcastToGame(ws.gameId, {
      type: 'show-answer',
      data: questionResultData
    });
  }

  private handleNextQuestion(ws: ExtendedWebSocket) {
    if (!ws.isTeacher || !ws.gameId || !ws.authenticated) {
      this.sendError(ws, WSErrorCode.AUTH_REQUIRED);
      return;
    }

    const nextQuestion = gameSessionManager.nextQuestion(ws.gameId);
    
    if (!nextQuestion) {
      // Game is over
      this.handleEndGame(ws);
      return;
    }

    const game = gameSessionManager.getGameById(ws.gameId);
    if (!game) return;

    this.broadcastToGame(ws.gameId, {
      type: 'next-question',
      data: {
        question: nextQuestion,
        questionNumber: game.currentQuestionIndex + 1,
        totalQuestions: game.questions.length
      }
    });

    // Start question timer
    this.startQuestionTimer(ws.gameId, game.settings.timePerQuestion);
  }

  private handleEndGame(ws: ExtendedWebSocket) {
    if (!ws.isTeacher || !ws.gameId || !ws.authenticated) {
      this.sendError(ws, WSErrorCode.AUTH_REQUIRED);
      return;
    }

    // Clear any active timer for this game
    this.clearQuestionTimer(ws.gameId);

    gameSessionManager.endGame(ws.gameId);
    
    const leaderboard = gameSessionManager.getLeaderboard(ws.gameId);
    
    this.broadcastToGame(ws.gameId, {
      type: 'game-ended',
      data: {
        finalLeaderboard: leaderboard
      }
    });
  }

  private handleKickPlayer(ws: ExtendedWebSocket, data: { playerId: string }) {
    if (!ws.isTeacher || !ws.gameId) {
      this.sendError(ws, WSErrorCode.AUTH_REQUIRED);
      return;
    }

    const playerWs = this.clients.get(data.playerId);
    if (playerWs) {
      this.sendToClient(playerWs, {
        type: 'kicked',
        data: { reason: 'Kicked by teacher' }
      });
      playerWs.close();
    }

    gameSessionManager.removePlayer(ws.gameId, data.playerId);
    
    this.broadcastToGame(ws.gameId, {
      type: 'player-left',
      data: { playerId: data.playerId }
    }, data.playerId);
  }

  private handleDisconnect(ws: ExtendedWebSocket) {
    if (!ws.playerId || !ws.gameId) return;

    // Track disconnection in metrics
    metricsService.trackDisconnection(ws.isTeacher || false);

    if (ws.isTeacher) {
      // Teacher disconnected - pause game?
      if (process.env.NODE_ENV === 'development') {
        console.log('Teacher disconnected from game:', ws.gameId);
      }
    } else {
      // Mark player as disconnected but keep in game
      gameSessionManager.disconnectPlayer(ws.gameId, ws.playerId);
      
      this.broadcastToGame(ws.gameId, {
        type: 'player-disconnected',
        data: { playerId: ws.playerId }
      }, ws.playerId);
    }

    this.clients.delete(ws.playerId);
    this.rateLimits.delete(ws.playerId); // Clean up rate limits
  }

  private startQuestionTimer(gameId: string, seconds: number) {
    // Clear any existing timer for this game
    this.clearQuestionTimer(gameId);
    
    let timeRemaining = seconds;
    
    const timer = setInterval(() => {
      timeRemaining--;
      
      this.broadcastToGame(gameId, {
        type: 'timer-update',
        data: { timeRemaining }
      });

      if (timeRemaining <= 0) {
        this.clearQuestionTimer(gameId);
        
        // Auto-show answer when time runs out
        const game = gameSessionManager.getGameById(gameId);
        if (game && game.teacherSocketId) {
          const teacherWs = this.clients.get(game.teacherSocketId);
          if (teacherWs) {
            this.handleShowAnswer(teacherWs);
          }
        }
      }
    }, 1000);
    
    // Store the timer reference
    this.questionTimers.set(gameId, timer);
  }
  
  private clearQuestionTimer(gameId: string) {
    const timer = this.questionTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.questionTimers.delete(gameId);
    }
  }

  private sendToClient(ws: ExtendedWebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      logger.wsMessage(message.type, 'out', {
        playerId: ws.playerId,
        gameId: ws.gameId,
        isTeacher: ws.isTeacher
      });
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️ Cannot send ${message.type} - WebSocket not open (state: ${ws.readyState})`);
    }
  }

  private sendError(ws: ExtendedWebSocket, code: WSErrorCode, details?: any) {
    const error = createWSError(code, details);
    if (process.env.NODE_ENV === 'development') {
      console.log('📤 Sending WebSocket error:', code, details);
    }
    logger.wsError(code, { 
      playerId: ws.playerId, 
      gameId: ws.gameId,
      details 
    });
    
    // Track error in metrics
    metricsService.trackMessage('error', true);
    
    this.sendToClient(ws, {
      type: 'error',
      data: error
    });
  }

  private broadcastToGame(gameId: string, message: WSMessage, excludePlayerId?: string) {
    const game = gameSessionManager.getGameById(gameId);
    if (!game) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Cannot broadcast to game ${gameId} - game not found`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 Broadcasting ${message.type} to game ${gameId} - ${game.players.size} players, teacher: ${game.teacherSocketId}`);
    }

    let sentCount = 0;

    // Send to all players
    game.players.forEach((player) => {
      if (player.id !== excludePlayerId) {
        const playerWs = this.clients.get(player.id);
        if (playerWs) {
          this.sendToClient(playerWs, message);
          sentCount++;
        } else if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ Player ${player.id} has no WebSocket connection`);
        }
      }
    });

    // Send to teacher
    if (game.teacherSocketId && game.teacherSocketId !== excludePlayerId) {
      const teacherWs = this.clients.get(game.teacherSocketId);
      if (teacherWs) {
        this.sendToClient(teacherWs, message);
        sentCount++;
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Teacher ${game.teacherSocketId} has no WebSocket connection`);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Broadcasted ${message.type} to ${sentCount} clients`);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // Only run heartbeat if there are connected clients
      if (this.wss.clients.size > 0) {
        this.wss.clients.forEach((ws: ExtendedWebSocket) => {
          if (ws.isAlive === false) {
            this.handleDisconnect(ws);
            return ws.terminate();
          }
          
          ws.isAlive = false;
          ws.ping();
        });
      }
    }, 120000); // Increased from 60s to 120s to reduce server load

    this.wss.on('close', () => {
      this.cleanup();
    });
  }
  
  private startRateLimitCleanup() {
    // Clean up old rate limit entries every 15 minutes instead of 5
    this.rateLimitCleanupInterval = setInterval(() => {
      // Only run cleanup if there are rate limit entries to clean
      if (this.rateLimits.size === 0) return;
      
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      // Remove rate limit entries for disconnected players
      for (const [playerId, rateLimit] of Array.from(this.rateLimits.entries())) {
        // If player is not connected or rate limit is old, remove it
        if (!this.clients.has(playerId) || rateLimit.lastReset < fiveMinutesAgo) {
          this.rateLimits.delete(playerId);
        }
      }
    }, 15 * 60 * 1000); // 15 minutes
  }
  
  public cleanup() {
    // Clear all intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = undefined;
    }
    
    // Clear all question timers
    for (const timer of Array.from(this.questionTimers.values())) {
      clearInterval(timer);
    }
    this.questionTimers.clear();
    
    // Clear all maps
    this.clients.clear();
    this.rateLimits.clear();
  }

  private sanitizePlayerName(name: string): string {
    if (!name || typeof name !== 'string') return '';
    
    // Trim and limit length
    name = name.trim().substring(0, 30);
    
    // Remove HTML tags and dangerous characters
    name = name.replace(/<[^>]*>/g, '')
               .replace(/[<>"'&]/g, '')
               .replace(/\s+/g, ' ');
    
    // Ensure name has at least 1 character after sanitization
    return name.length > 0 ? name : '';
  }
}