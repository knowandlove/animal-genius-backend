// Additional tables found in database that need to be added to schema.ts
// Add these to your shared/schema.ts file to prevent Drizzle from dropping them

// Animals table (different from animal_types - stores avatar image metadata)
export const animals = pgTable('animals', {
  animalType: varchar('animal_type', { length: 50 }).primaryKey(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  imagePath: varchar('image_path', { length: 255 }).notNull(),
  naturalWidth: integer('natural_width').notNull(),
  naturalHeight: integer('natural_height').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lessons table (database storage for lessons, though app uses TypeScript files)
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  code: varchar('code', { length: 50 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  subject: varchar('subject', { length: 100 }),
  gradeLevel: varchar('grade_level', { length: 50 }),
  durationMinutes: integer('duration_minutes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Item metadata table
export const itemMetadata = pgTable('item_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Quiz answer types table
export const quizAnswerTypes = pgTable('quiz_answer_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionType: varchar('question_type', { length: 50 }).notNull(),
  answerOptions: jsonb('answer_options').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Passport codes table
export const passportCodes = pgTable('passport_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  studentId: uuid('student_id').references(() => students.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Class values table (different from class_values_results)
export const classValues = pgTable('class_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  valueCode: varchar('value_code', { length: 50 }).notNull(),
  valueName: varchar('value_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Type exports for the new tables
export type Animal = typeof animals.$inferSelect;
export type NewAnimal = typeof animals.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type ItemMetadata = typeof itemMetadata.$inferSelect;
export type NewItemMetadata = typeof itemMetadata.$inferInsert;
export type QuizAnswerType = typeof quizAnswerTypes.$inferSelect;
export type NewQuizAnswerType = typeof quizAnswerTypes.$inferInsert;
export type PassportCode = typeof passportCodes.$inferSelect;
export type NewPassportCode = typeof passportCodes.$inferInsert;
export type ClassValue = typeof classValues.$inferSelect;
export type NewClassValue = typeof classValues.$inferInsert;
