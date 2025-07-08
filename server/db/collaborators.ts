import { db } from '../db';
import { classCollaborators, classes, students } from '../../shared/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

/**
 * Check if a user has any access to a class (owner or accepted collaborator)
 */
export async function hasClassAccess(teacherId: string, classId: string): Promise<boolean> {
  // Check if user is the class owner
  const classOwner = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(
      eq(classes.id, classId),
      eq(classes.teacherId, teacherId)
    ))
    .limit(1);

  if (classOwner.length > 0) {
    return true;
  }

  // Check if user is an accepted collaborator
  const collaborator = await db
    .select({ id: classCollaborators.id })
    .from(classCollaborators)
    .where(and(
      eq(classCollaborators.classId, classId),
      eq(classCollaborators.teacherId, teacherId),
      eq(classCollaborators.invitationStatus, 'accepted'),
      isNull(classCollaborators.revokedAt)
    ))
    .limit(1);

  return collaborator.length > 0;
}

/**
 * Check if a user can edit a class (owner or editor collaborator)
 */
export async function canEditClass(teacherId: string, classId: string): Promise<boolean> {
  // Check if user is the class owner
  const classOwner = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(
      eq(classes.id, classId),
      eq(classes.teacherId, teacherId)
    ))
    .limit(1);

  if (classOwner.length > 0) {
    return true;
  }

  // Check if user is an editor collaborator
  const collaborator = await db
    .select({ id: classCollaborators.id })
    .from(classCollaborators)
    .where(and(
      eq(classCollaborators.classId, classId),
      eq(classCollaborators.teacherId, teacherId),
      eq(classCollaborators.role, 'editor'),
      eq(classCollaborators.invitationStatus, 'accepted'),
      isNull(classCollaborators.revokedAt)
    ))
    .limit(1);

  return collaborator.length > 0;
}

/**
 * Get a user's role in a class
 */
export async function getClassRole(teacherId: string, classId: string): Promise<'owner' | 'viewer' | 'editor' | null> {
  // Check if user is the owner
  const classOwner = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(
      eq(classes.id, classId),
      eq(classes.teacherId, teacherId)
    ))
    .limit(1);

  if (classOwner.length > 0) {
    return 'owner';
  }

  // Check if user is a collaborator
  const collaborator = await db
    .select({ role: classCollaborators.role })
    .from(classCollaborators)
    .where(and(
      eq(classCollaborators.classId, classId),
      eq(classCollaborators.teacherId, teacherId),
      eq(classCollaborators.invitationStatus, 'accepted'),
      isNull(classCollaborators.revokedAt)
    ))
    .limit(1);

  if (collaborator.length > 0) {
    return collaborator[0].role as 'viewer' | 'editor';
  }

  return null;
}

/**
 * Check if a user has a specific permission for a class
 */
export async function hasCollaboratorPermission(
  teacherId: string, 
  classId: string, 
  permission: string
): Promise<boolean> {
  // Owners always have all permissions
  const classOwner = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(
      eq(classes.id, classId),
      eq(classes.teacherId, teacherId)
    ))
    .limit(1);

  if (classOwner.length > 0) {
    return true;
  }

  // Check collaborator permissions
  const collaborator = await db
    .select({ permissions: classCollaborators.permissions })
    .from(classCollaborators)
    .where(and(
      eq(classCollaborators.classId, classId),
      eq(classCollaborators.teacherId, teacherId),
      eq(classCollaborators.invitationStatus, 'accepted'),
      isNull(classCollaborators.revokedAt)
    ))
    .limit(1);

  if (collaborator.length > 0 && collaborator[0].permissions) {
    const permissions = collaborator[0].permissions as Record<string, unknown>;
    return permissions[permission] === true;
  }

  return false;
}

/**
 * Get all classes where a user has access (owned or collaborating)
 */
export async function getAccessibleClasses(teacherId: string) {
  // Get owned classes
  const ownedClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
      role: sql<string>`'owner'`.as('role'),
      classCode: classes.classCode,
      subject: classes.subject,
      gradeLevel: classes.gradeLevel,
      isArchived: classes.isArchived,
      createdAt: classes.createdAt,
    })
    .from(classes)
    .where(and(
      eq(classes.teacherId, teacherId),
      isNull(classes.deletedAt)
    ));

  // Get collaborating classes
  const collaboratingClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
      role: classCollaborators.role,
      classCode: classes.classCode,
      subject: classes.subject,
      gradeLevel: classes.gradeLevel,
      isArchived: classes.isArchived,
      createdAt: classes.createdAt,
    })
    .from(classCollaborators)
    .innerJoin(classes, eq(classCollaborators.classId, classes.id))
    .where(and(
      eq(classCollaborators.teacherId, teacherId),
      eq(classCollaborators.invitationStatus, 'accepted'),
      isNull(classCollaborators.revokedAt),
      isNull(classes.deletedAt)
    ));

  // Combine and sort by creation date
  return [...ownedClasses, ...collaboratingClasses].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Get all collaborators for a class
 */
