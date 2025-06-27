#!/bin/bash

# Archive old migration files
# Keep only: 
# - 0000_conscious_albert_cleary.sql (initial Drizzle migration)
# - meta/ directory (Drizzle metadata)
# - clean-schema-with-rls.sql (our source of truth)

files_to_archive=(
    "add_auto_approval_threshold.sql"
    "add_critical_performance_indexes.sql"
    "add_missing_profile_fields.sql"
    "add_passport_code_to_students.sql"
    "add_updated_at_to_profiles.sql"
    "check-classes-table.sql"
    "check-profiles-policies.sql"
    "convert-to-uuid-auth-fixed.sql"
    "convert-to-uuid-auth-v2.sql"
    "convert-to-uuid-auth.sql"
    "create-database-functions.sql"
    "create_lesson_progress_table.sql"
    "create_store_items_table.sql"
    "fix-database-functions.sql"
    "fix-get-student-balance-ambiguity.sql"
    "fix-profiles-rls-recursion.sql"
    "fix_database_alignment.sql"
    "fix_student_architecture.sql"
    "fix_student_architecture_safe.sql"
    "fix_student_architecture_v2.sql"
    "fix_student_architecture_v3.sql"
    "migrate-users-to-supabase.ts"
    "migrate_to_uuid_keys.sql"
    "run-any-migration.ts"
    "run-migration.ts"
    "sync_profile_metadata.sql"
    "update-passport-code-format.sql"
)

for file in "${files_to_archive[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" archive/
        echo "Archived: $file"
    fi
done

# Move the fixes directory too
if [ -d "fixes" ]; then
    mv fixes archive/
    echo "Archived: fixes directory"
fi

echo "Migration cleanup complete!"