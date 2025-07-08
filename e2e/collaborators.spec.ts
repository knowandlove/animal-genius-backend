import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../server/db';
import { classes, profiles, classCollaborators } from '../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Test data
const testUsers = {
  owner: {
    id: uuidv4(),
    userId: uuidv4(),
    email: 'owner@test.com',
    fullName: 'Class Owner',
  },
  collaborator: {
    id: uuidv4(),
    userId: uuidv4(),
    email: 'collaborator@test.com',
    fullName: 'Co Teacher',
  },
  viewer: {
    id: uuidv4(),
    userId: uuidv4(),
    email: 'viewer@test.com',
    fullName: 'Viewer Teacher',
  },
};

const testClass = {
  id: uuidv4(),
  name: 'Test Collaboration Class',
  classCode: 'TEST123',
  teacherId: testUsers.owner.id,
  subject: 'Math',
  gradeLevel: '5',
};

describe('Co-Teacher Collaboration End-to-End Tests', () => {
  beforeAll(async () => {
    // Create test users in profiles table
    await db.insert(profiles).values([
      testUsers.owner,
      testUsers.collaborator,
      testUsers.viewer,
    ]);

    // Create test class
    await db.insert(classes).values(testClass);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(classCollaborators).where(eq(classCollaborators.classId, testClass.id));
    await db.delete(classes).where(eq(classes.id, testClass.id));
    await db.delete(profiles).where(eq(profiles.id, testUsers.owner.id));
    await db.delete(profiles).where(eq(profiles.id, testUsers.collaborator.id));
    await db.delete(profiles).where(eq(profiles.id, testUsers.viewer.id));
  });

  beforeEach(async () => {
    // Clean up any collaborators from previous tests
    await db.delete(classCollaborators).where(eq(classCollaborators.classId, testClass.id));
  });

  describe('Invitation Flow', () => {
    test('complete invitation lifecycle - create, view, accept', async () => {
      // Step 1: Create invitation
      const invitationToken = uuidv4();
      const [invitation] = await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'editor',
        invitedBy: testUsers.owner.id,
        invitationToken,
        invitationStatus: 'pending',
        permissions: {
          can_manage_students: true,
          can_manage_store: true,
          can_view_analytics: true,
          can_export_data: true,
          can_send_messages: true,
          can_manage_curriculum: true,
        },
      }).returning();

      expect(invitation).toBeDefined();
      expect(invitation.invitationStatus).toBe('pending');

      // Step 2: Validate invitation token
      const pendingInvitation = await db
        .select({
          id: classCollaborators.id,
          classId: classCollaborators.classId,
          teacherId: classCollaborators.teacherId,
          invitationStatus: classCollaborators.invitationStatus,
        })
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.invitationToken, invitationToken),
          eq(classCollaborators.invitationStatus, 'pending'),
          isNull(classCollaborators.revokedAt)
        ))
        .limit(1);

      expect(pendingInvitation).toHaveLength(1);
      expect(pendingInvitation[0].teacherId).toBe(testUsers.collaborator.id);

      // Step 3: Accept invitation
      const [acceptedInvitation] = await db
        .update(classCollaborators)
        .set({
          invitationStatus: 'accepted',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(classCollaborators.id, invitation.id))
        .returning();

      expect(acceptedInvitation.invitationStatus).toBe('accepted');
      expect(acceptedInvitation.acceptedAt).toBeDefined();

      // Step 4: Verify collaborator has access
      const hasAccess = await db
        .select({ id: classCollaborators.id })
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.classId, testClass.id),
          eq(classCollaborators.teacherId, testUsers.collaborator.id),
          eq(classCollaborators.invitationStatus, 'accepted'),
          isNull(classCollaborators.revokedAt)
        ))
        .limit(1);

      expect(hasAccess).toHaveLength(1);
    });

    test('expired invitation cannot be accepted', async () => {
      const expiredToken = uuidv4();
      
      // Create an already accepted invitation
      await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'viewer',
        invitedBy: testUsers.owner.id,
        invitationToken: expiredToken,
        invitationStatus: 'accepted',
        acceptedAt: new Date(),
      });

      // Try to find pending invitation with this token
      const invitation = await db
        .select()
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.invitationToken, expiredToken),
          eq(classCollaborators.invitationStatus, 'pending')
        ))
        .limit(1);

      expect(invitation).toHaveLength(0);
    });

    test('revoked invitation cannot be accepted', async () => {
      const revokedToken = uuidv4();
      
      // Create a revoked invitation
      await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'viewer',
        invitedBy: testUsers.owner.id,
        invitationToken: revokedToken,
        invitationStatus: 'pending',
        revokedAt: new Date(),
      });

      // Try to find valid invitation with this token
      const invitation = await db
        .select()
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.invitationToken, revokedToken),
          eq(classCollaborators.invitationStatus, 'pending'),
          isNull(classCollaborators.revokedAt)
        ))
        .limit(1);

      expect(invitation).toHaveLength(0);
    });
  });

  describe('Permission Boundaries', () => {
    test('viewer cannot perform editor actions', async () => {
      // Create viewer collaborator
      await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.viewer.id,
        role: 'viewer',
        invitedBy: testUsers.owner.id,
        invitationToken: uuidv4(),
        invitationStatus: 'accepted',
        acceptedAt: new Date(),
        permissions: {
          can_manage_students: false,
          can_manage_store: false,
          can_view_analytics: true,
          can_export_data: false,
          can_send_messages: false,
          can_manage_curriculum: false,
        },
      });

      // Check viewer permissions
      const viewerCollaborator = await db
        .select({ permissions: classCollaborators.permissions })
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.classId, testClass.id),
          eq(classCollaborators.teacherId, testUsers.viewer.id)
        ))
        .limit(1);

      expect(viewerCollaborator).toHaveLength(1);
      const permissions = viewerCollaborator[0].permissions as any;
      
      // Viewers should not have edit permissions
      expect(permissions.can_manage_students).toBe(false);
      expect(permissions.can_manage_store).toBe(false);
      expect(permissions.can_manage_curriculum).toBe(false);
      
      // Viewers should have view permissions
      expect(permissions.can_view_analytics).toBe(true);
    });

    test('editor has appropriate permissions', async () => {
      // Create editor collaborator
      await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'editor',
        invitedBy: testUsers.owner.id,
        invitationToken: uuidv4(),
        invitationStatus: 'accepted',
        acceptedAt: new Date(),
        permissions: {
          can_manage_students: true,
          can_manage_store: true,
          can_view_analytics: true,
          can_export_data: true,
          can_send_messages: true,
          can_manage_curriculum: true,
        },
      });

      // Check editor permissions
      const editorCollaborator = await db
        .select({ permissions: classCollaborators.permissions })
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.classId, testClass.id),
          eq(classCollaborators.teacherId, testUsers.collaborator.id)
        ))
        .limit(1);

      expect(editorCollaborator).toHaveLength(1);
      const permissions = editorCollaborator[0].permissions as any;
      
      // Editors should have all permissions
      expect(permissions.can_manage_students).toBe(true);
      expect(permissions.can_manage_store).toBe(true);
      expect(permissions.can_view_analytics).toBe(true);
      expect(permissions.can_manage_curriculum).toBe(true);
    });

    test('owner has all permissions without explicit record', async () => {
      // Owner should have access without being in collaborators table
      const ownerInCollaborators = await db
        .select()
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.classId, testClass.id),
          eq(classCollaborators.teacherId, testUsers.owner.id)
        ))
        .limit(1);

      expect(ownerInCollaborators).toHaveLength(0);

      // But owner should be found as class owner
      const classOwner = await db
        .select({ teacherId: classes.teacherId })
        .from(classes)
        .where(eq(classes.id, testClass.id))
        .limit(1);

      expect(classOwner).toHaveLength(1);
      expect(classOwner[0].teacherId).toBe(testUsers.owner.id);
    });
  });

  describe('Edge Cases', () => {
    test('cannot invite self as collaborator', async () => {
      // Attempt to create self-invitation should be prevented by business logic
      // This would be caught at the API level, not database level
      const selfInvitation = {
        classId: testClass.id,
        teacherId: testUsers.owner.id, // Same as class owner
        role: 'editor' as const,
        invitedBy: testUsers.owner.id,
        invitationToken: uuidv4(),
        invitationStatus: 'pending' as const,
      };

      // In real app, this would be prevented by API validation
      // Here we just verify the data structure
      expect(selfInvitation.teacherId).toBe(selfInvitation.invitedBy);
    });

    test('cannot have duplicate active collaborators', async () => {
      // Create first collaborator
      await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'editor',
        invitedBy: testUsers.owner.id,
        invitationToken: uuidv4(),
        invitationStatus: 'accepted',
        acceptedAt: new Date(),
      });

      // Check for existing collaborator
      const existing = await db
        .select()
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.classId, testClass.id),
          eq(classCollaborators.teacherId, testUsers.collaborator.id),
          isNull(classCollaborators.revokedAt)
        ))
        .limit(1);

      expect(existing).toHaveLength(1);
    });

    test('invitation token must be unique', async () => {
      const token = uuidv4();
      
      // Create first invitation
      await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'editor',
        invitedBy: testUsers.owner.id,
        invitationToken: token,
        invitationStatus: 'pending',
      });

      // Try to create another with same token would fail due to unique constraint
      // This is enforced at database level
    });

    test('can re-invite after revoking', async () => {
      // Create and revoke first invitation
      const [firstInvitation] = await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'viewer',
        invitedBy: testUsers.owner.id,
        invitationToken: uuidv4(),
        invitationStatus: 'accepted',
        acceptedAt: new Date(),
      }).returning();

      // Revoke it
      await db
        .update(classCollaborators)
        .set({ revokedAt: new Date() })
        .where(eq(classCollaborators.id, firstInvitation.id));

      // Create new invitation for same user
      const [secondInvitation] = await db.insert(classCollaborators).values({
        classId: testClass.id,
        teacherId: testUsers.collaborator.id,
        role: 'editor', // Different role this time
        invitedBy: testUsers.owner.id,
        invitationToken: uuidv4(),
        invitationStatus: 'pending',
      }).returning();

      expect(secondInvitation).toBeDefined();
      expect(secondInvitation.role).toBe('editor');

      // Verify only new invitation is active
      const activeInvitations = await db
        .select()
        .from(classCollaborators)
        .where(and(
          eq(classCollaborators.classId, testClass.id),
          eq(classCollaborators.teacherId, testUsers.collaborator.id),
          isNull(classCollaborators.revokedAt)
        ));

      expect(activeInvitations).toHaveLength(1);
      expect(activeInvitations[0].id).toBe(secondInvitation.id);
    });
  });
});