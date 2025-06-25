import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// SUPABASE AUTH INTEGRATION
// ============================================

// Profiles table - links to Supabase auth.users
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(), // UUID from auth.users
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  schoolOrganization: text("school_organization").notNull(),
  roleTitle: text("role_title"),
  howHeardAbout: text("how_heard_about"),
  personalityAnimal: varchar("personality_animal", { length: 50 }),
  isAdmin: boolean("is_admin").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// EXISTING TABLES (unchanged)
// ============================================

// Users table for teachers
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  schoolOrganization: text("school_organization").notNull(),
  roleTitle: text("role_title"),
  howHeardAbout: text("how_heard_about"),
  personalityAnimal: varchar("personality_animal", { length: 50 }),
  isAdmin: boolean("is_admin").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Classes table
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  teacherId: integer("teacher_id").notNull(),
  iconEmoji: text("icon_emoji").default("📚"),
  iconColor: text("icon_color").default("#c5d49f"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Students table - Primary table for student profiles
export const students = pgTable("students", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  classId: integer("class_id").references(() => classes.id),
  displayName: text("display_name").notNull(),
  studentName: text("student_name").notNull(),
  passportCode: varchar("passport_code", { length: 8 }).notNull().unique(),
  walletBalance: integer("wallet_balance").default(0).notNull(),
  pendingBalance: integer("pending_balance").default(0).notNull(),
  currencyBalance: integer("currency_balance").default(0).notNull(),
  gradeLevel: text("grade_level"),
  animalType: text("animal_type").notNull().default('meerkat'),
  animalGenius: text("animal_genius").notNull().default('Feeler'),
  personalityType: varchar("personality_type", { length: 4 }),
  learningStyle: text("learning_style"),
  learningScores: jsonb("learning_scores").default('{}').notNull(),
  avatarData: jsonb("avatar_data").default('{}').notNull(),
  roomData: jsonb("room_data").default('{}').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quiz submissions table - Only for quiz attempts, not student profiles
export const quizSubmissions = pgTable("quiz_submissions", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").references(() => students.id),
  classId: integer("class_id").notNull(),
  studentName: text("student_name").notNull(),
  gradeLevel: text("grade_level"),
  answers: jsonb("answers").notNull(),
  personalityType: varchar("personality_type", { length: 4 }).notNull(),
  animalType: text("animal_type").notNull(),
  animalGenius: text("animal_genius").default("Feeler").notNull(),
  scores: jsonb("scores").notNull(),
  learningStyle: text("learning_style").notNull(),
  learningScores: jsonb("learning_scores").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

// Lesson progress tracking
export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => users.id).notNull(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  lessonId: integer("lesson_id").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

// Admin logs table
export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  action: text("action").notNull(),
  targetUserId: integer("target_user_id").references(() => users.id),
  targetClassId: integer("target_class_id").references(() => classes.id),
  targetSubmissionId: integer("target_submission_id").references(() => quizSubmissions.id),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Currency system tables
export const currencyTransactions = pgTable("currency_transactions", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").references(() => students.id).notNull(),
  teacherId: integer("teacher_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 255 }),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  isOpen: boolean("is_open").default(false).notNull(),
  openedAt: timestamp("opened_at"),
  closesAt: timestamp("closes_at"),
  autoApprovalThreshold: integer("auto_approval_threshold"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseRequests = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  studentId: text("student_id").references(() => students.id).notNull(),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  itemId: varchar("item_id", { length: 50 }).notNull(),
  cost: integer("cost").notNull(),
  status: varchar("status", { length: 20 }).default('pending').notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
});

// ============================================
// REDESIGNED STORE TABLES
// ============================================

// Assets table - manages all uploaded files
export const assets = pgTable("assets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: varchar("type", { length: 50 }).notNull(), // 'animal', 'item', 'ui', 'user'
  category: varchar("category", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  bucket: varchar("bucket", { length: 50 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 50 }),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  variants: jsonb("variants").default('{}'),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  status: text("status").default('pending'),
  expiresAt: timestamp("expires_at"),
});

// Store items table - simplified with required asset reference
export const storeItems = pgTable("store_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  itemType: varchar("item_type", { length: 50 }).notNull(),
  cost: integer("cost").notNull(),
  assetId: text("asset_id").notNull().references(() => assets.id), // Now required!
  rarity: varchar("rarity", { length: 20 }).default('common').notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Item positioning table
export const itemAnimalPositions = pgTable("item_animal_positions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  itemId: text("item_id").notNull().references(() => storeItems.id),
  animalType: varchar("animal_type", { length: 20 }).notNull(),
  positionX: integer("position_x").default(0).notNull(),
  positionY: integer("position_y").default(0).notNull(),
  scale: integer("scale").default(100).notNull(), // Store as percentage (100 = 1.0)
  rotation: integer("rotation").default(0).notNull(), // Store in degrees
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// RELATIONS
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  classes: many(classes),
  lessonProgress: many(lessonProgress),
  currencyTransactions: many(currencyTransactions),
  processedPurchases: many(purchaseRequests),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classes.teacherId],
    references: [users.id],
  }),
  submissions: many(quizSubmissions),
  lessonProgress: many(lessonProgress),
  storeSettings: many(storeSettings),
  students: many(students),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  submissions: many(quizSubmissions),
  currencyTransactions: many(currencyTransactions),
  purchaseRequests: many(purchaseRequests),
}));

