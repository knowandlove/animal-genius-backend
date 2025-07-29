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
  phoneNumber: varchar('phone_number', { length: 50 }),
  personalityAnimal: varchar('personality_animal', { length: 50 }),
  avatarUrl: text('avatar_url'),
  isAdmin: boolean('is_admin').default(false),
  isAnonymous: boolean('is_anonymous').default(false).notNull(),
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
  hasValuesSet: boolean('has_values_set').default(false),
  valuesSetAt: timestamp('values_set_at', { withTimezone: true }),
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
  currencyBalance: integer('currency_balance').default(0).notNull(),
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

// Patterns table for drawing patterns/templates
export const patterns = pgTable('patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  surfaceType: varchar('surface_type', { length: 50 }).notNull(),
  patternType: varchar('pattern_type', { length: 20 }).notNull().default('css'), // 'css' or 'image'
  patternValue: text('pattern_value').notNull(), // CSS string or image URL
  theme: varchar('theme', { length: 100 }),
  thumbnailUrl: text('thumbnail_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    codeIdx: index('idx_patterns_code').on(table.code),
    surfaceTypeIdx: index('idx_patterns_surface_type').on(table.surfaceType),
    themeIdx: index('idx_patterns_theme').on(table.theme),
    isActiveIdx: index('idx_patterns_is_active').on(table.isActive),
    createdAtIdx: index('idx_patterns_created_at').on(table.createdAt),
    typeActiveIdx: index('idx_patterns_type_active').on(table.surfaceType, table.isActive).where(sql`is_active = true`),
  };
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
  assetType: varchar('asset_type', { length: 50 }).default('image').notNull(), // NEW: Support for Rive animations
  thumbnailUrl: text('thumbnail_url'), // NEW: URL for 128x128 thumbnail image
  patternId: uuid('pattern_id').references(() => patterns.id, { onDelete: 'set null' }), // Link to pattern if this is a pattern item
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    assetIdIdx: index('idx_store_items_asset_id').on(table.assetId),
    activeIdx: index('idx_store_items_active').on(table.isActive).where(sql`is_active = true`),
    patternIdIdx: index('idx_store_items_pattern_id').on(table.patternId),
  };
});

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

// Class collaborators (co-teachers)
export const classCollaborators = pgTable('class_collaborators', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  teacherId: uuid('teacher_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull().default('viewer'),
  permissions: jsonb('permissions').default({}),
  
  // Invitation tracking
  invitedBy: uuid('invited_by').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  invitationStatus: varchar('invitation_status', { length: 20 }).notNull().default('pending'),
  invitationToken: uuid('invitation_token').unique(),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  
  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueClassTeacher: uniqueIndex('unique_class_teacher').on(table.classId, table.teacherId),
    classIdIdx: index('idx_class_collaborators_class_id').on(table.classId),
    teacherIdIdx: index('idx_class_collaborators_teacher_id').on(table.teacherId),
    invitationTokenIdx: index('idx_class_collaborators_invitation_token').on(table.invitationToken),
    statusIdx: index('idx_class_collaborators_status').on(table.invitationStatus),
    activeIdx: index('idx_class_collaborators_active').on(table.classId, table.teacherId)
      .where(sql`invitation_status = 'accepted' AND revoked_at IS NULL`),
  };
});

// Pet catalog table
export const pets = pgTable('pets', {
  id: uuid('id').primaryKey().defaultRandom(),
  species: varchar('species', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  assetUrl: text('asset_url').notNull(),
  cost: integer('cost').notNull().default(100),
  rarity: varchar('rarity', { length: 20 }).default('common'),
  baseStats: jsonb('base_stats').$type<{
    hungerDecayRate: number; // points per hour
    happinessDecayRate: number; // points per hour
  }>().notNull().default({ hungerDecayRate: 0.42, happinessDecayRate: 0.625 }),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    activeIdx: index('idx_pets_active').on(table.isActive).where(sql`is_active = true`),
  };
});

