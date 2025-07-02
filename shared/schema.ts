import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, uuid, numeric, uniqueIndex, index, pgSchema } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Define the auth schema to reference auth.users
const authSchema = pgSchema('auth');

// Reference to auth.users table (for foreign key purposes only)
const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

// Animal types table
export const animalTypes = pgTable('animal_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  personalityType: varchar('personality_type', { length: 4 }),
  geniusType: varchar('genius_type', { length: 100 }),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Genius types table
export const geniusTypes = pgTable('genius_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Profiles table (extends Supabase auth.users)
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  schoolOrganization: varchar('school_organization', { length: 255 }),
  roleTitle: varchar('role_title', { length: 255 }),
  howHeardAbout: varchar('how_heard_about', { length: 255 }),
  personalityAnimal: varchar('personality_animal', { length: 50 }),
  isAdmin: boolean('is_admin').default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Classes table
export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }),
  gradeLevel: varchar('grade_level', { length: 50 }),
  classCode: varchar('class_code', { length: 20 }).notNull().unique(),
  schoolName: varchar('school_name', { length: 255 }),
  icon: varchar('icon', { length: 50 }).default('book'),
  backgroundColor: varchar('background_color', { length: 7 }).default('#829B79'),
  numberOfStudents: integer('number_of_students'),
  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => {
  return {
    teacherIdIdx: index('idx_classes_teacher_id').on(table.teacherId),
    activeIdx: index('idx_classes_active').on(table.teacherId).where(sql`deleted_at IS NULL`),
  };
});

// Students table
export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'restrict' }),
  passportCode: varchar('passport_code', { length: 20 }).notNull().unique(),
  // Profile fields
  studentName: varchar('student_name', { length: 255 }),
  gradeLevel: varchar('grade_level', { length: 50 }),
  personalityType: varchar('personality_type', { length: 20 }),
  animalTypeId: uuid('animal_type_id').references(() => animalTypes.id, { onDelete: 'set null' }),
  geniusTypeId: uuid('genius_type_id').references(() => geniusTypes.id, { onDelete: 'set null' }),
  learningStyle: varchar('learning_style', { length: 50 }),
  // Game state
  currencyBalance: integer('currency_balance').default(0),
  avatarData: jsonb('avatar_data').default({}),
  roomData: jsonb('room_data').default({ furniture: [] }),
  roomVisibility: varchar('room_visibility', { length: 20 }).default('class'), // 'private', 'class', 'invite_only'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    classIdIdx: index('idx_students_class_id').on(table.classId),
    passportCodeIdx: index('idx_students_passport_code').on(table.passportCode),
    uniqueClassStudent: uniqueIndex('unique_class_student').on(table.classId, table.studentName),
  };
});

// Quiz submissions
export const quizSubmissions = pgTable('quiz_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  animalTypeId: uuid('animal_type_id').notNull().references(() => animalTypes.id, { onDelete: 'restrict' }),
  geniusTypeId: uuid('genius_type_id').notNull().references(() => geniusTypes.id, { onDelete: 'restrict' }),
  answers: jsonb('answers').notNull(),
  coinsEarned: integer('coins_earned').default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentIdIdx: index('idx_quiz_submissions_student_id').on(table.studentId),
  };
});

// Assets table
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  publicUrl: text('public_url').notNull(),
  category: varchar('category', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Item types table
export const itemTypes = pgTable('item_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Store items
export const storeItems = pgTable('store_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  itemTypeId: uuid('item_type_id').notNull().references(() => itemTypes.id, { onDelete: 'restrict' }),
  cost: integer('cost').notNull(),
  rarity: varchar('rarity', { length: 20 }).default('common'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    assetIdIdx: index('idx_store_items_asset_id').on(table.assetId),
    activeIdx: index('idx_store_items_active').on(table.isActive).where(sql`is_active = true`),
  };
});

// Purchase requests - REMOVED (we no longer use a purchase request system)
// export const purchaseRequests = pgTable('purchase_requests', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
//   storeItemId: uuid('store_item_id').notNull().references(() => storeItems.id, { onDelete: 'cascade' }),
//   // Historical snapshot fields (intentionally denormalized for audit purposes)
//   itemType: varchar('item_type', { length: 50 }), // Snapshot of item type at request time
//   cost: integer('cost'), // Snapshot of cost at request time
//   status: varchar('status', { length: 20 }).default('pending'),
//   requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
//   processedAt: timestamp('processed_at', { withTimezone: true }),
//   processedBy: uuid('processed_by').references(() => profiles.id, { onDelete: 'set null' }),
//   notes: text('notes'),
// }, (table) => {
//   return {
//     studentIdIdx: index('idx_purchase_requests_student_id').on(table.studentId),
//     storeItemIdIdx: index('idx_purchase_requests_store_item_id').on(table.storeItemId),
//     processedByIdx: index('idx_purchase_requests_processed_by').on(table.processedBy),
//     statusIdx: index('idx_purchase_requests_status').on(table.status),
//     studentStatusIdx: index('idx_purchase_requests_student_status').on(table.studentId, table.status),
//   };
// });

// Student inventory
export const studentInventory = pgTable('student_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  storeItemId: uuid('store_item_id').notNull().references(() => storeItems.id, { onDelete: 'cascade' }),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow(),
  isEquipped: boolean('is_equipped').default(false),
}, (table) => {
  return {
    uniqueStudentItem: uniqueIndex('unique_student_item').on(table.studentId, table.storeItemId),
    studentIdIdx: index('idx_student_inventory_student_id').on(table.studentId),
    storeItemIdIdx: index('idx_student_inventory_store_item_id').on(table.storeItemId),
  };
});

