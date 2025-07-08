/**
 * Redis Game Session Store
 * Distributed storage for game sessions across multiple servers
 */

import { GameSession, Player } from '../../shared/game-types';
import { redisCache } from './redis-cache';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('RedisGameSessionStore');

// Key prefixes for different data types
const KEY_PREFIX = {
  GAME: 'game:',
  CODE_TO_GAME: 'code:',
  PLAYER_TO_GAME: 'player:',
  GAME_LIST: 'games:active'
};

// TTL values in seconds
const TTL = {
  ACTIVE_GAME: 4 * 60 * 60,  // 4 hours for active games
  FINISHED_GAME: 30 * 60,     // 30 minutes for finished games
  LOBBY_GAME: 60 * 60,        // 1 hour for lobby games
  MAPPING: 4 * 60 * 60        // 4 hours for mappings
};

export class RedisGameSessionStore {
  /**
   * Save a game session to Redis
   */
  async saveGame(game: GameSession): Promise<boolean> {
    try {
      // Convert Map to object for serialization
      const serializedGame = {
        ...game,
        players: Array.from(game.players.entries()).map(([playerId, player]) => ({
          ...player,
          id: playerId
        }))
      };

      // Determine TTL based on game status
      let ttl = TTL.ACTIVE_GAME;
      if (game.status === 'finished') {
        ttl = TTL.FINISHED_GAME;
      } else if (game.status === 'lobby') {
        ttl = TTL.LOBBY_GAME;
      }

      // Save game data
      const saved = await redisCache.set(
        `${KEY_PREFIX.GAME}${game.id}`,
        serializedGame,
        ttl
      );

      if (saved) {
        // Save code mapping
        await redisCache.set(
          `${KEY_PREFIX.CODE_TO_GAME}${game.code}`,
          game.id,
          TTL.MAPPING
        );

        // Save player mappings
        const playerMappings = Array.from(game.players.keys()).map(playerId =>
          redisCache.set(
            `${KEY_PREFIX.PLAYER_TO_GAME}${playerId}`,
            game.id,
            TTL.MAPPING
          )
        );
        await Promise.all(playerMappings);

        // Add to active games list
        await this.addToActiveGames(game.id);

        logger.log(`Game ${game.id} saved to Redis with ${game.players.size} players`);
      }

      return saved;
    } catch (error) {
      logger.error('Failed to save game to Redis:', error);
      return false;
    }
  }

  /**
   * Load a game session from Redis
   */
  async loadGame(gameId: string): Promise<GameSession | null> {
    try {
      const serializedGame = await redisCache.get<any>(
        `${KEY_PREFIX.GAME}${gameId}`
      );

      if (!serializedGame) {
        return null;
      }

      // Convert players array back to Map
      const players = new Map<string, Player>();
      if (serializedGame.players && Array.isArray(serializedGame.players)) {
        serializedGame.players.forEach((player: any) => {
          const { id, ...playerData } = player;
          players.set(id, playerData);
        });
      }

      // Reconstruct game session
      const game: GameSession = {
        ...serializedGame,
        players,
        createdAt: new Date(serializedGame.createdAt),
        startedAt: serializedGame.startedAt ? new Date(serializedGame.startedAt) : undefined,
        finishedAt: serializedGame.finishedAt ? new Date(serializedGame.finishedAt) : undefined,
        currentQuestionStartTime: serializedGame.currentQuestionStartTime 
          ? new Date(serializedGame.currentQuestionStartTime) : undefined
      };

      return game;
    } catch (error) {
      logger.error('Failed to load game from Redis:', error);
      return null;
    }
  }

  /**
   * Get game ID by code
   */
  async getGameIdByCode(code: string): Promise<string | null> {
    try {
      const gameId = await redisCache.get<string>(
        `${KEY_PREFIX.CODE_TO_GAME}${code.toUpperCase()}`
      );
      return gameId || null;
    } catch (error) {
      logger.error('Failed to get game ID by code:', error);
      return null;
    }
  }

  /**
   * Get game ID by player ID
   */
  async getGameIdByPlayerId(playerId: string): Promise<string | null> {
    try {
      const gameId = await redisCache.get<string>(
        `${KEY_PREFIX.PLAYER_TO_GAME}${playerId}`
      );
      return gameId || null;
    } catch (error) {
      logger.error('Failed to get game ID by player:', error);
      return null;
    }
  }

  /**
   * Remove a game and all its mappings
   */
  async removeGame(game: GameSession): Promise<void> {
    try {
      // Remove game data
      await redisCache.del(`${KEY_PREFIX.GAME}${game.id}`);

      // Remove code mapping
      await redisCache.del(`${KEY_PREFIX.CODE_TO_GAME}${game.code}`);

      // Remove player mappings
      const playerKeys = Array.from(game.players.keys()).map(
        playerId => `${KEY_PREFIX.PLAYER_TO_GAME}${playerId}`
      );
      if (playerKeys.length > 0) {
        await redisCache.del(playerKeys);
      }

      // Remove from active games list
      await this.removeFromActiveGames(game.id);

      logger.log(`Game ${game.id} removed from Redis`);
    } catch (error) {
      logger.error('Failed to remove game from Redis:', error);
    }
  }

  /**
   * Update player in a game
   */
  async updatePlayer(gameId: string, playerId: string, updates: Partial<Player>): Promise<boolean> {
    try {
      const game = await this.loadGame(gameId);
      if (!game) return false;

      const player = game.players.get(playerId);
      if (!player) return false;

      // Update player
      Object.assign(player, updates);
      game.players.set(playerId, player);

      // Save updated game
      return await this.saveGame(game);
    } catch (error) {
      logger.error('Failed to update player in Redis:', error);
      return false;
    }
  }

  /**
   * Add game to active games list (using atomic Set operations)
   */
  private async addToActiveGames(gameId: string): Promise<void> {
    try {
      // SADD is atomic and idempotent
      await redisCache.sadd(KEY_PREFIX.GAME_LIST, gameId);
    } catch (error) {
      logger.error('Failed to add game to active list:', error);
    }
  }

  /**
   * Remove game from active games list (using atomic Set operations)
   */
  private async removeFromActiveGames(gameId: string): Promise<void> {
    try {
      // SREM is atomic
      await redisCache.srem(KEY_PREFIX.GAME_LIST, gameId);
    } catch (error) {
      logger.error('Failed to remove game from active list:', error);
    }
  }

  /**
   * Get all active game IDs
   */
  async getActiveGameIds(): Promise<string[]> {
    try {
      // SMEMBERS retrieves all members of the set
      return await redisCache.smembers(KEY_PREFIX.GAME_LIST);
    } catch (error) {
      logger.error('Failed to get active games:', error);
      return [];
    }
  }

  /**
   * Clean up expired games
   */
  async cleanupExpiredGames(): Promise<number> {
    try {
      const activeGameIds = await this.getActiveGameIds();
      let cleaned = 0;

      for (const gameId of activeGameIds) {
        const game = await this.loadGame(gameId);
        if (!game) {
          // Game expired or deleted
          await this.removeFromActiveGames(gameId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.log(`Cleaned up ${cleaned} expired games from active list`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup expired games:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const redisGameSessionStore = new RedisGameSessionStore();