// Student pets table (instances of pets owned by students)
export const studentPets = pgTable('student_pets', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  petId: uuid('pet_id').notNull().references(() => pets.id, { onDelete: 'restrict' }),
  customName: varchar('custom_name', { length: 50 }).notNull(),
  // Current stats
  hunger: integer('hunger').notNull().default(80), // 0-100
  happiness: integer('happiness').notNull().default(80), // 0-100
  // Time tracking for passive state calculation
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).defaultNow().notNull(),
  // Room position
  position: jsonb('position').$type<{ x: number; y: number }>().notNull().default({ x: 200, y: 200 }),
  // Variant data for customization (fish colors, etc)
  variantData: jsonb('variant_data').$type<{ 
    color?: string; 
    primaryColor?: string; 
    riveArtboard?: string;
    [key: string]: any;
  }>().default({}),
  // Timestamps
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentIdIdx: index('idx_student_pets_student_id').on(table.studentId),
    // Ensure one pet per student for MVP
    uniqueStudentPet: uniqueIndex('unique_student_pet').on(table.studentId),
  };
});

// Lesson progress table
export const lessonProgress = pgTable('lesson_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  lessonId: integer('lesson_id').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('not_started'), // 'not_started', 'in_progress', 'completed'
  currentActivity: integer('current_activity').default(1), // 1-4
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  coinsAwardedAt: timestamp('coins_awarded_at', { withTimezone: true }), // Track when coins were awarded to prevent double rewards
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueClassLesson: uniqueIndex('unique_class_lesson').on(table.classId, table.lessonId),
    classIdIdx: index('idx_lesson_progress_class_id').on(table.classId),
    statusIdx: index('idx_lesson_progress_status').on(table.status),
  };
});

// Lesson activity progress table
export const lessonActivityProgress = pgTable('lesson_activity_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonProgressId: uuid('lesson_progress_id').notNull().references(() => lessonProgress.id, { onDelete: 'cascade' }),
  activityNumber: integer('activity_number').notNull(), // 1-4
  completed: boolean('completed').default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueLessonActivity: uniqueIndex('unique_lesson_activity').on(table.lessonProgressId, table.activityNumber),
    lessonProgressIdIdx: index('idx_lesson_activity_progress_lesson_id').on(table.lessonProgressId),
  };
});

// Pet interactions log
export const petInteractions = pgTable('pet_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentPetId: uuid('student_pet_id').notNull().references(() => studentPets.id, { onDelete: 'cascade' }),
  interactionType: varchar('interaction_type', { length: 50 }).notNull(), // 'feed', 'play', 'pet'
  // Stats before interaction (for analytics)
  hungerBefore: integer('hunger_before').notNull(),
  happinessBefore: integer('happiness_before').notNull(),
  // Stats after interaction
  hungerAfter: integer('hunger_after').notNull(),
  happinessAfter: integer('happiness_after').notNull(),
  // Cost (if any)
  coinsCost: integer('coins_cost').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentPetIdIdx: index('idx_pet_interactions_student_pet_id').on(table.studentPetId),
    createdAtIdx: index('idx_pet_interactions_created_at').on(table.createdAt),
  };
});

// ============================
// Community Hub Tables
// ============================

// Discussions table
export const discussions = pgTable('discussions', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  body: text('body').notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'lessons', 'animals', 'challenges', 'success_stories', 'ask_teachers', 'feedback'
  viewCount: integer('view_count').default(0).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(), // 'active', 'resolved', 'archived'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    teacherIdIdx: index('idx_discussions_teacher_id').on(table.teacherId),
    categoryIdx: index('idx_discussions_category').on(table.category),
    createdAtIdx: index('idx_discussions_created_at').on(table.createdAt),
    statusIdx: index('idx_discussions_status').on(table.status),
  };
});

