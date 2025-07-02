import { Router } from 'express';
import { PaymentService } from '../services/PaymentService';
import { authenticateTeacher } from '../middleware/auth';
import { 
  CreateCheckoutSessionRequest, 
  MockWebhookRequest 
} from '../../shared/api-types/payment';

const router = Router();

/**
 * Create a checkout session for teacher payment
 * POST /api/payments/create-checkout-session
 */
router.post('/create-checkout-session', authenticateTeacher, async (req, res) => {
  try {
    const { classId, studentCount } = req.body as CreateCheckoutSessionRequest;
    const teacherId = req.user!.userId; // Changed from .id to .userId

    // Validate input
    if (!classId || !studentCount || studentCount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid class ID or student count'
      });
    }

    if (studentCount > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 students per class'
      });
    }

    // Create the checkout session
    const result = await PaymentService.createCheckoutSession(
      teacherId,
      classId,
      studentCount
    );

    return res.json({
      success: true,
      data: {
        sessionId: result.sessionId,
        mockCheckoutUrl: result.mockCheckoutUrl
      }
    });
  } catch (error: any) {
  console.error('Error creating checkout session:', error);
  
  // Handle specific, known errors from the service layer
  if (error.message === 'Class not found') {
  return res.status(404).json({ success: false, error: error.message });
  }
  if (error.message === 'Access denied - you do not own this class') {
  return res.status(403).json({ success: false, error: error.message });
  }
      if (error.message === 'This class has already been paid for') {
        return res.status(409).json({ success: false, error: error.message });
      }
      
      // For all other unexpected errors, return a generic 500
      return res.status(500).json({
        success: false,
        error: 'Failed to create checkout session due to an internal error'
      });
    }
});

/**
 * Mock webhook handler for payment processing
 * POST /api/payments/mock/webhook-handler
 * Note: In production, this would be an unauthenticated endpoint that verifies Stripe signatures
 */
router.post('/mock/webhook-handler', async (req, res) => {
  try {
    const { sessionId, status } = req.body as MockWebhookRequest;

    // Validate input
    if (!sessionId || !status || !['success', 'failure'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID or status'
      });
    }

    // In production, we would verify the webhook signature here
    // PaymentService.verifyWebhookSignature(req.body, req.headers['stripe-signature']);

    // Process the payment
    const result = await PaymentService.processMockWebhook(sessionId, status);

    return res.json({
      success: true,
      data: {
        redirectUrl: result.redirectUrl
      }
    });
  } catch (error: any) {
  console.error('Error processing webhook:', error);
  
  // Handle specific errors
  if (error.message === 'Payment session not found') {
    return res.status(404).json({ success: false, error: error.message });
    }
      if (error.message === 'Payment has already been processed') {
        return res.status(409).json({ success: false, error: error.message });
      }
      
      // For all other unexpected errors, return a generic 500
      return res.status(500).json({
        success: false,
        error: 'Failed to process payment due to an internal error'
      });
    }
});

/**
 * Get payment status
 * GET /api/payments/status/:sessionId
 */
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const status = await PaymentService.getPaymentStatus(sessionId);

    return res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
  console.error('Error getting payment status:', error);
  
  if (error.message === 'Payment not found') {
  return res.status(404).json({ success: false, error: error.message });
  }
    
      return res.status(500).json({
        success: false,
        error: 'Failed to get payment status due to an internal error'
      });
    }
});

export default router;
