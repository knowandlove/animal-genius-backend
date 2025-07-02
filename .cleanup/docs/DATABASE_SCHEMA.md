# 📊 Database Schema Documentation

**Last Updated:** June 25, 2025  
**Database:** PostgreSQL (Supabase)  
**Status:** Production Ready

> ⚠️ **IMPORTANT**: This documentation is manually maintained and may be out of sync.  
> **The source of truth is `/shared/schema.ts`**  
> TODO: Generate this documentation automatically from the Drizzle schema

## Overview

Animal Genius Quiz PRO uses a PostgreSQL database hosted on Supabase. All tables use UUID primary keys for compatibility with Supabase Auth and better scalability.

## Schema Design Principles

1. **UUID Keys**: All primary keys use UUID v4 for global uniqueness
2. **Soft Deletes**: Classes use soft delete pattern (deleted_at column)
3. **Audit Fields**: All tables include created_at/updated_at timestamps
4. **Foreign Key Integrity**: All relationships enforced with foreign key constraints
5. **Performance Indexes**: All foreign keys are indexed for query performance
6. **Row Level Security**: All tables have RLS policies for data isolation

## ⚠️ KNOWN ISSUES TO FIX

### 1. Data Integrity Gaps
- `item_animal_positions` table uses varchar fields for `item_type` and `animal_type` instead of proper foreign keys
- `lesson_progress` table uses varchar for `lesson_id` instead of a foreign key
- These should reference proper lookup tables for data integrity

### 2. Missing Updated_At Trigger
- The `updated_at` columns use `.defaultNow()` which only sets on creation
- Need to add a trigger to update these on every modification

### 3. Store Settings Ambiguity
- `store_settings` has both `teacher_id` and `class_id` without ensuring they match
- Need to add a constraint to ensure class belongs to teacher

## Core Tables

### 🔐 profiles
Extends Supabase auth.users table with additional user information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, FK → auth.users(id) ON DELETE CASCADE | References auth.users.id |
| email | text | NOT NULL, UNIQUE | User email address |
| full_name | text | | Full display name |
| first_name | varchar(255) | | User's first name |
| last_name | varchar(255) | | User's last name |
| school_organization | varchar(255) | | School/organization name |
| role_title | varchar(255) | | Job title (Teacher, Counselor, etc) |
| how_heard_about | varchar(255) | | Marketing source tracking |
| personality_animal | varchar(50) | | User's own animal type |
| is_admin | boolean | DEFAULT false | Admin access flag |
| last_login_at | timestamptz | | Last login timestamp |
| created_at | timestamptz | DEFAULT NOW() | Registration date |
| updated_at | timestamptz | DEFAULT NOW() | Last profile update |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (email)

**Foreign Key Policies:**
- CASCADE delete from auth.users

### 📚 classes
Teacher's classes containing students.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Class identifier |
| teacher_id | uuid | NOT NULL, FK → profiles.id ON DELETE RESTRICT | Class owner |
| name | varchar(255) | NOT NULL | Class name |
| subject | varchar(100) | | Subject taught |
| grade_level | varchar(50) | | Grade level |
| passport_code | varchar(20) | NOT NULL, UNIQUE | 6-character access code |
| school_name | varchar(255) | | School name |
| is_archived | boolean | DEFAULT false | Archive flag |
| created_at | timestamptz | DEFAULT NOW() | Creation date |
| updated_at | timestamptz | DEFAULT NOW() | Last update |
| deleted_at | timestamptz | | Soft delete timestamp |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (passport_code)
- INDEX idx_classes_teacher_id (teacher_id)
- INDEX idx_classes_active (teacher_id) WHERE deleted_at IS NULL

**Foreign Key Policies:**
- RESTRICT delete if teacher has classes

### 👥 students
Student profiles within classes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Student identifier |
| class_id | uuid | NOT NULL, FK → classes.id ON DELETE RESTRICT | Parent class |
| passport_code | varchar(20) | NOT NULL, UNIQUE | Individual access code |
| student_name | varchar(255) | | Student's name |
| grade_level | varchar(50) | | Grade level |
| personality_type | varchar(20) | | MBTI type (if known) |
| animal_type | varchar(50) | | Assigned animal |
| animal_genius | varchar(50) | | Genius type |
| learning_style | varchar(50) | | Learning preference |
| currency_balance | integer | DEFAULT 0 | Coin balance |
| avatar_data | jsonb | DEFAULT {} | Avatar customization |
| room_data | jsonb | DEFAULT {furniture: []} | Room decoration |
| created_at | timestamptz | DEFAULT NOW() | Join date |
| updated_at | timestamptz | DEFAULT NOW() | Last update |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (passport_code)
- INDEX idx_students_class_id (class_id)
- INDEX idx_students_passport_code (passport_code)

**Foreign Key Policies:**
- RESTRICT delete if class has students

