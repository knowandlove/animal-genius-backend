// CORRECTED: Additional tables found in database that need to be added to schema.ts
// Add these to your shared/schema.ts file to prevent Drizzle from dropping them

import { pgTable, varchar, integer, timestamp, uuid, text, boolean, jsonb, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { students } from './schema';

// Animals table (different from animal_types - stores avatar image metadata)
export const animals = pgTable('animals', {
  animalType: varchar('animal_type', { length: 50 }).primaryKey(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  imagePath: varchar('image_path', { length: 255 }).notNull(),
  naturalWidth: integer('natural_width').notNull(),
  naturalHeight: integer('natural_height').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lessons table (database storage for lessons)
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  code: varchar('code', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  subject: varchar('subject', { length: 100 }),
  gradeLevel: varchar('grade_level', { length: 50 }),
  durationMinutes: integer('duration_minutes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Item metadata table - stores dimensions and anchor points for items
export const itemMetadata = pgTable('item_metadata', {
  itemId: varchar('item_id', { length: 255 }).primaryKey(),
  itemType: varchar('item_type', { length: 50 }),
  naturalWidth: integer('natural_width'),
  naturalHeight: integer('natural_height'),
  defaultAnchorX: numeric('default_anchor_x', { precision: 3, scale: 2 }).default('0.5'),
  defaultAnchorY: numeric('default_anchor_y', { precision: 3, scale: 2 }).default('0.5'),
});

// Quiz answer types table - you'll need to check the actual structure
export const quizAnswerTypes = pgTable('quiz_answer_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionType: varchar('question_type', { length: 50 }),
  answerOptions: jsonb('answer_options'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// If you see other tables in the error, add them here following the same pattern

// Type exports for the new tables
export type Animal = typeof animals.$inferSelect;
export type NewAnimal = typeof animals.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type ItemMetadata = typeof itemMetadata.$inferSelect;
export type NewItemMetadata = typeof itemMetadata.$inferInsert;
export type QuizAnswerType = typeof quizAnswerTypes.$inferSelect;
export type NewQuizAnswerType = typeof quizAnswerTypes.$inferInsert;