import { db } from '../db';
import { teacherPayments, classes } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export class PaymentService {
  private static PRICE_PER_STUDENT_CENTS = 200; // $2.00 per student

  /**
   * Creates a pending payment session for a teacher
   */
  static async createCheckoutSession(teacherId: string, classId: string, studentCount: number) {
    try {
      console.log('PaymentService - Creating checkout session:', {
        teacherId,
        classId,
        studentCount
      });
      
      // Verify the teacher owns this class
      const classroom = await db.query.classes.findFirst({
        where: and(
          eq(classes.id, classId),
          eq(classes.teacherId, teacherId)
        )
      });

      console.log('PaymentService - Class lookup result:', classroom ? 'Found' : 'Not found');
      
      if (!classroom) {
        // Let's also check if the class exists at all
        const classExists = await db.query.classes.findFirst({
          where: eq(classes.id, classId)
        });
        
        if (!classExists) {
          console.error(`Class ${classId} does not exist`);
          throw new Error('Class not found');
        } else {
          console.error(`Teacher ${teacherId} does not own class ${classId}. Owner is ${classExists.teacherId}`);
          throw new Error('Access denied - you do not own this class');
        }
      }

      // Check if class is already paid
      if (classroom.paymentStatus === 'succeeded') {
        throw new Error('This class has already been paid for');
      }

      // Calculate amount
      const amountCents = studentCount * this.PRICE_PER_STUDENT_CENTS;

      // Create a pending payment record
      const [payment] = await db.insert(teacherPayments)
        .values({
          teacherId,
          classId,
          amountCents,
          studentCount,
          status: 'pending',
          // In production, this would come from Stripe
          stripePaymentIntentId: `mock_pi_${randomUUID()}`,
        })
        .returning();

      // Generate mock checkout URL
      const mockCheckoutUrl = `/payment/mock?session_id=${payment.id}`;

      return {
        sessionId: payment.id,
        mockCheckoutUrl,
        payment
      };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Handles the mock webhook to process payment (simulates Stripe webhook)
   */
  static async processMockWebhook(sessionId: string, status: 'success' | 'failure') {
    try {
      // Start a transaction to ensure data consistency
      return await db.transaction(async (tx) => {
        // Get the payment record
        const payment = await tx.query.teacherPayments.findFirst({
          where: eq(teacherPayments.id, sessionId),
          with: {
            class: true
          }
        });

        if (!payment) {
          throw new Error('Payment session not found');
        }

        if (payment.status !== 'pending') {
          throw new Error('Payment has already been processed');
        }

        if (status === 'success') {
          const now = new Date();
          
          // Update payment record
          await tx.update(teacherPayments)
            .set({
              status: 'completed',
              paidAt: now,
              updatedAt: now
            })
            .where(eq(teacherPayments.id, sessionId));

          // Update class to paid status
          await tx.update(classes)
            .set({
              paymentStatus: 'succeeded',
              paidAt: now,
              paidStudentCount: payment.studentCount,
              updatedAt: now
            })
            .where(eq(classes.id, payment.classId));

          return {
            success: true,
            redirectUrl: `/teacher/classes/${payment.classId}/payment-success`
          };
        } else {
          // Handle failed payment
          await tx.update(teacherPayments)
            .set({
              status: 'failed',
              updatedAt: new Date()
            })
            .where(eq(teacherPayments.id, sessionId));

          await tx.update(classes)
            .set({
              paymentStatus: 'failed',
              updatedAt: new Date()
            })
            .where(eq(classes.id, payment.classId));

          return {
            success: false,
            redirectUrl: `/teacher/classes/${payment.classId}/payment-failed`
          };
        }
      });
    } catch (error) {
      console.error('Error processing mock webhook:', error);
      throw error;
    }
  }

  /**
   * Gets payment status for a session
   */
  static async getPaymentStatus(sessionId: string) {
    try {
      const payment = await db.query.teacherPayments.findFirst({
        where: eq(teacherPayments.id, sessionId),
        with: {
          class: true
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!payment.class) {
        // This indicates a data integrity issue
        console.error(`Data integrity issue: Payment ${sessionId} is missing its associated class.`);
        throw new Error('Associated class data for this payment is missing.');
      }

      return {
        paymentId: payment.id,
        status: payment.status as 'pending' | 'completed' | 'failed',
        classId: payment.classId,
        className: payment.class.name,
        studentCount: payment.studentCount,
        amountCents: payment.amountCents,
        paidAt: payment.paidAt?.toISOString()
      };
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw error;
    }
  }

  /**
   * Placeholder for future Stripe webhook verification
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    // TODO: In production, verify the Stripe webhook signature here
    // const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('Mock webhook verification - always returns true');
    return true;
  }
}