/**
 * Get all accessible classes with student counts in a single query
 * This replaces the N+1 query pattern in the teacher dashboard
 */
export async function getAccessibleClassesWithStats(teacherId: string) {
  // Get owned classes with student counts
  const ownedClassesWithStats = await db
    .select({
      id: classes.id,
      name: classes.name,
      role: sql<string>`'owner'`.as('role'),
      classCode: classes.classCode,
      subject: classes.subject,
      gradeLevel: classes.gradeLevel,
      isArchived: classes.isArchived,
      createdAt: classes.createdAt,
      studentCount: sql<number>`COALESCE(COUNT(${students.id}), 0)`.as('studentCount'),
    })
    .from(classes)
    .leftJoin(students, eq(students.classId, classes.id))
    .where(and(
      eq(classes.teacherId, teacherId),
      isNull(classes.deletedAt)
    ))
    .groupBy(classes.id);

  // Get collaborating classes with student counts
  const collaboratingClassesWithStats = await db
    .select({
      id: classes.id,
      name: classes.name,
      role: classCollaborators.role,
      classCode: classes.classCode,
      subject: classes.subject,
      gradeLevel: classes.gradeLevel,
      isArchived: classes.isArchived,
      createdAt: classes.createdAt,
      studentCount: sql<number>`COALESCE(COUNT(DISTINCT ${students.id}), 0)`.as('studentCount'),
    })
    .from(classCollaborators)
    .innerJoin(classes, eq(classCollaborators.classId, classes.id))
    .leftJoin(students, eq(students.classId, classes.id))
    .where(and(
      eq(classCollaborators.teacherId, teacherId),
      eq(classCollaborators.invitationStatus, 'accepted'),
      isNull(classCollaborators.revokedAt),
      isNull(classes.deletedAt)
    ))
    .groupBy(classes.id, classCollaborators.role);

  // Combine and sort by creation date
  return [...ownedClassesWithStats, ...collaboratingClassesWithStats].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function getClassCollaborators(classId: string) {
  return await db
    .select({
      id: classCollaborators.id,
      teacherId: classCollaborators.teacherId,
      teacherEmail: sql<string>`profiles.email`.as('teacherEmail'),
      teacherName: sql<string>`profiles.full_name`.as('teacherName'),
      role: classCollaborators.role,
      permissions: classCollaborators.permissions,
      invitationStatus: classCollaborators.invitationStatus,
      invitedAt: classCollaborators.invitedAt,
      acceptedAt: classCollaborators.acceptedAt,
      invitedByEmail: sql<string>`inviter.email`.as('invitedByEmail'),
      invitedByName: sql<string>`inviter.full_name`.as('invitedByName'),
    })
    .from(classCollaborators)
    .innerJoin(sql`profiles`, sql`profiles.id = class_collaborators.teacher_id`)
    .innerJoin(sql`profiles AS inviter`, sql`inviter.id = class_collaborators.invited_by`)
    .where(and(
      eq(classCollaborators.classId, classId),
      isNull(classCollaborators.revokedAt)
    ))
    .orderBy(classCollaborators.invitedAt);
}

/**
 * Check if an invitation token is valid
 */
export async function validateInvitationToken(token: string) {
  const invitation = await db
    .select({
      id: classCollaborators.id,
      classId: classCollaborators.classId,
      teacherId: classCollaborators.teacherId,
      invitationStatus: classCollaborators.invitationStatus,
      invitedAt: classCollaborators.invitedAt,
      className: classes.name,
      classCode: classes.classCode,
    })
    .from(classCollaborators)
    .innerJoin(classes, eq(classCollaborators.classId, classes.id))
    .where(and(
      eq(classCollaborators.invitationToken, token),
      eq(classCollaborators.invitationStatus, 'pending'),
      isNull(classCollaborators.revokedAt)
    ))
    .limit(1);

  if (invitation.length === 0) {
    return null;
  }

  // Check if invitation has expired (7 days)
  const invitationData = invitation[0];
  const invitedAt = new Date(invitationData.invitedAt);
  const now = new Date();
  const daysSinceInvitation = (now.getTime() - invitedAt.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceInvitation > 7) {
    // Invitation has expired
    return null;
  }

  return invitationData;
}