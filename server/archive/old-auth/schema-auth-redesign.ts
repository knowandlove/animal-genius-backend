// New authentication tables for the redesigned system
// This extends the existing schema.ts file

import { pgTable, text, varchar, integer, boolean, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { classes, students, profiles } from './schema';

// Activations table - tracks payment and activation codes
export const activations = pgTable('activations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'restrict' }),
  parentEmail: text('parent_email').notNull(),
  activationCode: varchar('activation_code', { length: 20 }).notNull().unique(),
  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
  isActivated: boolean('is_activated').default(false).notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  activatedByStudentId: uuid('activated_by_student_id').references(() => students.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    classIdIdx: index('idx_activations_class_id').on(table.classId),
    activationCodeIdx: index('idx_activations_activation_code').on(table.activationCode),
    parentEmailIdx: index('idx_activations_parent_email').on(table.parentEmail),
    stripePaymentIntentIdx: index('idx_activations_stripe_payment_intent_id').on(table.stripePaymentIntentId),
    expiresAtIdx: index('idx_activations_expires_at').on(table.expiresAt),
    isActivatedIdx: index('idx_activations_is_activated').on(table.isActivated),
  };
});

// Classroom sessions table - temporary access codes for classroom login
export const classroomSessions = pgTable('classroom_sessions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  sessionCode: varchar('session_code', { length: 20 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: uuid('created_by').notNull().references(() => profiles.id),
}, (table) => {
  return {
    classIdIdx: index('idx_classroom_sessions_class_id').on(table.classId),
    sessionCodeIdx: index('idx_classroom_sessions_session_code').on(table.sessionCode),
    expiresAtIdx: index('idx_classroom_sessions_expires_at').on(table.expiresAt),
    isActiveIdx: index('idx_classroom_sessions_is_active').on(table.isActive),
  };
});

// Relations for new tables
export const activationsRelations = relations(activations, ({ one, many }) => ({
  class: one(classes, {
    fields: [activations.classId],
    references: [classes.id],
  }),
  activatedByStudent: one(students, {
    fields: [activations.activatedByStudentId],
    references: [students.id],
  }),
}));

export const classroomSessionsRelations = relations(classroomSessions, ({ one }) => ({
  class: one(classes, {
    fields: [classroomSessions.classId],
    references: [classes.id],
  }),
  createdByTeacher: one(profiles, {
    fields: [classroomSessions.createdBy],
    references: [profiles.id],
  }),
}));

// Type exports for the new tables
export type Activation = typeof activations.$inferSelect;
export type NewActivation = typeof activations.$inferInsert;
export type ClassroomSession = typeof classroomSessions.$inferSelect;
export type NewClassroomSession = typeof classroomSessions.$inferInsert;

// Updated types for modified tables (to be merged with main schema.ts)
export interface UpdatedStudent {
  funCode?: string | null;
  avatarId?: string | null;
  activationId?: string | null;
}

export interface UpdatedClass {
  maxStudents?: number;
  paymentLink?: string | null;
  stripePriceId?: string | null;
}