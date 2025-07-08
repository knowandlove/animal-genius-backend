import { Router } from 'express';
import { db } from '../db';
import { classCollaborators, classes, profiles } from '../../shared/schema';
import { and, eq, sql, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { requireClassOwner, requireClassAccess, CollaboratorRequest } from '../middleware/collaborators';
import { getClassCollaborators, validateInvitationToken, getAccessibleClasses } from '../db/collaborators';
import { CollaboratorPermissions, ClassCollaboratorInvite } from '../../shared/types/collaborators';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from 'express-rate-limit';
import { sendCollaboratorInvitation } from '../services/email';

const router = Router();

// Initialize Supabase client for auth checks
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiter for invitations (5 per day per user)
const invitationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: 'Too many invitations sent. Please try again tomorrow.',
  keyGenerator: (req) => req.user?.userId || 'anonymous',
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/classes/:classId/collaborators/invite
// Send an invitation to a collaborator
router.post('/:classId/collaborators/invite', requireAuth, requireClassOwner, invitationLimiter, async (req: CollaboratorRequest, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user!.userId;
    const invite: ClassCollaboratorInvite = req.body;

    // Validate input
    if (!invite.email || !invite.role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['viewer', 'editor'].includes(invite.role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "viewer" or "editor"' });
    }

    // Get the inviter's profile
    const inviterProfile = await db
      .select({
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!inviterProfile.length) {
      return res.status(404).json({ error: 'Inviter profile not found' });
    }

    // Check if the email belongs to a registered user
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(invite.email);
    
    if (authError || !authUser) {
      return res.status(404).json({ error: 'User with this email not found. They must create an account first.' });
    }

    // Get the teacher profile
    const teacherProfile = await db
      .select({
        id: profiles.id,
      })
      .from(profiles)
      .where(eq(profiles.userId, authUser.id))
      .limit(1);

    if (!teacherProfile.length) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const inviteeId = teacherProfile[0].id;

    // Check if user is trying to invite themselves
    if (inviteeId === userId) {
      return res.status(400).json({ error: 'You cannot invite yourself as a collaborator' });
    }

    // Check if collaborator already exists
    const existingCollaborator = await db
      .select({ id: classCollaborators.id, invitationStatus: classCollaborators.invitationStatus })
      .from(classCollaborators)
      .where(and(
        eq(classCollaborators.classId, classId),
        eq(classCollaborators.teacherId, inviteeId)
      ))
      .limit(1);

    if (existingCollaborator.length > 0) {
      if (existingCollaborator[0].invitationStatus === 'pending') {
        return res.status(400).json({ error: 'An invitation is already pending for this user' });
      }
      return res.status(400).json({ error: 'This user is already a collaborator' });
    }

    // Get class details
    const classDetails = await db
      .select({ name: classes.name })
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!classDetails.length) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Create the invitation
    const invitationToken = uuidv4();
    const permissions: CollaboratorPermissions = invite.permissions || {
      can_manage_students: invite.role === 'editor',
      can_manage_store: invite.role === 'editor',
      can_view_analytics: true,
      can_export_data: invite.role === 'editor',
      can_send_messages: invite.role === 'editor',
      can_manage_curriculum: invite.role === 'editor',
    };

    const [newCollaborator] = await db
      .insert(classCollaborators)
      .values({
        classId,
        teacherId: inviteeId,
        role: invite.role,
        permissions,
        invitedBy: userId,
        invitationToken,
        invitationStatus: 'pending',
      })
      .returning();

    // Send invitation email
    const emailSent = await sendCollaboratorInvitation(
      invite.email,
      inviterProfile[0].fullName || inviterProfile[0].email,
      classDetails[0].name,
      invitationToken,
      invite.message
    );

    if (!emailSent) {
      // If email fails, still return success but warn the user
      return res.status(201).json({
        success: true,
        collaborator: newCollaborator,
        warning: 'Invitation created but email could not be sent. Please share the invitation link manually.',
        invitationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invitations/accept/${invitationToken}`
      });
    }

    res.status(201).json({
      success: true,
      collaborator: newCollaborator,
    });
  } catch (error) {
    console.error('Error inviting collaborator:', error);
    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
});

// GET /api/classes/:classId/collaborators
// List all collaborators for a class
router.get('/:classId/collaborators', requireAuth, requireClassAccess, async (req: CollaboratorRequest, res) => {
  try {
    const { classId } = req.params;
    
    const collaborators = await getClassCollaborators(classId);
    
    res.json({
      collaborators,
      userRole: req.userRole,
    });
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// DELETE /api/classes/:classId/collaborators/:collaboratorId
// Remove a collaborator from a class
router.delete('/:classId/collaborators/:collaboratorId', requireAuth, requireClassOwner, async (req: CollaboratorRequest, res) => {
  try {
    const { classId, collaboratorId } = req.params;
    
    // Update the collaborator record to mark as revoked
    const [revokedCollaborator] = await db
      .update(classCollaborators)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(classCollaborators.id, collaboratorId),
        eq(classCollaborators.classId, classId),
        isNull(classCollaborators.revokedAt)
      ))
      .returning();

    if (!revokedCollaborator) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    res.json({
      success: true,
      message: 'Collaborator removed successfully',
    });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// POST /api/invitations/accept/:token
// Accept an invitation
router.post('/invitations/accept/:token', requireAuth, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user!.userId;

    // Validate the invitation token
    const invitation = await validateInvitationToken(token);
    
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Check if the logged-in user matches the invited teacher
    if (invitation.teacherId !== userId) {
      return res.status(403).json({ error: 'This invitation is for a different user' });
    }

    // Accept the invitation
    const [acceptedInvitation] = await db
      .update(classCollaborators)
      .set({
        invitationStatus: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(classCollaborators.id, invitation.id))
      .returning();

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      classId: invitation.classId,
      className: invitation.className,
      classCode: invitation.classCode,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// GET /api/invitations/:token
// Get invitation details
router.get('/invitations/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // First validate if the invitation is valid and not expired
    const validInvitation = await validateInvitationToken(token);
    if (!validInvitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Get additional invitation details
    const invitation = await db
      .select({
        id: classCollaborators.id,
        classId: classCollaborators.classId,
        role: classCollaborators.role,
        className: classes.name,
        classCode: classes.classCode,
        inviterName: profiles.fullName,
        inviterEmail: profiles.email,
        invitedAt: classCollaborators.invitedAt,
      })
      .from(classCollaborators)
      .innerJoin(classes, eq(classCollaborators.classId, classes.id))
      .innerJoin(profiles, eq(classCollaborators.invitedBy, profiles.id))
      .where(eq(classCollaborators.invitationToken, token))
      .limit(1);

    if (!invitation.length) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    res.json({
      invitation: invitation[0],
    });
  } catch (error) {
    console.error('Error fetching invitation:', error);
    res.status(500).json({ error: 'Failed to fetch invitation details' });
  }
});

// GET /api/my-collaborations
// Get all classes where the user is a collaborator
router.get('/my-collaborations', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    const classes = await getAccessibleClasses(userId);
    
    res.json({
      classes,
    });
  } catch (error) {
    console.error('Error fetching collaborations:', error);
    res.status(500).json({ error: 'Failed to fetch collaborations' });
  }
});

export default router;