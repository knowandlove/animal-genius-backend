# Schema.ts Type Safety Enhancement

**Last Updated:** July 29, 2025

After running the migration, you might want to add better TypeScript type safety to your schema.ts file. This is **optional** but recommended for better developer experience.

## What This Does

Adds TypeScript types that match your database CHECK constraints, so you get:
- Auto-completion when coding
- Type errors if you use invalid values
- Better documentation in your code

## The Enhancement

In your `/animal-genius-backend/shared/schema.ts` file, add these type definitions near the top (after the imports):

```typescript
// Type definitions for Values Constellation enum fields
export type CurrentPhase = 'waiting' | 'seeding' | 'connecting' | 'energizing' | 'completed';
export type StoryTemplate = 'when_helps' | 'restore_by' | 'work_together' | 'prevents_by' | 'leads_to';
export type HiddenReason = 'inappropriate' | 'duplicate' | 'off-topic' | 'other';
```

Then update these specific fields in the table definitions:

### 1. In `classValuesSessions` table (around line 363):
```typescript
// Change from:
currentPhase: varchar('current_phase', { length: 20 }).default('waiting'),

// To:
currentPhase: varchar('current_phase', { length: 20 })
  .$type<CurrentPhase>()
  .default('waiting'),
```

### 2. In `classValues` table (around line 425):
```typescript
// Change from:
hiddenReason: text('hidden_reason'),

// To:
hiddenReason: text('hidden_reason')
  .$type<HiddenReason>(),
```

### 3. In `valueConnections` table (around line 439):
```typescript
// Change from:
storyTemplate: varchar('story_template', { length: 100 }).notNull(),

// To:
storyTemplate: varchar('story_template', { length: 100 })
  .$type<StoryTemplate>()
  .notNull(),
```

## Full Updated Sections

Here are the complete updated table definitions with the type safety added:

### classValuesSessions update:
```typescript
export const classValuesSessions = pgTable('class_values_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  startedBy: uuid('started_by').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  currentPhase: varchar('current_phase', { length: 20 })
    .$type<CurrentPhase>()
    .default('waiting'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    classIdIdx: index('idx_class_values_sessions_class_id').on(table.classId),
    statusIdx: index('idx_class_values_sessions_status').on(table.status),
    activeIdx: index('idx_class_values_sessions_active').on(table.classId, table.status).where(sql`status = 'active'`),
  };
});
```

### classValues update:
```typescript
export const classValues = pgTable('class_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => classValuesSessions.id, { onDelete: 'cascade' }),
  valueText: text('value_text').notNull(),
  authorPassportCode: varchar('author_passport_code', { length: 20 }),
  isHidden: boolean('is_hidden').notNull().default(false),
  hiddenReason: text('hidden_reason')
    .$type<HiddenReason>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    sessionVisibleIdx: index('idx_class_values_session_visible').on(table.sessionId).where(sql`is_hidden = false`),
    createdAtIdx: index('idx_class_values_created_at').on(table.createdAt),
  };
});
```

### valueConnections update:
```typescript
export const valueConnections = pgTable('value_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => classValuesSessions.id, { onDelete: 'cascade' }),
  fromValueId: uuid('from_value_id').notNull().references(() => classValues.id, { onDelete: 'cascade' }),
  toValueId: uuid('to_value_id').notNull().references(() => classValues.id, { onDelete: 'cascade' }),
  storyTemplate: varchar('story_template', { length: 100 })
    .$type<StoryTemplate>()
    .notNull(),
  storyText: text('story_text').notNull(),
  authorPassportCode: varchar('author_passport_code', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => {
  return {
    sessionIdx: index('idx_value_connections_session').on(table.sessionId),
    valuesIdx: index('idx_value_connections_values').on(table.fromValueId, table.toValueId),
  };
});
```

## Benefits

With these changes:
- TypeScript will catch typos like `currentPhase: 'wating'` (missing 'i')
- Your IDE will suggest valid values when you type
- Other developers will immediately see what values are allowed
- The database still enforces the constraints (belt and suspenders!)

## Note

This is purely a TypeScript/development enhancement. It doesn't change your database at all - the CHECK constraints in PostgreSQL still do the actual enforcement. This just makes your development experience better!
