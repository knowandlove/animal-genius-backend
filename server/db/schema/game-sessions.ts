import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "../../../shared/schema";

// Game sessions table
export const gameSessions = pgTable("game_sessions", {
  id: varchar("id", { length: 50 }).primaryKey(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  teacherSocketId: varchar("teacher_socket_id", { length: 50 }),
  mode: varchar("mode", { length: 20 }).notNull(), // 'team' or 'individual'
  questionCount: integer("question_count").notNull(),
  timePerQuestion: integer("time_per_question").notNull().default(20),
  status: varchar("status", { length: 20 }).notNull().default('lobby'), // 'lobby', 'playing', 'finished'
  currentQuestionIndex: integer("current_question_index").notNull().default(-1),
  currentQuestionStartTime: timestamp("current_question_start_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (table) => ({
  teacherIdIdx: index("game_sessions_teacher_id_idx").on(table.teacherId),
  statusIdx: index("game_sessions_status_idx").on(table.status),
  createdAtIdx: index("game_sessions_created_at_idx").on(table.createdAt),
}));

// Game players table
export const gamePlayers = pgTable("game_players", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 50 }).notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  socketId: varchar("socket_id", { length: 50 }),
  name: varchar("name", { length: 100 }).notNull(),
  animal: varchar("animal", { length: 50 }).notNull(),
  avatarCustomization: jsonb("avatar_customization").notNull().default('{}'),
  score: integer("score").notNull().default(0),
  currentAnswer: varchar("current_answer", { length: 1 }),
  answerTime: integer("answer_time"),
  connected: boolean("connected").notNull().default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => ({
  gameIdIdx: index("game_players_game_id_idx").on(table.gameId),
  socketIdIdx: index("game_players_socket_id_idx").on(table.socketId),
  gameSocketIdx: index("game_players_game_socket_idx").on(table.gameId, table.socketId),
}));

// Game questions table (stores which questions are selected for each game)
export const gameQuestions = pgTable("game_questions", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 50 }).notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull(),
  questionOrder: integer("question_order").notNull(),
}, (table) => ({
  gameIdIdx: index("game_questions_game_id_idx").on(table.gameId),
  gameOrderIdx: index("game_questions_game_order_idx").on(table.gameId, table.questionOrder),
}));

// Player answers table (for answer history and analytics)
export const playerAnswers = pgTable("player_answers", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 50 }).notNull().references(() => gameSessions.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => gamePlayers.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull(),
  answer: varchar("answer", { length: 1 }).notNull(),
  timeRemaining: integer("time_remaining").notNull(),
  pointsEarned: integer("points_earned").notNull(),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
}, (table) => ({
  gameIdIdx: index("player_answers_game_id_idx").on(table.gameId),
  playerIdIdx: index("player_answers_player_id_idx").on(table.playerId),
}));

// Relations
export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  teacher: one(users, {
    fields: [gameSessions.teacherId],
    references: [users.id],
  }),
  players: many(gamePlayers),
  questions: many(gameQuestions),
  answers: many(playerAnswers),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one, many }) => ({
  game: one(gameSessions, {
    fields: [gamePlayers.gameId],
    references: [gameSessions.id],
  }),
  answers: many(playerAnswers),
}));

export const gameQuestionsRelations = relations(gameQuestions, ({ one }) => ({
  game: one(gameSessions, {
    fields: [gameQuestions.gameId],
    references: [gameSessions.id],
  }),
}));

export const playerAnswersRelations = relations(playerAnswers, ({ one }) => ({
  game: one(gameSessions, {
    fields: [playerAnswers.gameId],
    references: [gameSessions.id],
  }),
  player: one(gamePlayers, {
    fields: [playerAnswers.playerId],
    references: [gamePlayers.id],
  }),
}));

// Types
export type GameSession = typeof gameSessions.$inferSelect;
export type NewGameSession = typeof gameSessions.$inferInsert;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;
export type GameQuestion = typeof gameQuestions.$inferSelect;
export type NewGameQuestion = typeof gameQuestions.$inferInsert;
export type PlayerAnswer = typeof playerAnswers.$inferSelect;
export type NewPlayerAnswer = typeof playerAnswers.$inferInsert;