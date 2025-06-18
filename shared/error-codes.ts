// WebSocket Error Codes
export enum WSErrorCode {
  // Authentication Errors (1000-1099)
  AUTH_REQUIRED = 'WS_AUTH_001',
  AUTH_INVALID_TICKET = 'WS_AUTH_002',
  AUTH_EXPIRED_TICKET = 'WS_AUTH_003',
  AUTH_UNAUTHORIZED_ORIGIN = 'WS_AUTH_004',
  
  // Connection Errors (1100-1199)
  CONNECTION_NOT_IN_GAME = 'WS_CONN_001',
  CONNECTION_ALREADY_IN_GAME = 'WS_CONN_002',
  CONNECTION_RATE_LIMITED = 'WS_CONN_003',
  CONNECTION_INVALID_STATE = 'WS_CONN_004',
  
  // Game Errors (1200-1299)
  GAME_NOT_FOUND = 'WS_GAME_001',
  GAME_CODE_INVALID = 'WS_GAME_002',
  GAME_ALREADY_STARTED = 'WS_GAME_003',
  GAME_NOT_IN_LOBBY = 'WS_GAME_004',
  GAME_NOT_PLAYING = 'WS_GAME_005',
  GAME_FULL = 'WS_GAME_006',
  GAME_ENDED = 'WS_GAME_007',
  GAME_NO_PLAYERS = 'WS_GAME_008',
  GAME_NO_QUESTIONS = 'WS_GAME_009',
  
  // Player Errors (1300-1399)
  PLAYER_NOT_FOUND = 'WS_PLAYER_001',
  PLAYER_NAME_INVALID = 'WS_PLAYER_002',
  PLAYER_NAME_DUPLICATE = 'WS_PLAYER_003',
  PLAYER_ALREADY_ANSWERED = 'WS_PLAYER_004',
  PLAYER_NOT_READY = 'WS_PLAYER_005',
  PLAYER_KICKED = 'WS_PLAYER_006',
  
  // Question/Answer Errors (1400-1499)
  QUESTION_NOT_FOUND = 'WS_QUEST_001',
  QUESTION_ID_MISMATCH = 'WS_QUEST_002',
  ANSWER_INVALID = 'WS_QUEST_003',
  ANSWER_TOO_LATE = 'WS_QUEST_004',
  
  // Message Errors (1500-1599)
  MESSAGE_INVALID_FORMAT = 'WS_MSG_001',
  MESSAGE_UNKNOWN_TYPE = 'WS_MSG_002',
  MESSAGE_MISSING_DATA = 'WS_MSG_003',
  
  // Server Errors (1600-1699)
  SERVER_ERROR = 'WS_SERVER_001',
  SERVER_MAINTENANCE = 'WS_SERVER_002',
}

// Error messages for each code
export const WSErrorMessages: Record<WSErrorCode, string> = {
  // Authentication
  [WSErrorCode.AUTH_REQUIRED]: 'Authentication required for this action',
  [WSErrorCode.AUTH_INVALID_TICKET]: 'Invalid authentication ticket',
  [WSErrorCode.AUTH_EXPIRED_TICKET]: 'Authentication ticket has expired',
  [WSErrorCode.AUTH_UNAUTHORIZED_ORIGIN]: 'Connection from unauthorized origin',
  
  // Connection
  [WSErrorCode.CONNECTION_NOT_IN_GAME]: 'You are not in a game',
  [WSErrorCode.CONNECTION_ALREADY_IN_GAME]: 'You are already in a game',
  [WSErrorCode.CONNECTION_RATE_LIMITED]: 'Too many requests. Please slow down',
  [WSErrorCode.CONNECTION_INVALID_STATE]: 'Invalid connection state',
  
  // Game
  [WSErrorCode.GAME_NOT_FOUND]: 'Game not found',
  [WSErrorCode.GAME_CODE_INVALID]: 'Invalid game code',
  [WSErrorCode.GAME_ALREADY_STARTED]: 'Game has already started',
  [WSErrorCode.GAME_NOT_IN_LOBBY]: 'Game is not in lobby phase',
  [WSErrorCode.GAME_NOT_PLAYING]: 'Game is not currently playing',
  [WSErrorCode.GAME_FULL]: 'Game is full',
  [WSErrorCode.GAME_ENDED]: 'Game has ended',
  [WSErrorCode.GAME_NO_PLAYERS]: 'Cannot start game without players',
  [WSErrorCode.GAME_NO_QUESTIONS]: 'Cannot start game without questions',
  
  // Player
  [WSErrorCode.PLAYER_NOT_FOUND]: 'Player not found',
  [WSErrorCode.PLAYER_NAME_INVALID]: 'Invalid player name',
  [WSErrorCode.PLAYER_NAME_DUPLICATE]: 'Player name already taken',
  [WSErrorCode.PLAYER_ALREADY_ANSWERED]: 'You have already answered this question',
  [WSErrorCode.PLAYER_NOT_READY]: 'Not all players are ready',
  [WSErrorCode.PLAYER_KICKED]: 'You have been kicked from the game',
  
  // Question/Answer
  [WSErrorCode.QUESTION_NOT_FOUND]: 'Question not found',
  [WSErrorCode.QUESTION_ID_MISMATCH]: 'Answer is for wrong question',
  [WSErrorCode.ANSWER_INVALID]: 'Invalid answer format',
  [WSErrorCode.ANSWER_TOO_LATE]: 'Answer submitted after time limit',
  
  // Message
  [WSErrorCode.MESSAGE_INVALID_FORMAT]: 'Invalid message format',
  [WSErrorCode.MESSAGE_UNKNOWN_TYPE]: 'Unknown message type',
  [WSErrorCode.MESSAGE_MISSING_DATA]: 'Missing required data',
  
  // Server
  [WSErrorCode.SERVER_ERROR]: 'Internal server error',
  [WSErrorCode.SERVER_MAINTENANCE]: 'Server is under maintenance',
};

// Helper to create error response
export interface WSError {
  code: WSErrorCode;
  message: string;
  details?: any;
}

export function createWSError(code: WSErrorCode, details?: any): WSError {
  return {
    code,
    message: WSErrorMessages[code],
    details
  };
}