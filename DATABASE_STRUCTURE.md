# Animal Genius Database Structure

## User Types

### Teachers (profiles table)
- **id** - UUID primary key
- **email** - Teacher login email
- **full_name**, **first_name**, **last_name** - Name fields
- **school_organization** - School/org they belong to
- **is_admin** - Admin privileges
- **is_anonymous** - False for real teachers
- **personality_animal** - Their own animal personality
- **created_at**, **updated_at**, **last_login_at** - Timestamps

### Students (students table)
- **id** - UUID primary key
- **passport_code** - Unique login code (XXX-XXX format)
- **student_name** - Full name
- **class_id** - Which class they belong to
- **animal_type_id** - Their quiz result animal
- **avatar_data** - JSON for avatar customization
- **room_data** - JSON for room customization
- **currency_balance** - Coins earned
- NO PASSWORD - students use passport codes only

## Teacher-Owned Tables

Based on foreign key analysis, these tables belong to teachers:

### Core Teaching
- **classes** - Classes created by teachers (teacher_id)
- **store_settings** - Store configuration per teacher (teacher_id)
- **lesson_feedback** - Feedback on lessons from teachers (teacher_id)

### Teacher Community
- **discussions** - Forum posts by teachers (teacher_id)
- **replies** - Replies to discussions (teacher_id)

### Teacher Features
- **interactions** - Some kind of teacher interactions (teacher_id)
- **game_sessions** - Game sessions run by teachers (teacher_id)
- **currency_transactions** - Can be teacher OR student transactions

## Student-Related Tables

Based on foreign key analysis, here are all tables that directly reference students:

### Core Student Data
- **students** - Main student records
- **quiz_submissions** - Completed personality quizzes (student_id)
- **passport_codes** - Passport code tracking (student_id)

### Student Economy
- **currency_transactions** - Coin transactions (student_id OR teacher_id)
- **student_inventory** - Items owned by students (student_id)
- **purchase_history** - Store purchases (student_id)

### Student Pets
- **student_pets** - Pets owned by students (student_id)
- **pet_interactions** - Interactions with pets (student_pet_id)

### Student Rooms & Social
- **room_visits** - Who visits whose room (visitor_student_id, visited_student_id)
- **room_guestbook** - Messages in rooms (visitor_student_id, room_owner_student_id)

### Student Progress
- **student_achievements** - Badges/achievements earned (student_id)
- **class_values_votes** - Votes in class values exercises (student_id)

## Shared/System Tables

These don't belong to teachers or students specifically:

- **animal_types** - Available personality animals
- **genius_types** - Types of genius
- **pets** - Available pet types
- **store_items** - Items available in store
- **lessons** - Lesson content
- **assets** - Media assets
- **item_types** - Types of store items
- **patterns** - Visual patterns

## Data Relationships

### Teacher → Student Flow
1. Teacher creates **profile**
2. Teacher creates **classes**
3. Students take quiz → create **students** record
4. Students get **passport_codes** for login
5. Students earn coins via **currency_transactions**
6. Students buy items → **purchase_history** + **student_inventory**

### Important Notes
- **class_collaborators** table was deleted (not in use)
- Students NEVER have passwords - only passport codes
- Teachers use email/password auth
- Some tables may have student_id columns without foreign keys