export const quizSubmissionsRelations = relations(quizSubmissions, ({ one }) => ({
  class: one(classes, {
    fields: [quizSubmissions.classId],
    references: [classes.id],
  }),
  student: one(students, {
    fields: [quizSubmissions.studentId],
    references: [students.id],
  }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  teacher: one(users, {
    fields: [lessonProgress.teacherId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [lessonProgress.classId],
    references: [classes.id],
  }),
}));

export const currencyTransactionsRelations = relations(currencyTransactions, ({ one }) => ({
  student: one(students, {
    fields: [currencyTransactions.studentId],
    references: [students.id],
  }),
  teacher: one(users, {
    fields: [currencyTransactions.teacherId],
    references: [users.id],
  }),
}));

export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  class: one(classes, {
    fields: [storeSettings.classId],
    references: [classes.id],
  }),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one }) => ({
  student: one(students, {
    fields: [purchaseRequests.studentId],
    references: [students.id],
  }),
  processedByUser: one(users, {
    fields: [purchaseRequests.processedBy],
    references: [users.id],
  }),
}));

// Store relations
export const assetsRelations = relations(assets, ({ many }) => ({
  storeItems: many(storeItems),
}));

export const storeItemsRelations = relations(storeItems, ({ one, many }) => ({
  asset: one(assets, {
    fields: [storeItems.assetId],
    references: [assets.id],
  }),
  positions: many(itemAnimalPositions),
}));

export const itemAnimalPositionsRelations = relations(itemAnimalPositions, ({ one }) => ({
  item: one(storeItems, {
    fields: [itemAnimalPositions.itemId],
    references: [storeItems.id],
  }),
}));

// ============================================
// ZOD SCHEMAS
// ============================================

// Existing schemas (unchanged)
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const updateUserProfileSchema = createInsertSchema(users).omit({
  id: true,
  password: true,
  createdAt: true,
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const insertClassSchema = createInsertSchema(classes).omit({
  id: true,
  code: true,
  createdAt: true,
});

export const insertQuizSubmissionSchema = createInsertSchema(quizSubmissions).omit({
  id: true,
  completedAt: true,
}).extend({
  learningScores: z.object({
    visual: z.number(),
    auditory: z.number(),
    kinesthetic: z.number(),
    readingWriting: z.number(),
  }),
});

export const insertLessonProgressSchema = createInsertSchema(lessonProgress).omit({
  id: true,
  completedAt: true,
});

export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({
  id: true,
  timestamp: true,
});

// Currency system schemas
export const insertCurrencyTransactionSchema = createInsertSchema(currencyTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettings).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({
  id: true,
  requestedAt: true,
});

export const giveCurrencySchema = z.object({
  studentId: z.number().positive(),
  amount: z.number().positive().max(1000),
  reason: z.string().min(1).max(255),
});

export const purchaseRequestSchema = z.object({
  itemType: z.enum(['avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration', 'room_wallpaper', 'room_flooring']),
  itemId: z.string().min(1).max(50),
  cost: z.number().positive().max(10000),
});

// Avatar and room data schemas
export const avatarDataSchema = z.object({
  hat: z.string().optional(),
  accessory: z.string().optional(),
  color: z.string().optional(),
}).default({});

export const furnitureItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number().min(0).max(3),
  y: z.number().min(0).max(3),
});