// Tags table
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'grade', 'animal_mix', 'challenge_type', 'class_dynamic', 'time_of_year'
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    slugIdx: uniqueIndex('idx_tags_slug').on(table.slug),
    categoryIdx: index('idx_tags_category').on(table.category),
  };
});

// Discussion Tags junction table
export const discussionTags = pgTable('discussion_tags', {
  discussionId: uuid('discussion_id').notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    primaryKey: { columns: [table.discussionId, table.tagId] },
    discussionIdx: index('idx_discussion_tags_discussion').on(table.discussionId),
    tagIdx: index('idx_discussion_tags_tag').on(table.tagId),
  };
});

// Replies table
export const replies = pgTable('replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  discussionId: uuid('discussion_id').notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  parentReplyId: uuid('parent_reply_id'),
  teacherId: uuid('teacher_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  helpfulCount: integer('helpful_count').default(0).notNull(),
  isAcceptedAnswer: boolean('is_accepted_answer').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    discussionIdx: index('idx_replies_discussion').on(table.discussionId),
    parentIdx: index('idx_replies_parent').on(table.parentReplyId),
    teacherIdx: index('idx_replies_teacher').on(table.teacherId),
  };
});

// Interactions table
export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  discussionId: uuid('discussion_id').references(() => discussions.id, { onDelete: 'cascade' }),
  replyId: uuid('reply_id').references(() => replies.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // 'viewed', 'helpful', 'saved', 'tried_it', 'shared'
  metadata: jsonb('metadata').default({}), // { workedForMe?: boolean, modifications?: string }
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    teacherDiscussionIdx: index('idx_interactions_teacher_discussion').on(table.teacherId, table.discussionId),
    teacherReplyIdx: index('idx_interactions_teacher_reply').on(table.teacherId, table.replyId),
    typeIdx: index('idx_interactions_type').on(table.type),
    // Ensure unique interactions per user per item
    uniqueInteraction: uniqueIndex('idx_unique_interaction').on(
      table.teacherId,
      table.discussionId,
      table.replyId,
      table.type
    ),
  };
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  classes: many(classes),
  adminLogs: many(adminLogs),
  currencyTransactions: many(currencyTransactions),
  storeSettings: many(storeSettings),
  classCollaborations: many(classCollaborators),
  invitedCollaborators: many(classCollaborators),
  discussions: many(discussions),
  replies: many(replies),
  interactions: many(interactions),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  teacher: one(profiles, {
    fields: [classes.teacherId],
    references: [profiles.id],
  }),
  students: many(students),
  collaborators: many(classCollaborators),
  lessonProgress: many(lessonProgress),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  quizSubmissions: many(quizSubmissions),
  inventory: many(studentInventory),
  currencyTransactions: many(currencyTransactions),
  pets: many(studentPets),
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

export const patternsRelations = relations(patterns, ({ many }) => ({
  storeItems: many(storeItems),
}));

export const storeItemsRelations = relations(storeItems, ({ one, many }) => ({
  asset: one(assets, {
    fields: [storeItems.assetId],
    references: [assets.id],
  }),
  pattern: one(patterns, {
    fields: [storeItems.patternId],
    references: [patterns.id],
  }),
  studentInventory: many(studentInventory),
}));


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

export const classCollaboratorsRelations = relations(classCollaborators, ({ one }) => ({
  class: one(classes, {
    fields: [classCollaborators.classId],
    references: [classes.id],
  }),
  teacher: one(profiles, {
    fields: [classCollaborators.teacherId],
    references: [profiles.id],
  }),
  invitedBy: one(profiles, {
    fields: [classCollaborators.invitedBy],
    references: [profiles.id],
  }),
}));

export const petsRelations = relations(pets, ({ many }) => ({
  studentPets: many(studentPets),
}));

export const studentPetsRelations = relations(studentPets, ({ one, many }) => ({
  student: one(students, {
    fields: [studentPets.studentId],
    references: [students.id],
  }),
  pet: one(pets, {
    fields: [studentPets.petId],
    references: [pets.id],
  }),
  interactions: many(petInteractions),
}));

