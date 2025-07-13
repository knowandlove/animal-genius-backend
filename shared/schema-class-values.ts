// CLASS VALUES VOTING SYSTEM TABLES
// Add these to the main schema.ts file

import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, uuid, numeric, uniqueIndex, index, pgSchema } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { classes, students, profiles } from './schema';

// Class values voting sessions
export const classValuesSessions = pgTable('class_values_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  startedBy: uuid('started_by').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'completed', 'cancelled'
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(sql`NOW() + INTERVAL '24 hours'`),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    classIdIdx: index('idx_class_values_sessions_class_id').on(table.classId),
    statusIdx: index('idx_class_values_sessions_status').on(table.status),
    activeIdx: index('idx_class_values_sessions_active').on(table.classId, table.status).where(sql`status = 'active'`),
  };
});

// Individual student votes
export const classValuesVotes = pgTable('class_values_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => classValuesSessions.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  clusterNumber: integer('cluster_number').notNull(), // 1-4
  valueCode: varchar('value_code', { length: 50 }).notNull(),
  valueName: varchar('value_name', { length: 100 }).notNull(),
  voteRank: integer('vote_rank').notNull(), // 1st, 2nd, or 3rd choice
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueVote: uniqueIndex('unique_session_student_cluster_rank').on(
      table.sessionId, 
      table.studentId, 
      table.clusterNumber, 
      table.voteRank
    ),
    sessionIdIdx: index('idx_class_values_votes_session_id').on(table.sessionId),
    studentIdIdx: index('idx_class_values_votes_student_id').on(table.studentId),
    countingIdx: index('idx_class_values_votes_counting').on(table.sessionId, table.clusterNumber, table.valueCode),
  };
});

// Final class values results
export const classValuesResults = pgTable('class_values_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().references(() => classValuesSessions.id, { onDelete: 'cascade' }),
  clusterNumber: integer('cluster_number').notNull(), // 1-4
  valueCode: varchar('value_code', { length: 50 }).notNull(),
  valueName: varchar('value_name', { length: 100 }).notNull(),
  voteCount: integer('vote_count').notNull().default(0),
  isWinner: boolean('is_winner').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueResult: uniqueIndex('unique_class_cluster_value').on(table.classId, table.clusterNumber, table.valueCode),
    classIdIdx: index('idx_class_values_results_class_id').on(table.classId),
    winnersIdx: index('idx_class_values_results_winners').on(table.classId, table.isWinner).where(sql`is_winner = true`),
  };
});

// Relations
export const classValuesSessionsRelations = relations(classValuesSessions, ({ one, many }) => ({
  class: one(classes, {
    fields: [classValuesSessions.classId],
    references: [classes.id],
  }),
  startedByTeacher: one(profiles, {
    fields: [classValuesSessions.startedBy],
    references: [profiles.id],
  }),
  votes: many(classValuesVotes),
  results: many(classValuesResults),
}));

export const classValuesVotesRelations = relations(classValuesVotes, ({ one }) => ({
  session: one(classValuesSessions, {
    fields: [classValuesVotes.sessionId],
    references: [classValuesSessions.id],
  }),
  student: one(students, {
    fields: [classValuesVotes.studentId],
    references: [students.id],
  }),
}));

export const classValuesResultsRelations = relations(classValuesResults, ({ one }) => ({
  class: one(classes, {
    fields: [classValuesResults.classId],
    references: [classes.id],
  }),
  session: one(classValuesSessions, {
    fields: [classValuesResults.sessionId],
    references: [classValuesSessions.id],
  }),
}));

// Type exports
export type ClassValuesSession = typeof classValuesSessions.$inferSelect;
export type NewClassValuesSession = typeof classValuesSessions.$inferInsert;
export type ClassValuesVote = typeof classValuesVotes.$inferSelect;
export type NewClassValuesVote = typeof classValuesVotes.$inferInsert;
export type ClassValuesResult = typeof classValuesResults.$inferSelect;
export type NewClassValuesResult = typeof classValuesResults.$inferInsert;

// ADD TO schema.ts classes table:
// hasValuesSet: boolean('has_values_set').default(false),
// valuesSetAt: timestamp('values_set_at', { withTimezone: true }),

// ADD TO classesRelations:
// valuesSessions: many(classValuesSessions),
// valuesResults: many(classValuesResults),

// ADD TO studentsRelations:
// valuesVotes: many(classValuesVotes),
