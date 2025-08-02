import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/api';
import { requireAuth } from '../middleware/auth';
import { pairingQueue } from '../queues/pairing-queue';

const router = Router();

// Check job status
router.get('/:jobId/status', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { jobId } = authReq.params;
    
    const job = await pairingQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    // Handle both Bull jobs and our in-memory jobs
    const state = (job as any).getState ? await (job as any).getState() : (job as any).status;
    const progress = (job as any).progress ? (typeof (job as any).progress === 'function' ? (job as any).progress() : (job as any).progress) : 0;
    
    res.json({
      id: job.id,
      state,
      progress,
      data: job.data,
      result: (job as any).returnvalue || (job as any).result,
      failedReason: (job as any).failedReason || (job as any).error,
      finishedOn: (job as any).finishedOn,
      processedOn: (job as any).processedOn
    });
  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({ message: 'Failed to get job status' });
  }
});

// Get job result
router.get('/:jobId/result', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { jobId } = authReq.params;
    
    const job = await pairingQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    
    const state = (job as any).getState ? await (job as any).getState() : (job as any).status;
    
    if (state === 'completed') {
      return res.json((job as any).returnvalue || (job as any).result);
    } else if (state === 'failed') {
      return res.status(500).json({ 
        message: 'Job failed', 
        error: (job as any).failedReason || (job as any).error 
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