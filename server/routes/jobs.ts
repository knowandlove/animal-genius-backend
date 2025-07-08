import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { pairingQueue } from '../queues/pairing-queue';

const router = Router();

// Check job status
router.get('/:jobId/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const job = await pairingQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Handle both Bull jobs and our in-memory jobs
    const state = job.getState ? await job.getState() : job.status;
    const progress = job.progress ? job.progress() : 0;
    
    res.json({
      id: job.id,
      state,
      progress,
      data: job.data,
      result: job.returnvalue || job.result,
      failedReason: job.failedReason || job.error,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn
    });
  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({ message: 'Failed to get job status' });
  }
});

// Get job result
router.get('/:jobId/result', requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const job = await pairingQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    const state = job.getState ? await job.getState() : job.status;
    
    if (state === 'completed') {
      return res.json(job.returnvalue || job.result);
    } else if (state === 'failed') {
      return res.status(500).json({ 
        message: 'Job failed', 
        error: job.failedReason || job.error 
      });
    } else {
      return res.status(202).json({ 
        status: state,
        message: `Job is ${state}. Please check back later.`
      });
    }
  } catch (error) {
    console.error('Get job result error:', error);
    res.status(500).json({ message: 'Failed to get job result' });
  }
});

export default router;