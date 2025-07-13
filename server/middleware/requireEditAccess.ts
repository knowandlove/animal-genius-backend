import { Request, Response, NextFunction } from 'express';

interface RoomAccessRequest extends Request {
  roomAccess?: {
    canView: boolean;
    canEdit: boolean;
    isOwner: boolean;
    isTeacher: boolean;
    roomOwner: {
      id: string;
      classId: string;
      roomVisibility?: string | null;
      studentName: string | null;
    };
  };
}

/**
 * Middleware to require edit access to a room
 * Must be used after checkRoomAccess middleware
 */
export function requireEditAccess(req: RoomAccessRequest, res: Response, next: NextFunction) {
  if (!req.roomAccess) {
    return res.status(403).json({ message: "Access denied - no room access information" });
  }

  if (!req.roomAccess.canEdit) {
    return res.status(403).json({ message: "You don't have permission to edit this room" });
  }

  next();
}