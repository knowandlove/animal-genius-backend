/**
 * Centralized resource cleanup manager
 * Ensures all resources are properly cleaned up on shutdown
 */

import { createSecureLogger } from '../utils/secure-logger';

const _logger = createSecureLogger('ResourceCleanup');

export interface CleanupHandler {
  name: string;
  priority: number; // Lower numbers run first
  handler: () => Promise<void> | void;
  timeout?: number; // Override timeout for this handler
}

class ResourceCleanupManager {
  private handlers: CleanupHandler[] = [];
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  private intervalHandles: Set<NodeJS.Timeout> = new Set();
  private timeoutHandles: Set<NodeJS.Timeout> = new Set();

  /**
   * Register a cleanup handler
   */
  register(handler: CleanupHandler): void {
    if (this.isShuttingDown) {
      logger.warn(`Cannot register handler ${handler.name} during shutdown`);
      return;
    }

    // Check for duplicate names
    const existing = this.handlers.find(h => h.name === handler.name);
    if (existing) {
      logger.warn(`Replacing existing cleanup handler: ${handler.name}`);
      this.handlers = this.handlers.filter(h => h.name !== handler.name);
    }

    this.handlers.push(handler);
    this.handlers.sort((a, b) => a.priority - b.priority);
    logger.log(`Registered cleanup handler: ${handler.name} (priority ${handler.priority})`);
  }

  /**
   * Unregister a cleanup handler
   */
  unregister(name: string): void {
    this.handlers = this.handlers.filter(h => h.name !== name);
    logger.log(`Unregistered cleanup handler: ${name}`);
  }

  /**
   * Track an interval for cleanup
   */
  trackInterval(handle: NodeJS.Timeout): void {
    this.intervalHandles.add(handle);
  }

  /**
   * Track a timeout for cleanup
   */
  trackTimeout(handle: NodeJS.Timeout): void {
    this.timeoutHandles.add(handle);
  }

  /**
   * Untrack a timeout (when it completes naturally)
   */
  untrackTimeout(handle: NodeJS.Timeout): void {
    this.timeoutHandles.delete(handle);
  }

  /**
   * Execute all cleanup handlers
   */
  async cleanup(gracePeriodMs: number = 10000): Promise<void> {
    if (this.isShuttingDown) {
      logger.log('Already shutting down, waiting for completion...');
      return this.shutdownPromise!;
    }

    this.isShuttingDown = true;
    logger.log(`Starting cleanup with ${this.handlers.length} handlers...`);

    this.shutdownPromise = this.executeCleanup(gracePeriodMs);
    return this.shutdownPromise;
  }

  private async executeCleanup(gracePeriodMs: number): Promise<void> {
    const startTime = Date.now();

    // Clear all intervals and timeouts first
    logger.log(`Clearing ${this.intervalHandles.size} intervals and ${this.timeoutHandles.size} timeouts`);
    
    for (const interval of this.intervalHandles) {
      clearInterval(interval);
    }
    this.intervalHandles.clear();

    for (const timeout of this.timeoutHandles) {
      clearTimeout(timeout);
    }
    this.timeoutHandles.clear();

    // Execute cleanup handlers in priority order
    for (const handler of this.handlers) {
      const handlerTimeout = handler.timeout || 5000;
      const timeRemaining = gracePeriodMs - (Date.now() - startTime);

      if (timeRemaining <= 0) {
        logger.error(`Cleanup timeout reached, skipping remaining handlers`);
        break;
      }

      try {
        logger.log(`Running cleanup handler: ${handler.name}`);
        
        // Run handler with timeout
        await Promise.race([
          Promise.resolve(handler.handler()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Handler timeout')), 
            Math.min(handlerTimeout, timeRemaining))
          )
        ]);

        logger.log(`✓ Completed cleanup handler: ${handler.name}`);
      } catch (error) {
        logger.error(`✗ Failed cleanup handler ${handler.name}:`, error);
      }
    }

    const totalTime = Date.now() - startTime;
    logger.log(`Cleanup completed in ${totalTime}ms`);
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }
}

// Create singleton instance
export const cleanupManager = new ResourceCleanupManager();

// Helper function to create safe intervals that are automatically cleaned up
export function createManagedInterval(
  callback: () => void,
  delay: number,
  name?: string
): NodeJS.Timeout {
  const handle = setInterval(callback, delay);
  cleanupManager.trackInterval(handle);
  
  if (name) {
    logger.log(`Created managed interval: ${name} (${delay}ms)`);
  }
  
  return handle;
}

// Helper function to create safe timeouts that are automatically cleaned up
export function createManagedTimeout(
  callback: () => void,
  delay: number,
  name?: string
): NodeJS.Timeout {
  const handle = setTimeout(() => {
    cleanupManager.untrackTimeout(handle);
    callback();
  }, delay);
  
  cleanupManager.trackTimeout(handle);
  
  if (name) {
    logger.log(`Created managed timeout: ${name} (${delay}ms)`);
  }
  
  return handle;
}

// Register core process handlers
let processHandlersRegistered = false;

export function registerProcessHandlers(): void {
  if (processHandlersRegistered) {
    return;
  }
  processHandlersRegistered = true;

  const handleShutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      await cleanupManager.cleanup();
      logger.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    handleShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    // Better error logging for unhandled rejections
    console.error('Unhandled rejection details:');
    console.error('Reason:', reason);
    console.error('Reason type:', typeof reason);
    if (reason instanceof Error) {
      console.error('Error message:', reason.message);
      console.error('Error stack:', reason.stack);
    } else if (typeof reason === 'object' && reason !== null) {
      try {
        console.error('Reason object:', JSON.stringify(reason, null, 2));
      } catch (e) {
        console.error('Reason object (cannot stringify):', Object.keys(reason));
      }
    }
    console.error('Promise:', promise);
    
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    handleShutdown('unhandledRejection');
  });

  logger.log('Process shutdown handlers registered');
}