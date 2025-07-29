import Bull from 'bull';
import { generatePairings, generateClassInsights } from '../services/pairingService';
import { uuidStorage } from '../storage-uuid';

// Simple in-memory cache for development (replace with Redis in production)
const memoryCache = new Map<string, any>();

// Create queue with Redis connection from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// For development without Redis, we'll use a simple worker pattern
let pairingQueue: any;

if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
  console.log('⚠️  Running without Redis - using in-memory worker for development');
  
  // Simple in-memory queue for development
  pairingQueue = {
    jobs: new Map(),
    nextJobId: 1,
    
    async add(jobName: string, data: any) {
      const jobId = this.nextJobId++;
      const job = {
        id: jobId,
        name: jobName,
        data,
        status: 'waiting',
        result: null as any,
        error: null as any
      };
      
      this.jobs.set(jobId, job);
      
      // Process asynchronously
      setTimeout(async () => {
        console.log(`[Queue] Starting job ${jobId} for ${jobName}`);
        job.status = 'active';
        try {
          if (jobName === 'generate-pairings') {
            const { classId } = data;
            console.log(`[Queue] Fetching analytics for class ${classId}`);
            const allSubmissions = await uuidStorage.getClassAnalytics(classId);
            
            console.log(`[Queue] Got ${allSubmissions?.length || 0} submissions`);
            
            if (!allSubmissions || allSubmissions.length === 0) {
              job.result = { dynamicDuos: [], puzzlePairings: [], soloWorkers: [] };
              console.log('[Queue] No submissions, returning empty result');
            } else {
              console.log('[Queue] Generating pairings...');
              job.result = generatePairings(allSubmissions);
              console.log('[Queue] Pairings generated successfully');
            }
            
            // Store in memory cache with expiration
            memoryCache.set(`pairings:${classId}`, job.result);
            console.log(`[Queue] Cached result for class ${classId}`);
            
            // Clean up cache after 1 hour
            setTimeout(() => {
              memoryCache.delete(`pairings:${classId}`);
            }, 3600000);
            
            job.status = 'completed';
            console.log(`[Queue] Job ${jobId} completed successfully`);
          }
        } catch (error) {
          console.error(`[Queue] Job ${jobId} failed:`, error);
          job.error = error;
          job.status = 'failed';
        } finally {
          // CRITICAL: Clean up job after processing to prevent memory leak
          setTimeout(() => {
            this.jobs.delete(jobId);
          }, 60000); // Keep completed/failed jobs for 1 minute for debugging
        }
      }, 0);
      
      return job;
    },
    
    async getJob(jobId: number) {
      return this.jobs.get(jobId);
    },
    
    async getJobs(states: string[]) {
      return Array.from(this.jobs.values()).filter((job: any) => states.includes(job.status));
    },
    
    client: {
      get: async (key: string) => memoryCache.get(key) ? JSON.stringify(memoryCache.get(key)) : null,
      setex: async (key: string, ttl: number, value: string) => memoryCache.set(key, JSON.parse(value))
    }
  };
} else {
  // Production queue with Redis
  pairingQueue = new Bull('pairing-generation', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

  // Process pairing jobs
  pairingQueue.process('generate-pairings', async (job: Bull.Job) => {
  const { classId } = job.data;
  
  console.log(`[Pairing Queue] Starting pairing generation for class ${classId}`);
  
  try {
    // Get all submissions for the class using getClassAnalytics for properly formatted data
    const allSubmissions = await uuidStorage.getClassAnalytics(classId);
    
    if (!allSubmissions || allSubmissions.length === 0) {
      return {
        dynamicDuos: [],
        puzzlePairings: [],
        soloWorkers: []
      };
    }
    
    // Generate pairings (this is the CPU-intensive part)
    const pairings = generatePairings(allSubmissions);
    
    // Store result in Redis with 1 hour TTL
    const cacheKey = `pairings:${classId}`;
    await job.queue.client.setex(cacheKey, 3600, JSON.stringify(pairings));
    
    console.log(`[Pairing Queue] Completed pairing generation for class ${classId}`);
    
    return pairings;
  } catch (error) {
    console.error(`[Pairing Queue] Error generating pairings for class ${classId}:`, error);
    throw error;
  }
});

// Process insights jobs
pairingQueue.process('generate-insights', async (job: Bull.Job) => {
  const { classId } = job.data;
  
  console.log(`[Pairing Queue] Starting insights generation for class ${classId}`);
  
  try {
    const allSubmissions = await uuidStorage.getClassAnalytics(classId);
    
    if (!allSubmissions || allSubmissions.length === 0) {
      return null;
    }
    
    const insights = generateClassInsights(allSubmissions);
    
    // Store result in Redis with 1 hour TTL
    const cacheKey = `insights:${classId}`;
    await job.queue.client.setex(cacheKey, 3600, JSON.stringify(insights));
    
    console.log(`[Pairing Queue] Completed insights generation for class ${classId}`);
    
    return insights;
  } catch (error) {
    console.error(`[Pairing Queue] Error generating insights for class ${classId}:`, error);
    throw error;
  }
});

  // Queue event handlers
  pairingQueue.on('completed', (job: Bull.Job, _result: any) => {
    console.log(`[Pairing Queue] Job ${job.id} completed successfully`);
  });

  pairingQueue.on('failed', (job: Bull.Job, err: Error) => {
    console.error(`[Pairing Queue] Job ${job.id} failed:`, err.message);
  });
}

export { pairingQueue };

// Helper to get pairing results
export async function getPairingResults(classId: string) {
  const cacheKey = `pairings:${classId}`;
  const cached = await pairingQueue.client.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Check if job is already running
  const jobs = await pairingQueue.getJobs(['active', 'waiting', 'delayed']);
  const existingJob = jobs.find((job: any) => 
    job.name === 'generate-pairings' && job.data.classId === classId
  );
  
  if (existingJob) {
    return {
      status: 'processing',
      jobId: existingJob.id
    };
  }
  
  // No cached result and no job running
  return null;
}

// Helper to get insights results
export async function getInsightsResults(classId: string) {
  const cacheKey = `insights:${classId}`;
  const cached = await pairingQueue.client.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  return null;
}