export const roomDataSchema = z.object({
  furniture: z.array(furnitureItemSchema).default([]),
  wallpaper: z.string().optional(),
  flooring: z.string().optional(),
}).default({ furniture: [] });

// ============================================
// NEW STORE SCHEMAS
// ============================================

// Asset schemas
export const assetStatusEnum = z.enum(['pending', 'active', 'deleted']);
export const assetTypeEnum = z.enum(['avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration', 'room_wallpaper', 'room_flooring']);

export const prepareAssetUploadSchema = z.object({
  type: assetTypeEnum,
  fileName: z.string().min(1).max(255),
});

export const createAssetSchema = z.object({
  type: z.string(),
  category: z.string().optional(),
  name: z.string(),
  bucket: z.string(),
  path: z.string(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  variants: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  status: assetStatusEnum.default('pending'),
});

// Store item schemas
export const itemTypeEnum = z.enum(['avatar_hat', 'avatar_accessory', 'room_furniture', 'room_decoration', 'room_wallpaper', 'room_flooring']);
export const rarityEnum = z.enum(['common', 'rare', 'legendary']);

export const createStoreItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  itemType: itemTypeEnum,
  cost: z.number().int().positive().max(10000),
  assetId: z.string().uuid(), // Now required!
  rarity: rarityEnum.default('common'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateStoreItemSchema = createStoreItemSchema.partial().omit({ assetId: true });

// Item position schemas
export const animalTypeEnum = z.enum(['dog', 'cat', 'owl', 'panther', 'dolphin', 'eagle', 'bear', 'octopus']);

export const createItemPositionSchema = z.object({
  itemId: z.string().uuid(),
  animalType: animalTypeEnum,
  positionX: z.number().int().default(0),
  positionY: z.number().int().default(0),
  scale: z.number().int().min(10).max(200).default(100),
  rotation: z.number().int().min(-360).max(360).default(0),
});

export const updateItemPositionSchema = createItemPositionSchema.partial().omit({ itemId: true, animalType: true });

// ============================================
// TYPES
// ============================================

// Existing types
export type Profile = typeof profiles.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;
export type UpdatePassword = z.infer<typeof updatePasswordSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Student = typeof students.$inferSelect;
export type QuizSubmission = typeof quizSubmissions.$inferSelect;
export type InsertQuizSubmission = z.infer<typeof insertQuizSubmissionSchema>;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = z.infer<typeof insertLessonProgressSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;

// Currency types
export type CurrencyTransaction = typeof currencyTransactions.$inferSelect;
export type InsertCurrencyTransaction = z.infer<typeof insertCurrencyTransactionSchema>;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;
export type GiveCurrencyData = z.infer<typeof giveCurrencySchema>;
export type PurchaseRequestData = z.infer<typeof purchaseRequestSchema>;
export type AvatarData = z.infer<typeof avatarDataSchema>;
export type RoomData = z.infer<typeof roomDataSchema>;

// New store types
export type Asset = typeof assets.$inferSelect;
export type CreateAsset = z.infer<typeof createAssetSchema>;
export type AssetStatus = z.infer<typeof assetStatusEnum>;
export type AssetType = z.infer<typeof assetTypeEnum>;

export type StoreItem = typeof storeItems.$inferSelect;
export type CreateStoreItem = z.infer<typeof createStoreItemSchema>;
export type UpdateStoreItem = z.infer<typeof updateStoreItemSchema>;
export type ItemType = z.infer<typeof itemTypeEnum>;
export type Rarity = z.infer<typeof rarityEnum>;

export type ItemAnimalPosition = typeof itemAnimalPositions.$inferSelect;
export type CreateItemPosition = z.infer<typeof createItemPositionSchema>;
export type UpdateItemPosition = z.infer<typeof updateItemPositionSchema>;
export type AnimalType = z.infer<typeof animalTypeEnum>;

// API Types
export type PrepareAssetUploadRequest = z.infer<typeof prepareAssetUploadSchema>;
export type PrepareAssetUploadResponse = {
  assetId: string;
  uploadUrl: string;
  uploadFields: Record<string, string>;
  expiresAt: string;
};

export type StoreItemWithAsset = StoreItem & {
  asset: Asset;
};
