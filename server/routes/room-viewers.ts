import type { Express } from "express";

// In-memory storage for room viewers (in production, use Redis)
const roomViewers = new Map<string, Map<string, { name: string; joinedAt: Date }>>();

// Cleanup stale viewers every 30 seconds
setInterval(() => {
  const now = new Date();
  const STALE_THRESHOLD = 60 * 1000; // 60 seconds
  
  for (const [roomId, viewers] of roomViewers.entries()) {
    for (const [viewerId, viewer] of viewers.entries()) {
      if (now.getTime() - viewer.joinedAt.getTime() > STALE_THRESHOLD) {
        viewers.delete(viewerId);
      }
    }
    
    // Remove empty rooms
    if (viewers.size === 0) {
      roomViewers.delete(roomId);
    }
  }
}, 30000);

export function registerRoomViewerRoutes(app: Express) {
  // Join a room as a viewer
  app.post("/api/room/:passportCode/viewers/join", async (_req, res) => {
    try {
      const { passportCode } = req.params;
      const { viewerId, viewerName } = req.body;
      
      if (!viewerId || !viewerName) {
        return res.status(400).json({ message: "viewerId and viewerName required" });
      }
      
      // Get or create room viewer map
      if (!roomViewers.has(passportCode)) {
        roomViewers.set(passportCode, new Map());
      }
      
      const viewers = roomViewers.get(passportCode)!;
      viewers.set(viewerId, { name: viewerName, joinedAt: new Date() });
      
      // Return current viewers
      const viewerList = Array.from(viewers.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        joinedAt: data.joinedAt
      }));
      
      res.json({ viewers: viewerList });
    } catch (error) {
      console.error("Join room error:", error);
      res.status(500).json({ message: "Failed to join room" });
    }
  });
  
  // Leave a room
  app.post("/api/room/:passportCode/viewers/leave", async (_req, res) => {
    try {
      const { passportCode } = req.params;
      const { viewerId } = req.body;
      
      if (!viewerId) {
        return res.status(400).json({ message: "viewerId required" });
      }
      
      const viewers = roomViewers.get(passportCode);
      if (viewers) {
        viewers.delete(viewerId);
        
        if (viewers.size === 0) {
          roomViewers.delete(passportCode);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Leave room error:", error);
      res.status(500).json({ message: "Failed to leave room" });
    }
  });
  
  // Get current viewers
  app.get("/api/room/:passportCode/viewers", async (_req, res) => {
    try {
      const { passportCode } = req.params;
      
      const viewers = roomViewers.get(passportCode);
      if (!viewers || viewers.size === 0) {
        return res.json({ viewers: [] });
      }
      
      const viewerList = Array.from(viewers.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        joinedAt: data.joinedAt
      }));
      
      res.json({ viewers: viewerList });
    } catch (error) {
      console.error("Get viewers error:", error);
      res.status(500).json({ message: "Failed to get viewers" });
    }
  });
  
  // Heartbeat to keep viewer active
  app.post("/api/room/:passportCode/viewers/heartbeat", async (_req, res) => {
    try {
      const { passportCode } = req.params;
      const { viewerId } = req.body;
      
      if (!viewerId) {
        return res.status(400).json({ message: "viewerId required" });
      }
      
      const viewers = roomViewers.get(passportCode);
      if (viewers && viewers.has(viewerId)) {
        const viewer = viewers.get(viewerId)!;
        viewer.joinedAt = new Date(); // Update timestamp
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Heartbeat error:", error);
      res.status(500).json({ message: "Failed to update heartbeat" });
    }
  });
}