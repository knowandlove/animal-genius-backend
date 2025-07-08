// WebSocket Authentication System
import { randomBytes } from 'crypto';

interface WebSocketTicket {
  token: string;
  userId?: string;
  gameId?: string;
  expiresAt: Date;
  used: boolean;
}

class WebSocketAuthManager {
  private tickets: Map<string, WebSocketTicket> = new Map();
  private readonly TICKET_EXPIRY_MS = 30 * 1000; // 30 seconds
  
  constructor() {
    // Clean up expired tickets every 15 minutes to reduce compute usage
    setInterval(() => {
      // Only run cleanup if there are tickets to clean
      if (this.tickets.size > 0) {
        this.cleanupExpiredTickets();
      }
    }, 15 * 60 * 1000);
  }
  
  /**
   * Generate a temporary WebSocket authentication ticket
   */
  generateTicket(userId?: string, gameId?: string): string {
    const token = randomBytes(32).toString('hex');
    const ticket: WebSocketTicket = {
      token,
      userId,
      gameId,
      expiresAt: new Date(Date.now() + this.TICKET_EXPIRY_MS),
      used: false
    };
    
    this.tickets.set(token, ticket);
    return token;
  }
  
  /**
   * Validate and consume a WebSocket ticket
   */
  validateTicket(token: string): { valid: boolean; userId?: string; gameId?: string } {
    const ticket = this.tickets.get(token);
    
    if (!ticket) {
      return { valid: false };
    }
    
    if (ticket.expiresAt < new Date()) {
      this.tickets.delete(token);
      return { valid: false };
    }
    
    // For development, allow ticket reuse within validity period
    // In production, you might want stricter one-time use
    if (process.env.NODE_ENV === 'production' && ticket.used) {
      return { valid: false };
    }
    
    // Mark ticket as used (but allow reuse in development)
    ticket.used = true;
    
    return {
      valid: true,
      userId: ticket.userId,
      gameId: ticket.gameId
    };
  }
  
  /**
   * Clean up expired tickets
   */
  private cleanupExpiredTickets(): void {
    const now = new Date();
    for (const [token, ticket] of this.tickets.entries()) {
      if (ticket.expiresAt < now) {
        this.tickets.delete(token);
      }
    }
  }
  
  /**
   * Get statistics about active tickets
   */
  getStats(): { total: number; expired: number; used: number } {
    const now = new Date();
    let expired = 0;
    let used = 0;
    
    for (const ticket of this.tickets.values()) {
      if (ticket.expiresAt < now) expired++;
      if (ticket.used) used++;
    }
    
    return {
      total: this.tickets.size,
      expired,
      used
    };
  }
}

export const wsAuthManager = new WebSocketAuthManager();