# Avatar Customization Flow Test Plan

## Setup
1. Apply the migration: `npx supabase migration up` (or manually run the SQL file)
2. Start both backend and frontend servers

## Test Flow

### 1. New Student Flow
1. Go to quiz URL (e.g., `/q/[CLASS-CODE]`)
2. Enter name and last initial
3. Complete the quiz
4. Note the passport code
5. Go to student dashboard
6. Click "Visit My Room"
7. **Expected**: Full-screen avatar customization should appear
8. Choose colors and complete customization
9. **Expected**: Room loads with customized avatar colors

### 2. Existing Student Flow (without customization)
For students created before this update:
1. Login with existing passport code
2. Visit room
3. **Expected**: Full-screen avatar customization should appear
4. Complete customization
5. **Expected**: Avatar shows with custom colors

### 3. Returning Student Flow (already customized)
1. Login with passport code of student who already customized
2. Visit room
3. **Expected**: Room loads directly without customization screen
4. **Expected**: Avatar shows with previously selected custom colors

## Database Verification

Check that avatar_data is properly initialized:

```sql
-- Check new students have the correct structure
SELECT 
  student_name,
  avatar_data,
  avatar_data->'colors'->>'hasCustomized' as has_customized
FROM students
ORDER BY created_at DESC
LIMIT 5;

-- Check that existing students were updated
SELECT COUNT(*) 
FROM students 
WHERE avatar_data IS NULL 
   OR avatar_data::text = '{}'
   OR NOT (avatar_data ? 'colors');
```

## Component Checklist

✅ Migration created to initialize avatar_data
✅ FirstTimeAvatarCustomization component exists
✅ StudentRoom detects uncustomized avatars
✅ Avatar colors API endpoint exists
✅ MainRoomView passes colors to NormalizedAvatar
✅ NormalizedAvatar accepts and uses custom colors
✅ SVGAvatar renders with custom colors

## Known Issues to Watch For

1. If the migration hasn't been applied, avatar_data will be null
2. Colors must be hex format (#RRGGBB)
3. Both primaryColor and secondaryColor must be set for custom rendering
4. The FirstTimeAvatarCustomization only shows for room owners (access.isOwner)

## API Endpoints

- **Save Colors**: POST `/api/room/:passportCode/avatar-colors`
  ```json
  {
    "primaryColor": "#FF6B6B",
    "secondaryColor": "#4ECDC4"
  }
  ```

- **Get Room Data**: GET `/api/room-page-data/:passportCode`
  - Returns room data including avatarData with colors