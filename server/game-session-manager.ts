// Game Session Manager - Handles all game state and operations
import { 
  GameSession, 
  GameQuestion, 
  Player, 
  GameStatus, 
  GameSettings,
  generateGameCode,
  AnimalType,
  AvatarCustomization,
  calculatePoints
} from '../shared/game-types';
import { randomBytes } from 'crypto';
import { db } from './db';
import { 
  gameSessions, 
  gamePlayers, 
  gameQuestions, 
  playerAnswers,
  type NewGameSession,
  type NewGamePlayer,
  type NewGameQuestion,
  type NewPlayerAnswer
} from './db/schema/game-sessions';
import { eq, and } from 'drizzle-orm';
import { metricsService, withDatabaseMetrics } from './monitoring/metrics-service';

class GameSessionManager {
  private games: Map<string, GameSession> = new Map();
  private codeToGameId: Map<string, string> = new Map();
  private playerToGameId: Map<string, string> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  async createGame(teacherId: number, settings: GameSettings, questions: GameQuestion[]): Promise<GameSession> {
    const gameId = this.generateUniqueId();
    const code = this.generateUniqueCode();

    const game: GameSession = {
      id: gameId,
      code,
      teacherId,
      settings,
      status: 'lobby',
      currentQuestionIndex: -1,
      players: new Map(),
      questions: questions.slice(0, settings.questionCount), // Limit to requested number
      createdAt: new Date(),
    };

    // Save game session to database
    try {
      const newGameSession: NewGameSession = {
        id: gameId,
        code,
        teacherId,
        mode: settings.mode,
        questionCount: settings.questionCount,
        timePerQuestion: settings.timePerQuestion,
        status: 'lobby',
        currentQuestionIndex: -1,
      };

      await withDatabaseMetrics('insert_game_session', () => 
        db.insert(gameSessions).values(newGameSession)
      );

      // Save questions to database
      const gameQuestionInserts: NewGameQuestion[] = game.questions.map((q, index) => ({
        gameId,
        questionId: q.id,
        questionOrder: index,
      }));

      if (gameQuestionInserts.length > 0) {
        await withDatabaseMetrics('insert_game_questions', () =>
          db.insert(gameQuestions).values(gameQuestionInserts)
        );
      }

      console.log(`✅ Game ${gameId} saved to database`);
    } catch (error) {
      console.error(`❌ Failed to save game ${gameId} to database:`, error);
      // Continue with in-memory game even if database save fails
    }

    this.games.set(gameId, game);
    this.codeToGameId.set(code, gameId);

    // Track game creation in metrics
    metricsService.trackGameCreated();

    // Clean up old games periodically
    this.scheduleGameCleanup(gameId);

    return game;
  }

  getGameByCode(code: string): GameSession | null {
    const gameId = this.codeToGameId.get(code.toUpperCase());
    if (!gameId) return null;
    return this.games.get(gameId) || null;
  }

  getGameById(gameId: string): GameSession | null {
    return this.games.get(gameId) || null;
  }

  getGameByPlayerId(playerId: string): GameSession | null {
    const gameId = this.playerToGameId.get(playerId);
    if (!gameId) return null;
    return this.games.get(gameId) || null;
  }

  async addPlayer(gameId: string, socketId: string, name: string): Promise<Player | null> {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'lobby') return null;

    const player: Player = {
      id: socketId,
      name,
      animal: 'Meerkat', // Default, will be changed by player
      avatar: {},
      score: 0,
      connected: true,
      joinedAt: new Date(),
    };

    // Save player to database
    try {
      const newGamePlayer: NewGamePlayer = {
        gameId,
        socketId,
        name,
        animal: 'Meerkat',
        avatarCustomization: {},
        score: 0,
        connected: true,
      };

      await withDatabaseMetrics('insert_game_player', () =>
        db.insert(gamePlayers).values(newGamePlayer)
      );
      console.log(`✅ Player ${socketId} saved to database for game ${gameId}`);
    } catch (error) {
      console.error(`❌ Failed to save player ${socketId} to database:`, error);
      // Continue with in-memory player even if database save fails
    }

    game.players.set(socketId, player);
    this.playerToGameId.set(socketId, gameId);

    // Track player join in metrics
    metricsService.trackPlayerJoined();

