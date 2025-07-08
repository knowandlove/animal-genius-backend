# Co-Teacher System Test Flow

## Overview
This test flow will verify the complete co-teacher system implementation, including invitations, permissions, and security boundaries.

## Pre-Test Setup
- Database migration completed ✅
- Security fixes applied ✅
- All components implemented ✅

---

## Step 1: Database Verification
**Goal**: Verify the database migration was successful and tables exist

### What we'll check:
- `class_collaborators` table exists
- Helper functions are working
- Indexes are in place
- Foreign key constraints are correct

### Commands to run:
```bash
# Verify table structure
psql $DATABASE_URL -c "\d class_collaborators"

# Test helper functions
psql $DATABASE_URL -c "SELECT has_class_access('test-user-id', 'test-class-id');"
```

---

## Step 2: Start Development Servers
**Goal**: Get both frontend and backend running

### Backend:
```bash
cd /Users/jasonlackey/Desktop/KALPRO/animal-genius-backend
npm run dev
```

### Frontend:
```bash
cd /Users/jasonlackey/Desktop/KALPRO/animal-genius-frontend
npm run dev
```

---

## Step 3: Create Test Teacher Accounts
**Goal**: Set up primary teacher and co-teacher accounts

### Primary Teacher Account:
- Email: `primary@test.com`
- Name: `Primary Teacher`
- Create a test class: `Test Class 2025`

### Co-Teacher Account:
- Email: `coteacher@test.com`
- Name: `Co Teacher`
- This account should NOT have access to the test class initially

---

## Step 4: Test Invitation Flow
**Goal**: Verify the complete invitation workflow

### 4a. Send Invitation
- Login as Primary Teacher
- Navigate to class settings
- Find "Co-Teachers" section
- Invite `coteacher@test.com` with "viewer" role
- Verify invitation email is sent (check logs)

### 4b. Accept Invitation
- Login as Co-Teacher
- Check for invitation notification
- Accept the invitation
- Verify access is granted

### 4c. Verify Database State
```sql
SELECT * FROM class_collaborators WHERE invitation_status = 'accepted';
```

---

## Step 5: Test Permission Boundaries
**Goal**: Verify co-teacher permissions work correctly

### 5a. Read-Only Access (Viewer Role)
As Co-Teacher, verify you CAN:
- View class analytics
- View student list
- View lesson progress
- View reports

As Co-Teacher, verify you CANNOT:
- Edit student information
- Add/remove students
- Change class settings
- Delete the class

### 5b. API Endpoint Testing
Test these endpoints as Co-Teacher:
```bash
# Should work (viewer permissions)
GET /api/classes/:classId/analytics
GET /api/classes/:classId/students
GET /api/classes/:classId/reports

# Should fail (editor permissions)
POST /api/classes/:classId/students
PUT /api/classes/:classId/settings
DELETE /api/classes/:classId
```

---

## Step 6: Test Edge Cases
**Goal**: Verify system handles edge cases properly

### 6a. Duplicate Invitations
- Try inviting the same email twice
- Should prevent duplicate invitations

### 6b. Self-Invitation
- Try inviting yourself
- Should prevent self-invitations

### 6c. Invalid Email
- Try inviting invalid email format
- Should show proper error message

### 6d. Expired Invitations
- Check invitation expiration (7 days)
- Verify expired invitations cannot be accepted

### 6e. Revoke Access
- Remove co-teacher access
- Verify they lose permissions immediately

---

## Step 7: Security Validation
**Goal**: Ensure security boundaries are enforced

### 7a. Direct API Access
Try accessing endpoints without proper authentication:
```bash
# Should all fail with 401/403
curl -X GET http://localhost:3000/api/classes/test-class-id/analytics
curl -X POST http://localhost:3000/api/classes/test-class-id/collaborators/invite
```

### 7b. Class Ownership
- Verify co-teachers cannot:
  - Invite other co-teachers
  - Change class ownership
  - Delete the class
  - Access other classes they're not invited to

### 7c. Student Data Protection
- Verify passport codes are not exposed
- Verify student data is properly protected
- Test room access permissions

---

## Step 8: Frontend UI Testing
**Goal**: Verify all UI components work correctly

### 8a. Co-Teacher Management UI
- Invite modal opens correctly
- Shows pending invitations
- Lists active co-teachers
- Remove co-teacher button works

### 8b. Permission Gates
- UI elements show/hide based on permissions
- Error messages display correctly
- Loading states work properly

### 8c. Responsive Design
- Test on different screen sizes
- Verify mobile compatibility

---

## Success Criteria
✅ All database operations work correctly
✅ Invitation flow completes successfully
✅ Permission boundaries are enforced
✅ Security measures prevent unauthorized access
✅ UI components function properly
✅ Edge cases are handled gracefully

---

## Rollback Plan
If any critical issues are found:
1. Document the issue
2. Revert problematic changes
3. Fix issues in development
4. Re-run test flow

---

## Test Data Cleanup
After testing, clean up test data:
```sql
DELETE FROM class_collaborators WHERE class_id IN (SELECT id FROM classes WHERE name LIKE 'Test%');
DELETE FROM classes WHERE name LIKE 'Test%';
DELETE FROM profiles WHERE email IN ('primary@test.com', 'coteacher@test.com');
```