### 📝 quiz_submissions
Records of completed personality quizzes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Submission ID |
| student_id | uuid | NOT NULL, FK → students.id ON DELETE CASCADE | Test taker |
| animal_type | varchar(50) | NOT NULL | Result: animal |
| genius_type | varchar(50) | NOT NULL | Result: genius |
| answers | jsonb | NOT NULL | Question responses |
| coins_earned | integer | DEFAULT 0 | Reward amount |
| completed_at | timestamptz | DEFAULT NOW() | Completion time |
| created_at | timestamptz | DEFAULT NOW() | Start time |

**Indexes:**
- PRIMARY KEY (id)
- INDEX idx_quiz_submissions_student_id (student_id)

**Foreign Key Policies:**
- CASCADE delete with student

### 🛍️ store_items
Virtual goods catalog.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Item ID |
| name | varchar(255) | NOT NULL | Display name |
| description | text | | Item description |
| item_type | varchar(50) | NOT NULL | Category (avatar_hat, etc) |
| cost | integer | NOT NULL | Price in coins |
| rarity | varchar(20) | DEFAULT 'common' | Rarity tier |
| is_active | boolean | DEFAULT true | Available for purchase |
| sort_order | integer | DEFAULT 0 | Display order |
| asset_id | uuid | FK → assets.id ON DELETE SET NULL | Image reference |
| created_at | timestamptz | DEFAULT NOW() | Added date |
| updated_at | timestamptz | DEFAULT NOW() | Last update |

**Indexes:**
- PRIMARY KEY (id)
- INDEX idx_store_items_asset_id (asset_id)
- INDEX idx_store_items_active (is_active) WHERE is_active = true

**Foreign Key Policies:**
- SET NULL if asset deleted

### 🖼️ assets
Cloud storage references for images.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Asset ID |
| file_name | varchar(255) | NOT NULL | Original filename |
| file_type | varchar(50) | NOT NULL | MIME type |
| file_size | integer | NOT NULL | Size in bytes |
| storage_path | text | NOT NULL | Supabase storage path |
| public_url | text | NOT NULL | CDN URL |
| category | varchar(50) | | Asset category |
| created_at | timestamptz | DEFAULT NOW() | Upload date |
| updated_at | timestamptz | DEFAULT NOW() | Last update |

**Indexes:**
- PRIMARY KEY (id)

### 🛒 purchase_requests
Student store purchase requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Request ID |
| student_id | uuid | NOT NULL, FK → students.id ON DELETE CASCADE | Requester |
| store_item_id | uuid | NOT NULL, FK → store_items.id ON DELETE CASCADE | Item requested |
| item_type | varchar(50) | | Snapshot: item type |
| cost | integer | | Snapshot: item cost |
| status | varchar(20) | DEFAULT 'pending' | pending/approved/denied |
| requested_at | timestamptz | DEFAULT NOW() | Request time |
| processed_at | timestamptz | | Decision time |
| processed_by | uuid | FK → profiles.id ON DELETE SET NULL | Approver/denier |
| notes | text | | Teacher notes |

**Indexes:**
- PRIMARY KEY (id)
- INDEX idx_purchase_requests_student_id (student_id)
- INDEX idx_purchase_requests_store_item_id (store_item_id)
- INDEX idx_purchase_requests_processed_by (processed_by) ✅
- INDEX idx_purchase_requests_status (status)
- INDEX idx_purchase_requests_student_status (student_id, status)

**Foreign Key Policies:**
- CASCADE delete with student or item
- SET NULL if processor deleted

### 🎒 student_inventory
Owned items per student.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Inventory ID |
| student_id | uuid | NOT NULL, FK → students.id ON DELETE CASCADE | Owner |
| store_item_id | uuid | NOT NULL, FK → store_items.id ON DELETE CASCADE | Owned item |
| acquired_at | timestamptz | DEFAULT NOW() | Purchase date |
| is_equipped | boolean | DEFAULT false | Currently worn |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX unique_student_item (student_id, store_item_id)
- INDEX idx_student_inventory_student_id (student_id)
- INDEX idx_student_inventory_store_item_id (store_item_id)

**Foreign Key Policies:**
- CASCADE delete with student or item

### 💰 currency_transactions
Coin transaction ledger.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Transaction ID |
| student_id | uuid | NOT NULL, FK → students.id ON DELETE CASCADE | Student |
| teacher_id | uuid | FK → profiles.id ON DELETE SET NULL | Awarder (if manual) |
| amount | integer | NOT NULL | Coin amount (+/-) |
| transaction_type | varchar(20) | NOT NULL | award/purchase/adjustment |
| description | text | | Transaction note |
| created_at | timestamptz | DEFAULT NOW() | Transaction time |

**Indexes:**
- PRIMARY KEY (id)
- INDEX idx_currency_transactions_student_id (student_id)
- INDEX idx_currency_transactions_teacher_id (teacher_id)

**Foreign Key Policies:**
- CASCADE delete with student
- SET NULL if teacher deleted