export const petInteractionsRelations = relations(petInteractions, ({ one }) => ({
  studentPet: one(studentPets, {
    fields: [petInteractions.studentPetId],
    references: [studentPets.id],
  }),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one, many }) => ({
  class: one(classes, {
    fields: [lessonProgress.classId],
    references: [classes.id],
  }),
  activities: many(lessonActivityProgress),
}));

export const lessonActivityProgressRelations = relations(lessonActivityProgress, ({ one }) => ({
  lessonProgress: one(lessonProgress, {
    fields: [lessonActivityProgress.lessonProgressId],
    references: [lessonProgress.id],
  }),
}));

// Community Hub Relations
export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  teacher: one(profiles, {
    fields: [discussions.teacherId],
    references: [profiles.id],
  }),
  tags: many(discussionTags),
  replies: many(replies),
  interactions: many(interactions),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  discussions: many(discussionTags),
}));

export const discussionTagsRelations = relations(discussionTags, ({ one }) => ({
  discussion: one(discussions, {
    fields: [discussionTags.discussionId],
    references: [discussions.id],
  }),
  tag: one(tags, {
    fields: [discussionTags.tagId],
    references: [tags.id],
  }),
}));

export const repliesRelations = relations(replies, ({ one, many }) => ({
  discussion: one(discussions, {
    fields: [replies.discussionId],
    references: [discussions.id],
  }),
  teacher: one(profiles, {
    fields: [replies.teacherId],
    references: [profiles.id],
  }),
  parentReply: one(replies, {
    fields: [replies.parentReplyId],
    references: [replies.id],
  }),
  childReplies: many(replies),
  interactions: many(interactions),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  teacher: one(profiles, {
    fields: [interactions.teacherId],
    references: [profiles.id],
  }),
  discussion: one(discussions, {
    fields: [interactions.discussionId],
    references: [discussions.id],
  }),
  reply: one(replies, {
    fields: [interactions.replyId],
    references: [replies.id],
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
export type ClassCollaborator = typeof classCollaborators.$inferSelect;
export type NewClassCollaborator = typeof classCollaborators.$inferInsert;
export type Pattern = typeof patterns.$inferSelect;
export type NewPattern = typeof patterns.$inferInsert;
export type Pet = typeof pets.$inferSelect;
export type NewPet = typeof pets.$inferInsert;
export type StudentPet = typeof studentPets.$inferSelect;
export type NewStudentPet = typeof studentPets.$inferInsert;
export type PetInteraction = typeof petInteractions.$inferSelect;
export type NewPetInteraction = typeof petInteractions.$inferInsert;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;
export type LessonActivityProgress = typeof lessonActivityProgress.$inferSelect;
export type NewLessonActivityProgress = typeof lessonActivityProgress.$inferInsert;

// Room visits table (for achievement tracking)
export const roomVisits = pgTable('room_visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitorStudentId: uuid('visitor_student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  visitedStudentId: uuid('visited_student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  firstVisitAt: timestamp('first_visit_at', { withTimezone: true }).defaultNow(),
  lastVisitAt: timestamp('last_visit_at', { withTimezone: true }).defaultNow(),
  visitCount: integer('visit_count').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    visitorIdx: index('idx_room_visits_visitor').on(table.visitorStudentId),
    visitedIdx: index('idx_room_visits_visited').on(table.visitedStudentId),
    lastVisitIdx: index('idx_room_visits_last_visit').on(table.lastVisitAt),
    uniqueVisitorVisited: uniqueIndex('uq_visitor_visited').on(table.visitorStudentId, table.visitedStudentId),
  };
});

// Room guestbook table
export const roomGuestbook = pgTable('room_guestbook', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomOwnerStudentId: uuid('room_owner_student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  visitorStudentId: uuid('visitor_student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).default('visible').notNull(), // 'visible', 'hidden_by_user', 'flagged_for_review', 'hidden_by_admin'
  visitorName: varchar('visitor_name', { length: 255 }).notNull(),
  visitorAnimalType: varchar('visitor_animal_type', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    roomOwnerIdx: index('idx_guestbook_room_owner').on(table.roomOwnerStudentId, table.createdAt),
    visitorIdx: index('idx_guestbook_visitor').on(table.visitorStudentId),
    statusIdx: index('idx_guestbook_status').on(table.status),
  };
});

// Student achievements table
export const studentAchievements = pgTable('student_achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  achievementCode: varchar('achievement_code', { length: 50 }).notNull(),
  achievementName: varchar('achievement_name', { length: 255 }).notNull(),
  earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow(),
  progressData: jsonb('progress_data').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentIdx: index('idx_achievements_student').on(table.studentId),
    codeIdx: index('idx_achievements_code').on(table.achievementCode),
    earnedIdx: index('idx_achievements_earned').on(table.earnedAt),
    uniqueStudentAchievement: uniqueIndex('uq_student_achievement').on(table.studentId, table.achievementCode),
  };
});

// Relations for new tables
export const roomVisitsRelations = relations(roomVisits, ({ one }) => ({
  visitor: one(students, {
    fields: [roomVisits.visitorStudentId],
    references: [students.id],
  }),
  visited: one(students, {
    fields: [roomVisits.visitedStudentId],
    references: [students.id],
  }),
}));

export const roomGuestbookRelations = relations(roomGuestbook, ({ one }) => ({
  roomOwner: one(students, {
    fields: [roomGuestbook.roomOwnerStudentId],
    references: [students.id],
  }),
  visitor: one(students, {
    fields: [roomGuestbook.visitorStudentId],
    references: [students.id],
  }),
}));

export const studentAchievementsRelations = relations(studentAchievements, ({ one }) => ({
  student: one(students, {
    fields: [studentAchievements.studentId],
    references: [students.id],
  }),
}));

// Update students relations to include new relationships
export const studentsRelationsUpdated = relations(students, ({ one, many }) => ({
  class: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  quizSubmissions: many(quizSubmissions),
  inventory: many(studentInventory),
  currencyTransactions: many(currencyTransactions),
  pets: many(studentPets),
  roomVisitsAsVisitor: many(roomVisits),
  roomVisitsAsVisited: many(roomVisits),
  guestbookMessagesAsOwner: many(roomGuestbook),
  guestbookMessagesAsVisitor: many(roomGuestbook),
  achievements: many(studentAchievements),
}));

// Type exports for new tables
export type RoomVisit = typeof roomVisits.$inferSelect;
export type NewRoomVisit = typeof roomVisits.$inferInsert;
export type RoomGuestbookMessage = typeof roomGuestbook.$inferSelect;
export type NewRoomGuestbookMessage = typeof roomGuestbook.$inferInsert;
export type StudentAchievement = typeof studentAchievements.$inferSelect;
export type NewStudentAchievement = typeof studentAchievements.$inferInsert;

// Community Hub type exports
export type Discussion = typeof discussions.$inferSelect;
export type NewDiscussion = typeof discussions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type DiscussionTag = typeof discussionTags.$inferSelect;
export type NewDiscussionTag = typeof discussionTags.$inferInsert;
export type Reply = typeof replies.$inferSelect;
export type NewReply = typeof replies.$inferInsert;
export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;

// Re-export class values voting tables
export { 
  classValuesSessions, 
  classValuesVotes, 
  classValuesResults,
  classValuesSessionsRelations,
  classValuesVotesRelations,
  classValuesResultsRelations
} from './schema-class-values';
export type { 
  ClassValuesSession, 
  NewClassValuesSession, 
  ClassValuesVote, 
  NewClassValuesVote, 
  ClassValuesResult, 
  NewClassValuesResult 
} from './schema-class-values';