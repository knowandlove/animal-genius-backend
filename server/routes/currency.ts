import { Router, Request, Response } from 'express';
import { uuidStorage } from '../storage-uuid';
import { requireAuth } from '../middleware/auth';
import { verifyStudentClassOwnership, verifyClassOwnership } from '../middleware/ownership';

const router = Router();

// Give coins to a student
router.post('/give', requireAuth, verifyStudentClassOwnership, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user.userId;
    const { studentId, amount, reason } = req.body;
    
    // Validate input
    if (!studentId || !amount || amount <= 0 || amount > 1000) {
      return res.status(400).json({ message: "Invalid amount (1-1000 coins)" });
    }
    
    // Get the student (ownership already verified by middleware)
    const student = await uuidStorage.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Use atomic update to prevent race conditions
    const { newBalance } = await uuidStorage.updateCurrencyAtomic({
      studentId,
      teacherId,
      amount,
      transactionType: 'teacher_gift',
      description: reason || 'Teacher bonus',
    });
    
    res.json({ 
      success: true, 
      newBalance,
      message: `Gave ${amount} coins to ${student.studentName || 'Student'}` 
    });
  } catch (error) {
    console.error("Give currency error:", error);
    res.status(500).json({ message: "Failed to give currency" });
  }
});

// Take coins from a student
router.post('/take', requireAuth, verifyStudentClassOwnership, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user.userId;
    const { studentId, amount, reason } = req.body;
    
    // Validate input
    if (!studentId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }
    
    // Get the student (ownership already verified by middleware)
    const student = await uuidStorage.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Use atomic update to prevent race conditions
    // The updateCurrencyAtomic method now handles balance checks atomically
    try {
      const { newBalance } = await uuidStorage.updateCurrencyAtomic({
        studentId,
        teacherId,
        amount: -amount,  // Negative amount for deduction
        transactionType: 'teacher_deduct',
        description: reason || 'Teacher adjustment',
      });
    
      res.json({ 
        success: true, 
        newBalance,
        message: `Took ${amount} coins from ${student.studentName || 'Student'}` 
      });
    } catch (innerError: any) {
      if (innerError.message === 'Insufficient funds') {
        return res.status(400).json({ message: "Student has insufficient funds" });
      }
      throw innerError; // Re-throw other errors to be caught by outer catch
    }
  } catch (error) {
    console.error("Take currency error:", error);
    res.status(500).json({ message: "Failed to take currency" });
  }
});

// Get currency transactions for a class
router.get('/transactions/:classId', requireAuth, verifyClassOwnership, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user.userId;
    const classId = req.params.classId;
    
    // Get transactions for this class
    const transactions = await uuidStorage.getCurrencyTransactionsByClass(classId);
    
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Failed to get transactions" });
  }
});

// Get transaction history for a specific student
router.get('/history/:studentId', requireAuth, verifyStudentClassOwnership, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user.userId;
    const studentId = req.params.studentId;
    
    // Get transaction history for this student
    const transactions = await uuidStorage.getCurrencyTransactionsByStudent(studentId);
    
    res.json(transactions);
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({ message: "Failed to get transaction history" });
  }
});

export default router;