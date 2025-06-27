# 📁 Migrations Directory

## ⚠️ IMPORTANT: Read Before Making Database Changes!

This directory contains database migrations for Animal Genius Quiz PRO.

## 🔴 CRITICAL: Source of Truth

**The ONLY source of truth for the database schema is `/shared/schema.ts`**

Do NOT use any SQL files from the archive directory to understand the current schema - they are outdated and kept only for historical reference.

## Current Structure

```
migrations/
├── 0000_conscious_albert_cleary.sql    # Initial Drizzle migration (DO NOT MODIFY)
├── 0001_add_missing_processed_by_index.sql # Missing index to be added
├── meta/                               # Drizzle metadata (DO NOT MODIFY)
│   └── _journal.json
└── archive/                            # Old manual migrations (REFERENCE ONLY - OUTDATED!)
```

## ✅ How to Make Database Changes

1. **Edit the schema file**: `/shared/schema.ts`
2. **Generate migration**: `npm run db:generate`
3. **Review the generated SQL**: Check the new file in this directory
4. **Apply to production**: Use Supabase dashboard SQL editor

## ❌ What NOT to Do

- **DO NOT** create manual SQL files
- **DO NOT** use `run-any-migration.ts` (archived)
- **DO NOT** modify existing migration files
- **DO NOT** use TRUNCATE or DELETE CASCADE in migrations
- **DO NOT** run migrations directly - use Supabase dashboard
- **DO NOT** trust the archived SQL files - they are OUTDATED

## 🗄️ Archive Directory

The `archive/` directory contains old manual migrations from before we standardized on Drizzle Kit. These files are OUTDATED and potentially DANGEROUS:
- Many use SERIAL (integer) IDs instead of UUIDs
- They may have incorrect foreign key relationships
- They are kept for historical reference only
- NEVER run these files again

## 🔍 Current Schema Status

- **All tables use UUID primary keys** ✅
- **All foreign keys are properly indexed** ✅
- **Row Level Security is enabled** ✅
- **No orphaned records exist** ✅

## 📝 Schema Documentation

See `/DATABASE_SCHEMA.md` for complete documentation of all tables, columns, and relationships.

## 🚨 Emergency Contacts

If you need to make database changes:
1. Check `/MIGRATION_GUIDE.md` first
2. Use Drizzle Kit commands only
3. Test on a development branch first

Remember: The database is the heart of the application. Handle with care! 💙
