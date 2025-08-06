import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, uuid, numeric, uniqueIndex, index, pgSchema } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Import existing schema elements
export * from './schema';

// ============================
// Garden System Tables
// ============================

// Garden plots - one per student
export const gardenPlots = pgTable('garden_plots', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().unique().references(() => students.id, { onDelete: 'cascade' }),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  plotPosition: integer('plot_position').notNull(),
  gardenTheme: varchar('garden_theme', { length: 50 }).default('meadow'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentIdIdx: index('idx_garden_plots_student_id').on(table.studentId),
    classIdIdx: index('idx_garden_plots_class_id').on(table.classId),
    uniqueClassPosition: uniqueIndex('unique_class_position').on(table.classId, table.plotPosition),
  };
});

// Planted crops with flexible (x,y) positioning
export const plantedCrops = pgTable('planted_crops', {
  id: uuid('id').primaryKey().defaultRandom(),
  plotId: uuid('plot_id').notNull().references(() => gardenPlots.id, { onDelete: 'cascade' }),
  seedType: varchar('seed_type', { length: 50 }).notNull(),
  plantedAt: timestamp('planted_at', { withTimezone: true }).defaultNow(),
  growthStage: integer('growth_stage').default(0).notNull(),
  lastWatered: timestamp('last_watered', { withTimezone: true }),
  waterBoostUntil: timestamp('water_boost_until', { withTimezone: true }),
  harvestReadyAt: timestamp('harvest_ready_at', { withTimezone: true }).notNull(),
  positionX: integer('position_x').notNull(),
  positionY: integer('position_y').notNull(),
  isHarvested: boolean('is_harvested').default(false),
  version: integer('version').default(1).notNull(), // For optimistic locking
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    plotIdIdx: index('idx_planted_crops_plot_id').on(table.plotId),
    harvestReadyIdx: index('idx_planted_crops_harvest_ready').on(table.harvestReadyAt).where(sql`is_harvested = false`),
    uniquePlotPosition: uniqueIndex('unique_plot_position').on(table.plotId, table.positionX, table.positionY),
  };
});

// Class-wide garden management
export const classGardens = pgTable('class_gardens', {
  classId: uuid('class_id').primaryKey().references(() => classes.id, { onDelete: 'cascade' }),
  gardenLevel: integer('garden_level').default(1).notNull(),
  totalHarvests: integer('total_harvests').default(0).notNull(),
  totalEarnings: integer('total_earnings').default(0).notNull(),
  infrastructureFund: integer('infrastructure_fund').default(0).notNull(),
  lastWateredAt: timestamp('last_watered_at', { withTimezone: true }),
  wateringLevel: integer('watering_level').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    lastWateredIdx: index('idx_class_gardens_last_watered').on(table.lastWateredAt),
  };
});

// Seed types catalog
export const seedTypes = pgTable('seed_types', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  baseGrowthHours: integer('base_growth_hours').notNull(),
  baseSellPrice: integer('base_sell_price').notNull(),
  purchasePrice: integer('purchase_price').notNull(),
  iconEmoji: varchar('icon_emoji', { length: 10 }),
  rarity: varchar('rarity', { length: 20 }).default('common'),
  available: boolean('available').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Garden decorations
export const gardenDecorations = pgTable('garden_decorations', {
  id: uuid('id').primaryKey().defaultRandom(),
  plotId: uuid('plot_id').notNull().references(() => gardenPlots.id, { onDelete: 'cascade' }),
  itemType: varchar('item_type', { length: 50 }).notNull(),
  storeItemId: uuid('store_item_id').references(() => storeItems.id, { onDelete: 'cascade' }),
  positionX: integer('position_x').notNull(),
  positionY: integer('position_y').notNull(),
  rotation: integer('rotation').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    uniqueDecorationPosition: uniqueIndex('unique_decoration_position').on(table.plotId, table.positionX, table.positionY),
  };
});

// Garden themes
export const gardenThemes = pgTable('garden_themes', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  backgroundColor: varchar('background_color', { length: 7 }).default('#8FBC8F'),
  groundTexture: varchar('ground_texture', { length: 50 }).default('grass'),
  isPremium: boolean('is_premium').default(false),
  unlockLevel: integer('unlock_level').default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Harvest logs
export const harvestLogs = pgTable('harvest_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  cropId: uuid('crop_id').notNull(),
  seedType: varchar('seed_type', { length: 50 }).notNull(),
  coinsEarned: integer('coins_earned').notNull(),
  growthTimeHours: integer('growth_time_hours').notNull(),
  wasBoosted: boolean('was_boosted').default(false),
  harvestedAt: timestamp('harvested_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    studentIdIdx: index('idx_harvest_logs_student_id').on(table.studentId),
    harvestedAtIdx: index('idx_harvest_logs_harvested_at').on(table.harvestedAt),
  };
});

// Feature flags
export const featureFlags = pgTable('feature_flags', {
  id: varchar('id', { length: 50 }).primaryKey(),
  isEnabled: boolean('is_enabled').default(false),
  rolloutPercentage: integer('rollout_percentage').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================
// Garden System Relations
// ============================

export const gardenPlotsRelations = relations(gardenPlots, ({ one, many }) => ({
  student: one(students, {
    fields: [gardenPlots.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [gardenPlots.classId],
    references: [classes.id],
  }),
  plantedCrops: many(plantedCrops),
  decorations: many(gardenDecorations),
}));

export const plantedCropsRelations = relations(plantedCrops, ({ one }) => ({
  plot: one(gardenPlots, {
    fields: [plantedCrops.plotId],
    references: [gardenPlots.id],
  }),
}));

export const classGardensRelations = relations(classGardens, ({ one }) => ({
  class: one(classes, {
    fields: [classGardens.classId],
    references: [classes.id],
  }),
}));

export const gardenDecorationsRelations = relations(gardenDecorations, ({ one }) => ({
  plot: one(gardenPlots, {
    fields: [gardenDecorations.plotId],
    references: [gardenPlots.id],
  }),
  storeItem: one(storeItems, {
    fields: [gardenDecorations.storeItemId],
    references: [storeItems.id],
  }),
}));

export const harvestLogsRelations = relations(harvestLogs, ({ one }) => ({
  student: one(students, {
    fields: [harvestLogs.studentId],
    references: [students.id],
  }),
}));

// ============================
// Type exports
// ============================

export type GardenPlot = typeof gardenPlots.$inferSelect;
export type NewGardenPlot = typeof gardenPlots.$inferInsert;
export type PlantedCrop = typeof plantedCrops.$inferSelect;
export type NewPlantedCrop = typeof plantedCrops.$inferInsert;
export type ClassGarden = typeof classGardens.$inferSelect;
export type NewClassGarden = typeof classGardens.$inferInsert;
export type SeedType = typeof seedTypes.$inferSelect;
export type NewSeedType = typeof seedTypes.$inferInsert;
export type GardenDecoration = typeof gardenDecorations.$inferSelect;
export type NewGardenDecoration = typeof gardenDecorations.$inferInsert;
export type GardenTheme = typeof gardenThemes.$inferSelect;
export type NewGardenTheme = typeof gardenThemes.$inferInsert;
export type HarvestLog = typeof harvestLogs.$inferSelect;
export type NewHarvestLog = typeof harvestLogs.$inferInsert;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;

// Import base schema (need to fix circular dependency)
import { students, classes, storeItems } from './schema';