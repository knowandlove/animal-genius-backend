export type CollaboratorRole = 'viewer' | 'editor';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface CollaboratorPermissions {
  can_manage_students?: boolean;
  can_manage_store?: boolean;
  can_view_analytics?: boolean;
  can_export_data?: boolean;
  can_send_messages?: boolean;
  can_manage_curriculum?: boolean;
}

export interface ClassCollaboratorInvite {
  email: string;
  role: CollaboratorRole;
  permissions?: CollaboratorPermissions;
  message?: string;
}

export interface ClassCollaboratorResponse {
  id: string;
  teacherId: string;
  teacherEmail: string;
  teacherName: string | null;
  role: CollaboratorRole;
  permissions: CollaboratorPermissions;
  invitationStatus: InvitationStatus;
  invitedAt: Date;
  acceptedAt: Date | null;
  invitedByEmail: string;
  invitedByName: string | null;
}

export interface CollaboratorClassInfo {
  id: string;
  name: string;
  role: 'owner' | CollaboratorRole;
  classCode: string;
  subject: string | null;
  gradeLevel: string | null;
  isArchived: boolean;
  createdAt: Date;
}