// Currency transactions
export const currencyTransactions = pgTable('currency_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  teacherId: uuid('teacher_id').references(() => profiles.id, { onDelete: 'set null' }), // Made nullable to preserve history
  amount: integer('amount').notNull(),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentIdIdx: index('idx_currency_transactions_student_id').on(table.studentId),
    teacherIdIdx: index('idx_currency_transactions_teacher_id').on(table.teacherId),
  };
});


// Store settings
export const storeSettings = pgTable('store_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }).unique(),
  classId: uuid('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  isOpen: boolean('is_open').default(false),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  autoApprovalThreshold: integer('auto_approval_threshold'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    classIdIdx: index('idx_store_settings_class_id').on(table.classId),
  };
});

// Admin logs
export const adminLogs = pgTable('admin_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }), // Changed to preserve audit trail
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  targetUserId: uuid('target_user_id').references(() => profiles.id, { onDelete: 'set null' }),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    adminIdIdx: index('idx_admin_logs_admin_id').on(table.adminId),
    targetUserIdIdx: index('idx_admin_logs_target_user_id').on(table.targetUserId),
  };
});

// Item animal positions
export const itemAnimalPositions = pgTable('item_animal_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemTypeId: uuid('item_type_id').notNull().references(() => itemTypes.id, { onDelete: 'restrict' }),
  animalTypeId: uuid('animal_type_id').notNull().references(() => animalTypes.id, { onDelete: 'restrict' }),
  xPosition: numeric('x_position', { precision: 5, scale: 2 }).default('50'),
  yPosition: numeric('y_position', { precision: 5, scale: 2 }).default('50'),
  scale: numeric('scale', { precision: 3, scale: 2 }).default('1.0'),
  rotation: integer('rotation').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueItemAnimal: uniqueIndex('unique_item_animal').on(table.itemTypeId, table.animalTypeId),
  };
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  classes: many(classes),
  adminLogs: many(adminLogs),
  currencyTransactions: many(currencyTransactions),
  storeSettings: many(storeSettings),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(profiles, {
    fields: [classes.teacherId],
    references: [profiles.id],
  }),
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  quizSubmissions: many(quizSubmissions),
  inventory: many(studentInventory),
  currencyTransactions: many(currencyTransactions),
}));

export const quizSubmissionsRelations = relations(quizSubmissions, ({ one }) => ({
  student: one(students, {
    fields: [quizSubmissions.studentId],
    references: [students.id],
  }),
}));

export const assetsRelations = relations(assets, ({ many }) => ({
  storeItems: many(storeItems),
}));

export const storeItemsRelations = relations(storeItems, ({ one, many }) => ({
  asset: one(assets, {
    fields: [storeItems.assetId],
    references: [assets.id],
  }),
  studentInventory: many(studentInventory),
}));

// TODO: purchaseRequests table needs to be defined before enabling these relations

export const studentInventoryRelations = relations(studentInventory, ({ one }) => ({
  student: one(students, {
    fields: [studentInventory.studentId],
    references: [students.id],
  }),
  storeItem: one(storeItems, {
    fields: [studentInventory.storeItemId],
    references: [storeItems.id],
  }),
}));

export const currencyTransactionsRelations = relations(currencyTransactions, ({ one }) => ({
  student: one(students, {
    fields: [currencyTransactions.studentId],
    references: [students.id],
  }),
  teacher: one(profiles, {
    fields: [currencyTransactions.teacherId],
    references: [profiles.id],
  }),
}));


export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  teacher: one(profiles, {
    fields: [storeSettings.teacherId],
    references: [profiles.id],
  }),
  class: one(classes, {
    fields: [storeSettings.classId],
    references: [classes.id],
  }),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(profiles, {
    fields: [adminLogs.adminId],
    references: [profiles.id],
  }),
  targetUser: one(profiles, {
    fields: [adminLogs.targetUserId],
    references: [profiles.id],
  }),
}));

// Type exports for convenience
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type NewQuizSubmission = typeof quizSubmissions.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type StoreItem = typeof storeItems.$inferSelect;
export type NewStoreItem = typeof storeItems.$inferInsert;
// export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
// export type NewPurchaseRequest = typeof purchaseRequests.$inferInsert;
export type StudentInventory = typeof studentInventory.$inferSelect;
export type NewStudentInventory = typeof studentInventory.$inferInsert;
export type CurrencyTransaction = typeof currencyTransactions.$inferSelect;
export type NewCurrencyTransaction = typeof currencyTransactions.$inferInsert;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type NewStoreSettings = typeof storeSettings.$inferInsert;
export type AdminLog = typeof adminLogs.$inferSelect;
export type NewAdminLog = typeof adminLogs.$inferInsert;
export type ItemAnimalPosition = typeof itemAnimalPositions.$inferSelect;
export type NewItemAnimalPosition = typeof itemAnimalPositions.$inferInsert;