import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import discussionsRouter from './discussions.js';
import repliesRouter from './replies.js';
import tagsRouter from './tags.js';
import interactionsRouter from './interactions.js';
import { debugCommunityRequests } from './debug-middleware.js';

export const router = express.Router();

// Debug middleware (temporary)
router.use(debugCommunityRequests);

// All community routes require teacher authentication
router.use(requireAuth);

// Mount sub-routers
router.use('/discussions', discussionsRouter);
router.use('/replies', repliesRouter);
router.use('/tags', tagsRouter);
router.use('/interactions', interactionsRouter);

export default router;