import { db } from './server/db.js';
import { typeLookup } from './server/services/typeLookupService.js';
import { uuidStorage } from './server/storage-uuid.js';
import { sql } from 'drizzle-orm';

async function testQuizSubmission() {
  try {
    console.log('🔄 Testing quiz submission with meerkat...');
    
    // First, ensure type lookup is initialized
    if (!typeLookup.isInitialized()) {
      await typeLookup.initialize();
    }
    
    // Check if meerkat exists
    const meerkatId = typeLookup.getAnimalTypeId('meerkat');
    console.log('Meerkat ID:', meerkatId);
    
    if (!meerkatId) {
      console.error('❌ Meerkat type not found in database!');
      const allAnimals = typeLookup.getAllAnimalTypes();
      console.log('Available animals:', allAnimals);
      return;
    }
    
    // Get a test class
    const classResult = await db.execute(sql`SELECT id FROM classes LIMIT 1`);
    if (classResult.rows.length === 0) {
      console.error('❌ No classes found in database!');
      return;
    }
    const classId = classResult.rows[0].id;
    console.log('Using class ID:', classId);
    
    // Test creating a student with meerkat type
    console.log('\n📝 Creating student...');
    const student = await uuidStorage.upsertStudent({
      classId: classId,
      studentName: 'Test Meerkat Student',
      gradeLevel: '6th',
      personalityType: 'INTJ',
      animalType: 'meerkat',
      animalGenius: 'creative',
      learningStyle: 'visual'
    });
    
    console.log('✅ Student created:', {
      id: student.id,
      name: student.studentName,
      animalTypeId: student.animalTypeId,
      geniusTypeId: student.geniusTypeId,
      passportCode: student.passportCode
    });
    
    // Test submitting a quiz
    console.log('\n📝 Submitting quiz...');
    const submission = await uuidStorage.submitQuizAndAwardCoins(
      {
        studentId: student.id,
        animalType: 'meerkat',
        geniusType: 'creative',
        answers: {
          personalityType: 'INTJ',
          learningStyle: 'visual',
          scores: { E: 10, I: 40, S: 20, N: 30, T: 35, F: 15, J: 40, P: 10 },
          learningScores: { visual: 8, auditory: 2, kinesthetic: 3, readingWriting: 5 }
        },
        coinsEarned: 50
      },
      {
        studentId: student.id,
        teacherId: classResult.rows[0].teacher_id || null,
        amount: 50,
        transactionType: 'quiz_complete',
        description: 'Quiz completion reward'
      }
    );
    
    console.log('✅ Quiz submitted:', {
      id: submission.id,
      studentId: submission.studentId,
      animalTypeId: submission.animalTypeId,
      geniusTypeId: submission.geniusTypeId,
      coinsEarned: submission.coinsEarned
    });
    
    // Check balance
    const balance = await uuidStorage.getStudentBalance(student.id);
    console.log('💰 Student balance:', balance);
    
    // Get submissions with type codes
    console.log('\n📋 Getting submissions with type codes...');
    const submissions = await uuidStorage.getSubmissionsWithTypeCodes(student.id);
    console.log('Submissions:', submissions.map(s => ({
      id: s.id,
      animalType: s.animalType,
      geniusType: s.geniusType,
      completedAt: s.completedAt
    })));
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

testQuizSubmission();
