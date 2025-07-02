import { db } from "../db";
import { quizSubmissions } from "@shared/schema";
import { eq, and, lte, isNull } from "drizzle-orm";

/**
 * Simple async task manager for quiz processing
 * Provides basic retry and recovery without external dependencies
 */
export class AsyncTaskManager {
  private static instance: AsyncTaskManager;
  private retryQueue = new Map<string, { attempts: number; lastAttempt: Date }>();
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 5000; // 5 seconds
  
  static getInstance(): AsyncTaskManager {
    if (!AsyncTaskManager.instance) {
      AsyncTaskManager.instance = new AsyncTaskManager();
    }
    return AsyncTaskManager.instance;
  }
  
  /**
   * Execute a task with automatic retry on failure
   */
  async executeWithRetry<T>(
    taskId: string,
    taskName: string,
    task: () => Promise<T>
  ): Promise<T | null> {
    const retryInfo = this.retryQueue.get(taskId) || { attempts: 0, lastAttempt: new Date(0) };
    
    try {
      console.log(`🔄 Executing ${taskName} (attempt ${retryInfo.attempts + 1})`);
      const result = await task();
      
      // Success - remove from retry queue
      this.retryQueue.delete(taskId);
      console.log(`✅ ${taskName} completed successfully`);
      
      return result;
    } catch (error) {
      retryInfo.attempts++;
      retryInfo.lastAttempt = new Date();
      this.retryQueue.set(taskId, retryInfo);
      
      console.error(`❌ ${taskName} failed (attempt ${retryInfo.attempts}):`, error);
      
      if (retryInfo.attempts < this.maxRetries) {
        // Schedule retry
        setTimeout(() => {
          this.executeWithRetry(taskId, taskName, task);
        }, this.retryDelayMs * retryInfo.attempts); // Exponential backoff
        
        console.log(`🔄 Scheduled retry for ${taskName} in ${this.retryDelayMs * retryInfo.attempts}ms`);
      } else {
        console.error(`💀 ${taskName} failed after ${this.maxRetries} attempts. Giving up.`);
        this.retryQueue.delete(taskId);
      }
      
      return null;
    }
  }
  
  /**
   * Recovery process for stuck quiz submissions
   * Run this periodically (e.g., every 5 minutes)
   */
  async recoverStuckSubmissions(): Promise<void> {
    console.log("🔍 Checking for stuck quiz submissions...");
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    // Find submissions that don't have a student ID after 5 minutes
    const stuckSubmissions = await db
      .select()
      .from(quizSubmissions)
      .where(
        and(
          isNull(quizSubmissions.studentId),
          lte(quizSubmissions.createdAt, fiveMinutesAgo)
        )
      )
      .limit(10); // Process in batches
    
    if (stuckSubmissions.length === 0) {
      console.log("✅ No stuck submissions found");
      return;
    }
    
    console.log(`⚠️ Found ${stuckSubmissions.length} stuck submissions`);
    
    for (const submission of stuckSubmissions) {
      // Import the processing function to avoid circular dependencies
      const { processQuizRewards } = await import("./quizSubmissionService");
      
      await this.executeWithRetry(
        `quiz-recovery-${submission.id}`,
        `Quiz recovery for ${submission.studentName}`,
        async () => {
          // Generate passport code from animal type
          const animalTypeCode = await this.getAnimalTypeCode(submission.animalTypeId);
          const passportCode = this.generateRecoveryPassportCode(animalTypeCode);
          
          await processQuizRewards(
            submission.id,
            submission,
            passportCode,
            submission.animalTypeId,
            submission.geniusTypeId
          );
        }
      );
    }
  }
  
  /**
   * Get animal type code for recovery
   */
  private async getAnimalTypeCode(animalTypeId: string): Promise<string> {
    const { typeLookup } = await import("./typeLookupService");
    return typeLookup.getAnimalTypeCode(animalTypeId) || 'unknown';
  }
  
  /**
   * Generate a passport code for recovery purposes
   */
  private generateRecoveryPassportCode(animalCode: string): string {
    const { generatePassportCode } = require("@shared/currency-types");
    return generatePassportCode(animalCode);
  }
  
  /**
   * Get status of retry queue
   */
  getStatus() {
    return {
      queueSize: this.retryQueue.size,
      tasks: Array.from(this.retryQueue.entries()).map(([id, info]) => ({
        id,
        attempts: info.attempts,
        lastAttempt: info.lastAttempt
      }))
    };
  }
}

export const asyncTaskManager = AsyncTaskManager.getInstance();

// Run recovery every 5 minutes
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    asyncTaskManager.recoverStuckSubmissions().catch(error => {
      console.error("Recovery process error:", error);
    });
  }, 5 * 60 * 1000);
}