### 📖 lesson_progress
Learning module completion tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Progress ID |
| student_id | uuid | NOT NULL, FK → students.id ON DELETE CASCADE | Student |
| lesson_id | varchar(50) | NOT NULL | Lesson identifier ⚠️ |
| is_completed | boolean | DEFAULT false | Completion flag |
| score | integer | | Achievement score |
| attempts | integer | DEFAULT 0 | Attempt count |
| last_attempted_at | timestamptz | | Last try time |
| completed_at | timestamptz | | Completion time |
| teacher_id | uuid | FK → profiles.id ON DELETE SET NULL | Assigning teacher |
| created_at | timestamptz | DEFAULT NOW() | First attempt |
| updated_at | timestamptz | DEFAULT NOW() | Last update |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX unique_student_lesson (student_id, lesson_id)
- INDEX idx_lesson_progress_student_id (student_id)
- INDEX idx_lesson_progress_teacher_id (teacher_id)

**Foreign Key Policies:**
- CASCADE delete with student
- SET NULL if teacher deleted

⚠️ **Issue**: lesson_id should reference a lessons table

### ⚙️ store_settings
Per-teacher store configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Settings ID |
| teacher_id | uuid | NOT NULL, UNIQUE, FK → profiles.id ON DELETE CASCADE | Teacher |
| class_id | uuid | FK → classes.id ON DELETE CASCADE | Specific class ⚠️ |
| is_open | boolean | DEFAULT false | Store availability |
| opened_at | timestamptz | | Open timestamp |
| closes_at | timestamptz | | Close timestamp |
| auto_approval_threshold | integer | | Auto-approve limit |
| settings | jsonb | DEFAULT {} | Extra settings |
| created_at | timestamptz | DEFAULT NOW() | Created date |
| updated_at | timestamptz | DEFAULT NOW() | Last update |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (teacher_id)
- INDEX idx_store_settings_class_id (class_id)

**Foreign Key Policies:**
- CASCADE delete with teacher or class

⚠️ **Issue**: No constraint ensuring class belongs to teacher

### 📊 admin_logs
Admin action audit trail.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Log ID |
| admin_id | uuid | NOT NULL, FK → profiles.id ON DELETE RESTRICT | Admin user |
| action | varchar(100) | NOT NULL | Action performed |
| target_type | varchar(50) | | Entity type |
| target_id | uuid | | Entity ID |
| target_user_id | uuid | FK → profiles.id ON DELETE SET NULL | Affected user |
| details | jsonb | | Action details |
| created_at | timestamptz | DEFAULT NOW() | Action time |

**Indexes:**
- PRIMARY KEY (id)
- INDEX idx_admin_logs_admin_id (admin_id)
- INDEX idx_admin_logs_target_user_id (target_user_id)

**Foreign Key Policies:**
- RESTRICT delete if admin has logs
- SET NULL if target user deleted

### 🎯 item_animal_positions
Avatar item positioning per animal type.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT uuid_generate_v4() | Position ID |
| item_type | varchar(50) | NOT NULL | Item identifier ⚠️ |
| animal_type | varchar(50) | NOT NULL | Animal identifier ⚠️ |
| x_position | numeric(5,2) | DEFAULT 50 | X coordinate (%) |
| y_position | numeric(5,2) | DEFAULT 50 | Y coordinate (%) |
| scale | numeric(3,2) | DEFAULT 1.0 | Size multiplier |
| rotation | integer | DEFAULT 0 | Rotation degrees |
| created_at | timestamptz | DEFAULT NOW() | Created date |
| updated_at | timestamptz | DEFAULT NOW() | Last update |

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX unique_item_animal (item_type, animal_type)

⚠️ **Issue**: item_type and animal_type should be foreign keys

## Row Level Security

All tables have RLS enabled with the following policy patterns:

1. **Teachers**: Can only see/modify their own data and their students' data
2. **Students**: Access via passport codes (no direct auth)
3. **Admins**: Full access when is_admin = true
4. **Public**: Can view active store items and assets only

## Database Functions

### is_admin(user_id uuid)
Returns true if the user has admin privileges.

### generate_passport_code()
Generates a unique 6-character alphanumeric code.

### update_updated_at_column()
Trigger function to auto-update updated_at timestamps.
⚠️ **Issue**: This trigger may not be properly applied to all tables

## Migration Strategy

1. All future migrations use Drizzle Kit: `npm run db:generate`
2. Schema source of truth: `/shared/schema.ts` (Drizzle schema definition)
3. Production migrations: Apply via Supabase dashboard
4. Never use manual SQL scripts or run-any-migration.ts

## Performance Considerations

1. All foreign keys are indexed
2. Partial indexes on boolean flags (is_active, etc)
3. RLS policies need optimization (use SELECT subqueries)
4. UUID joins are efficient with proper indexes
5. JSONB columns for flexible schema (avatar_data, room_data)

## Security Notes

1. All tables use Row Level Security
2. Service role bypasses RLS (use carefully)
3. Students don't have direct database access
4. Passport codes are unique and random
5. Soft deletes preserve referential integrity

## TODO: Critical Fixes Needed

1. **Create lookup tables** for item_types, animal_types, and lessons
2. **Add updated_at trigger** to all tables
3. **Add constraint** to store_settings ensuring class belongs to teacher
4. **Generate this documentation automatically** from Drizzle schema
