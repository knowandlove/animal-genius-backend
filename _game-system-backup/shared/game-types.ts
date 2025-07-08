// Game Types and Interfaces for the Quiz Game System

export type AnimalType = 'Meerkat' | 'Panda' | 'Owl' | 'Beaver' | 'Elephant' | 'Otter' | 'Parrot' | 'Border Collie';
export type AnimalGeniusType = 'Thinker' | 'Feeler' | 'Doer';

export type GameStatus = 'lobby' | 'playing' | 'finished';
export type GameMode = 'team' | 'individual';

// Type aliases for backward compatibility
export type GameState = GameSession;
export type GamePlayer = Player;

export interface GameSettings {
  mode: GameMode;
  questionCount: number;
  timePerQuestion: number; // in seconds
}

export interface AvatarCustomization {
  glasses?: 'round' | 'square' | 'star';
  hat?: 'cap' | 'party' | 'crown';
  neckItem?: 'bowtie' | 'scarf' | 'necklace';
}

export interface Player {
  id: string; // socket id
  name: string;
  animal: AnimalType;
  avatar: AvatarCustomization;
  score: number;
  currentAnswer?: string;
  answerTime?: number;
  connected: boolean;
  joinedAt: Date;
}

export interface GameQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  category: 'habitat' | 'diet' | 'behavior' | 'facts';
  imageUrl?: string;
}

export interface GameSession {
  id: string;
  code: string; // 6-character join code
  teacherId: string; // UUID from profiles table
  teacherSocketId?: string;
  settings: GameSettings;
  status: GameStatus;
  currentQuestionIndex: number;
  currentQuestionStartTime?: Date;
  players: Map<string, Player>; // socketId -> Player
  questions: GameQuestion[];
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface GameResults {
  gameId: string;
  mode: GameMode;
  winners: {
    individual?: Player[];
    team?: { animal: AnimalType; score: number; players: Player[] }[];
  };
  finalScores: {
    players: { player: Player; rank: number }[];
    teams?: { animal: AnimalType; totalScore: number; rank: number }[];
  };
}

// WebSocket Event Types
export interface WSMessage<T = any> {
  type: string;
  data: T;
}

export interface JoinGameData {
  gameCode: string;
  playerName: string;
}

export interface SelectAnimalData {
  animal: AnimalType;
}

export interface CustomizeAvatarData {
  customization: AvatarCustomization;
}

export interface SubmitAnswerData {
  questionId: number;
  answer: 'A' | 'B' | 'C' | 'D';
  timeRemaining: number;
}

export interface PlayerJoinedData {
  player: Player;
  totalPlayers: number;
}

export interface GameStartedData {
  firstQuestion: GameQuestion;
  questionNumber: number;
  totalQuestions: number;
}

export interface QuestionResultData {
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  playerResults: {
    playerId: string;
    correct: boolean;
    points: number;
    newScore: number;
  }[];
  leaderboard: {
    players: { player: Player; rank: number }[];
    teams?: { animal: AnimalType; score: number; rank: number }[];
  };
}

// Helper function to generate game codes
export function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Calculate points based on correct answer and time remaining
export function calculatePoints(isCorrect: boolean, timeRemaining: number, maxTime: number): number {
  if (!isCorrect) return 0;
  
  const basePoints = 100;
  const timeBonus = Math.floor((timeRemaining / maxTime) * 50);
  
  return basePoints + timeBonus;
}

// Get animal genius type from animal
export function getAnimalGenius(animal: AnimalType): AnimalGeniusType {
  const geniusMap: Record<AnimalType, AnimalGeniusType> = {
    'Owl': 'Thinker',
    'Parrot': 'Thinker',
    'Meerkat': 'Feeler',
    'Elephant': 'Feeler',
    'Panda': 'Feeler',
    'Beaver': 'Doer',
    'Otter': 'Doer',
    'Border Collie': 'Doer'
  };
  
  return geniusMap[animal];
}