    return player;
  }

  updatePlayerAnimal(gameId: string, playerId: string, animal: AnimalType): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const player = game.players.get(playerId);
    if (!player) return false;

    player.animal = animal;
    return true;
  }

  updatePlayerAvatar(gameId: string, playerId: string, avatar: AvatarCustomization): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const player = game.players.get(playerId);
    if (!player) return false;

    player.avatar = avatar;
    return true;
  }

  removePlayer(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const deleted = game.players.delete(playerId);
    this.playerToGameId.delete(playerId);

    // If no players left and game hasn't started, remove the game
    if (game.players.size === 0 && game.status === 'lobby') {
      this.removeGame(gameId);
    }

    return deleted;
  }

  disconnectPlayer(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const player = game.players.get(playerId);
    if (!player) return false;

    player.connected = false;
    return true;
  }

  reconnectPlayer(gameId: string, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    const player = game.players.get(playerId);
    if (!player) return false;

    player.connected = true;
    return true;
  }

  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    
    if (!game) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Cannot start game - Game not found: ${gameId}`);
      }
      return false;
    }
    
    if (game.status !== 'lobby') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Cannot start game - Game status is '${game.status}', not 'lobby': ${gameId}`);
      }
      return false;
    }
    
    if (game.players.size === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Cannot start game - No players in game: ${gameId}`);
      }
      return false;
    }

    game.status = 'playing';
    game.startedAt = new Date();
    game.currentQuestionIndex = 0;
    game.currentQuestionStartTime = new Date();
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Game started successfully: ${gameId} with ${game.players.size} players`);
    }

    return true;
  }

  async submitAnswer(gameId: string, playerId: string, questionId: number, answer: string, timeRemaining: number): Promise<number> {
    console.log(`🎮 GameSessionManager.submitAnswer - Game: ${gameId}, Player: ${playerId}, QuestionId: ${questionId}, Answer: ${answer}, Time: ${timeRemaining}`);
    
    const game = this.games.get(gameId);
    if (!game) {
      console.log(`❌ Game not found: ${gameId}`);
      return 0;
    }
    if (game.status !== 'playing') {
      console.log(`❌ Game not in playing status: ${game.status}`);
      return 0;
    }

    const player = game.players.get(playerId);
    if (!player) {
      console.log(`❌ Player not found: ${playerId}`);
      return 0;
    }
    if (player.currentAnswer) {
      console.log(`❌ Player already answered: ${player.currentAnswer}`);
      return 0;
    }

    const currentQuestion = game.questions[game.currentQuestionIndex];
    if (!currentQuestion) {
      console.log(`❌ No current question at index: ${game.currentQuestionIndex}`);
      return 0;
    }

    // Validate that the answer is for the current question
    if (currentQuestion.id !== questionId) {
      console.log(`❌ Answer is for wrong question. Expected: ${currentQuestion.id}, Got: ${questionId}`);
      return 0;
    }

    console.log(`📝 Current question: "${currentQuestion.question}", Correct answer: ${currentQuestion.correctAnswer}`);

    player.currentAnswer = answer;
    player.answerTime = game.settings.timePerQuestion - timeRemaining;

    const isCorrect = answer === currentQuestion.correctAnswer;
    const points = calculatePoints(isCorrect, timeRemaining, game.settings.timePerQuestion);
    
    player.score += points;
    
    // Save answer to database
    try {
      // First get the player's database ID
      const dbPlayer = await db.select().from(gamePlayers).where(
        and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.socketId, playerId))
      ).limit(1);

      if (dbPlayer.length > 0) {
        const newPlayerAnswer: NewPlayerAnswer = {
          gameId,
          playerId: dbPlayer[0].id,
          questionId,
          answer,
          timeRemaining,
          pointsEarned: points,
        };

        await withDatabaseMetrics('insert_player_answer', () =>
          db.insert(playerAnswers).values(newPlayerAnswer)
        );
        
        // Update player score in database
        await withDatabaseMetrics('update_player_score', () =>
          db.update(gamePlayers)
            .set({ score: player.score, currentAnswer: answer, answerTime: player.answerTime })
            .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.socketId, playerId)))
        );

        console.log(`✅ Answer saved to database for player ${playerId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to save answer to database:`, error);
      // Continue even if database save fails
    }
    
    console.log(`✅ Answer submitted successfully - Correct: ${isCorrect}, Points: ${points}, New Score: ${player.score}`);
    return points;
  }

  nextQuestion(gameId: string): GameQuestion | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') return null;

    // Clear previous answers
    game.players.forEach(player => {
      player.currentAnswer = undefined;
      player.answerTime = undefined;
    });

    game.currentQuestionIndex++;
    
    if (game.currentQuestionIndex >= game.questions.length) {
      this.endGame(gameId);
      return null;
    }

    game.currentQuestionStartTime = new Date();
    return game.questions[game.currentQuestionIndex];
  }

  getCurrentQuestion(gameId: string): GameQuestion | null {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'playing') return null;

    return game.questions[game.currentQuestionIndex] || null;
  }

  getLeaderboard(gameId: string): { individual: Player[], teams?: Map<AnimalType, { score: number, players: Player[] }> } {
    const game = this.games.get(gameId);
    if (!game) return { individual: [] };

    // Individual leaderboard
    const players = Array.from(game.players.values());
    const sortedPlayers = players.sort((a, b) => b.score - a.score);

    // Team leaderboard (if in team mode)
    if (game.settings.mode === 'team') {
      const teams = new Map<AnimalType, { score: number, players: Player[] }>();
      
      players.forEach(player => {
        const team = teams.get(player.animal) || { score: 0, players: [] };
        team.score += player.score;
        team.players.push(player);
        teams.set(player.animal, team);
      });

      // Sort teams by score
      const sortedTeams = new Map(
        Array.from(teams.entries()).sort((a, b) => b[1].score - a[1].score)
      );

      return { individual: sortedPlayers, teams: sortedTeams };
    }

    return { individual: sortedPlayers };
  }

  endGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    game.status = 'finished';
    game.finishedAt = new Date();

    // Track game completion in metrics
    if (game.startedAt) {
      const duration = game.finishedAt.getTime() - game.startedAt.getTime();
      metricsService.trackGameCompleted(duration);
    }

    return true;
  }

  private removeGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    // Clear cleanup timeout if exists
    if ((game as any).cleanupTimeoutId) {
      clearTimeout((game as any).cleanupTimeoutId);
    }

    // Clean up all references
    this.codeToGameId.delete(game.code);
    game.players.forEach((_, playerId) => {
      this.playerToGameId.delete(playerId);
    });
    this.games.delete(gameId);
  }

  private generateUniqueId(): string {
    return `game_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private generateUniqueCode(): string {
    let code: string;
    do {
      code = generateGameCode();
    } while (this.codeToGameId.has(code));
    return code;
  }

  private scheduleGameCleanup(gameId: string, hours: number = 2): void {
    const timeoutId = setTimeout(() => {
      const game = this.games.get(gameId);
      if (game && (game.status === 'finished' || 
          (game.status === 'lobby' && game.players.size === 0))) {
        this.removeGame(gameId);
      }
    }, hours * 60 * 60 * 1000);

    // Store timeout ID on the game for potential early cleanup
    const game = this.games.get(gameId);
    if (game) {
      (game as any).cleanupTimeoutId = timeoutId;
    }
  }

  // Get all active games (for monitoring)
  getActiveGames(): { total: number, byStatus: Record<GameStatus, number> } {
    const games = Array.from(this.games.values());
    const byStatus = games.reduce((acc, game) => {
      acc[game.status] = (acc[game.status] || 0) + 1;
      return acc;
    }, {} as Record<GameStatus, number>);

    return { total: games.length, byStatus };
  }

  // Stop periodic cleanup (call on server shutdown)
  public stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  // Clean up all resources (call on server shutdown)
  public cleanup(): void {
    this.stopPeriodicCleanup();
    
    // Clear all game cleanup timeouts
    this.games.forEach((game, gameId) => {
      if ((game as any).cleanupTimeoutId) {
        clearTimeout((game as any).cleanupTimeoutId);
      }
    });
    
    // Clear all maps
    this.games.clear();
    this.codeToGameId.clear();
    this.playerToGameId.clear();
  }

  // Periodic cleanup of abandoned games
  private startPeriodicCleanup(): void {
    // Clear any existing interval
    this.stopPeriodicCleanup();
    
    // Run cleanup every 30 minutes instead of 2 hours
    this.cleanupInterval = setInterval(() => {
      // Only run cleanup if there are games to clean
      if (this.games.size === 0) return;
      
      const now = Date.now();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      const fifteenMinutesAgo = now - (15 * 60 * 1000);
      
      // Find and remove abandoned games
      const gamesToRemove: string[] = [];
      
      this.games.forEach((game, gameId) => {
        // Remove finished games older than 30 minutes
        if (game.status === 'finished' && game.finishedAt && 
            new Date(game.finishedAt).getTime() < thirtyMinutesAgo) {
          gamesToRemove.push(gameId);
        }
        
        // Remove lobby games with no players for more than 15 minutes
        if (game.status === 'lobby' && game.players.size === 0 && 
            new Date(game.createdAt).getTime() < fifteenMinutesAgo) {
          gamesToRemove.push(gameId);
        }
        
        // Remove games with all disconnected players for more than 15 minutes
        const allDisconnected = Array.from(game.players.values())
          .every(p => !p.connected);
        if (allDisconnected && game.players.size > 0 &&
            new Date(game.createdAt).getTime() < fifteenMinutesAgo) {
          gamesToRemove.push(gameId);
        }
      });
      
      // Remove identified games
      gamesToRemove.forEach(gameId => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Cleaning up abandoned game: ${gameId}`);
        }
        this.removeGame(gameId);
      });
      
      if (gamesToRemove.length > 0 && process.env.NODE_ENV === 'development') {
        console.log(`Cleaned up ${gamesToRemove.length} abandoned games`);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  constructor() {
    this.startPeriodicCleanup();
  }
}

// Export singleton instance
export const gameSessionManager = new GameSessionManager();