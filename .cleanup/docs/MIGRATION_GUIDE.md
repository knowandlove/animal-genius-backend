# 🚀 Database Migration Guide

**Last Updated:** June 25, 2025

## Current State

✅ **UUID Migration Complete**
- All tables use UUID primary keys
- All foreign keys properly typed as UUID
- No orphaned records
- All indexes in place (except one to be added)

## Immediate Action Required

### 1. Generate Fresh Migration

Run this to ensure all indexes are properly created:

```bash
npm run db:generate
```

Then review and apply the generated migration via Supabase dashboard.

### 2. Archive Cleanup Complete

Old migration files have been moved to `/migrations/archive/`. The migrations directory now contains only:
- `0000_conscious_albert_cleary.sql` - Initial Drizzle migration
- `0001_add_missing_processed_by_index.sql` - Missing index to be added
- `meta/` - Drizzle metadata
- `archive/` - Old migration files (for reference only)

## Future Migration Process

### ✅ DO: Use Drizzle Kit

1. Make schema changes in `/server/db/schema.ts`
2. Generate migration:
   ```bash
   npm run db:generate
   ```
3. Review generated SQL in `/migrations/`
4. Apply via Supabase dashboard

### ❌ DON'T: Manual Migrations

- No more manual SQL files
- No more run-any-migration.ts
- No more conflicting versions
- No more TRUNCATE commands

## Schema Management

### Source of Truth
- **Development**: `/shared/schema.ts` (Drizzle schema definition)
- **Production**: Supabase dashboard shows actual state
- **Never use**: archived SQL files in `/migrations/archive/`

### Backup Strategy
1. Before major changes: Export schema from Supabase
2. Keep backups in `/migrations/archive/backups/`
3. Document changes in this guide

## UUID Validation

All routes now have UUID validation available:

```typescript
// Single UUID parameter
app.get('/api/classes/:id', validateUUID('id'), handler);

// Multiple UUID parameters
app.put('/api/classes/:classId/students/:studentId', 
  validateUUIDs('classId', 'studentId'), 
  handler
);

// Body UUID validation
app.post('/api/purchase', validateBodyUUID('studentId'), handler);
```

## Performance Optimizations Needed

### RLS Policy Updates
The Supabase advisor identified that RLS policies need optimization. Update all policies to use:

```sql
-- Instead of: auth.uid()
-- Use: (SELECT auth.uid())
```

This prevents re-evaluation for each row.

### Unused Indexes
Several indexes show as unused but keep them for now - the system has no traffic yet.

## Monitoring

### Health Checks
1. No orphaned records: ✅
2. All UUIDs valid: ✅
3. Indexes present: ✅ (after adding the missing one)
4. RLS enabled: ✅

### Regular Audits
Run monthly:
```sql
-- Check for orphaned records
SELECT COUNT(*) FROM students WHERE class_id NOT IN (SELECT id FROM classes);
SELECT COUNT(*) FROM quiz_submissions WHERE student_id NOT IN (SELECT id FROM students);
-- etc.
```

## Emergency Procedures

### Rollback Plan
1. Backups in `/migrations/archive/backups/`
2. Can restore from Supabase dashboard
3. Keep production backup before each deployment

### Common Issues
- **UUID validation errors**: Check middleware is applied
- **Performance issues**: Check indexes and RLS policies
- **Migration conflicts**: Use only Drizzle Kit going forward

## Development Workflow

1. **Local Development**: Uses Drizzle schema
2. **Generate Migration**: `npm run db:generate`
3. **Test Locally**: Apply to local Supabase
4. **Deploy**: Apply via production Supabase dashboard
5. **Verify**: Run health checks

## Contact

For database emergencies:
1. Check Supabase dashboard logs
2. Review this guide
3. Check `/migrations/archive/` for historical context
