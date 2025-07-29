import { Router } from 'express';
import { AuthenticatedRequest } from '../types/api';
import { uuidStorage } from '../storage-uuid';
import { requireUnifiedAuth, requireTeacher } from '../middleware/unified-auth';
import { verifyStudentClassEditAccess, verifyClassAccess, verifyStudentClassAccess } from '../middleware/ownership-collaborator';
import { asyncWrapper } from '../utils/async-wrapper';
import { ValidationError, NotFoundError, BusinessError, InternalError, ErrorCode } from '../utils/errors';
import { createSecureLogger } from '../utils/secure-logger';

const logger = createSecureLogger('CurrencyRoutes');

const router = Router();

// Give coins to a student
router.post('/give', requireUnifiedAuth, requireTeacher, verifyStudentClassEditAccess, asyncWrapper(async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const teacherId = authReq.auth?.userId || authReq.user?.userId;
  const { studentId, amount, reason } = authReq.body;
  
  // Validate input
  if (!studentId || !amount || amount <= 0 || amount > 1000) {
    throw new ValidationError('Invalid amount (1-1000 coins)', ErrorCode.VAL_003);
  }
  
  // Get the student (ownership already verified by middleware)
  const student = await uuidStorage.getStudentById(studentId);
  if (!student) {
    throw new NotFoundError('Student', ErrorCode.RES_001);
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
}));

// Take coins from a student
router.post('/take', requireUnifiedAuth, requireTeacher, verifyStudentClassEditAccess, asyncWrapper(async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const teacherId = authReq.auth?.userId || authReq.user?.userId;
  const { studentId, amount, reason } = authReq.body;
  
  // Validate input
  if (!studentId || !amount || amount <= 0) {
    throw new ValidationError('Invalid amount', ErrorCode.VAL_003);
  }
  
  // Get the student (ownership already verified by middleware)
  const student = await uuidStorage.getStudentById(studentId);
  if (!student) {
    throw new NotFoundError('Student', ErrorCode.RES_001);
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
      throw new BusinessError('Student has insufficient funds', ErrorCode.BIZ_001);
    }
    throw innerError; // Re-throw other errors to be caught by error handler
  }
}));

// Get currency transactions for a class
router.get('/transactions/:classId', requireUnifiedAuth, requireTeacher, verifyClassAccess, asyncWrapper(async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const teacherId = authReq.auth?.userId || authReq.user?.userId;
  const classId = authReq.params.classId;
  
  // Get transactions for this class
  const transactions = await uuidStorage.getCurrencyTransactionsByClass(classId);
  
  res.json(transactions);
}));

// Get transaction history for a specific student
router.get('/history/:studentId', requireUnifiedAuth, requireTeacher, verifyStudentClassAccess, asyncWrapper(async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const teacherId = authReq.auth?.userId || authReq.user?.userId;
  const studentId = authReq.params.studentId;
  
  // Get transaction history for this student
  const transactions = await uuidStorage.getCurrencyTransactionsByStudent(studentId);
  
  res.json(transactions);
}));

export default router;