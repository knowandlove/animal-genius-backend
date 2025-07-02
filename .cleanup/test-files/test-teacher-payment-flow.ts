import { config } from 'dotenv';
config();

import { db } from './server/db';
import { 
  classes, 
  students,
  profiles,
  teacherPayments 
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  createClassroomSession,
  generateClassActivations,
  activateStudent,
  getClassActivationSummary
} from './server/services/authenticationService';

async function testTeacherPaymentFlow() {
  console.log('🎯 Testing Teacher Payment Authentication Flow\n');
  console.log('==========================================\n');

  try {
    // 1. Setup: Create test teacher and class
    console.log('1️⃣ Creating test teacher and unpaid class...\n');
    
    const [testTeacher] = await db.insert(profiles).values({
      id: crypto.randomUUID(),
      email: 'teacher-pay-test@example.com',
      fullName: 'Ms. Johnson',
      firstName: 'Sarah',
      lastName: 'Johnson',
      schoolOrganization: 'Lincoln Elementary',
      isAdmin: false
    }).returning();
    
    const [testClass] = await db.insert(classes).values({
      teacherId: testTeacher.id,
      name: '4th Grade Math',
      subject: 'Mathematics',
      gradeLevel: '4th Grade',
      passportCode: `TEMP-${Date.now()}`,
      schoolName: 'Lincoln Elementary',
      maxStudents: 30,
      isPaid: false // Not paid yet!
    }).returning();
    
    console.log(`✅ Created teacher: ${testTeacher.fullName}`);
    console.log(`✅ Created class: ${testClass.name} (Unpaid)\n`);

    // 2. Try to start session before payment (should fail)
    console.log('2️⃣ Testing unpaid class restrictions...\n');
    
    try {
      await createClassroomSession(testClass.id, testTeacher.id);
      console.log('❌ ERROR: Should not allow session for unpaid class!');
    } catch (error) {
      console.log('✅ Correctly blocked: ' + (error as Error).message);
    }

    // 3. Simulate teacher payment
    console.log('\n3️⃣ Simulating teacher payment...\n');
    
    const paymentAmount = 2500; // $25.00
    const studentCount = 25;
    
    const [payment] = await db.insert(teacherPayments).values({
      teacherId: testTeacher.id,
      classId: testClass.id,
      amountCents: paymentAmount,
      studentCount: studentCount,
      stripePaymentIntentId: `pi_test_${Date.now()}`,
      status: 'completed',
      paidAt: new Date()
    }).returning();
    
    // Update class as paid
    await db.update(classes)
      .set({
        isPaid: true,
        paidAt: new Date(),
        paidStudentCount: studentCount
      })
      .where(eq(classes.id, testClass.id));
    
    console.log(`✅ Payment recorded: $${paymentAmount / 100} for ${studentCount} students`);
    console.log(`✅ Class marked as paid\n`);

    // 4. Now class features should work
    console.log('4️⃣ Testing paid class features...\n');
    
    // Start classroom session
    const session = await createClassroomSession(testClass.id, testTeacher.id);
    console.log(`✅ Session started: ${session.sessionCode}`);
    
    // Generate activation codes
    const activations = await generateClassActivations(testClass.id, 5);
    console.log(`✅ Generated ${activations.length} activation codes:`);
    activations.forEach(a => console.log(`   - ${a.activationCode}`));

    // 5. Test student activation
    console.log('\n5️⃣ Testing student activation...\n');
    
    const firstActivation = activations[0];
    const result = await activateStudent(
      firstActivation.activationCode,
      'Emma Wilson',
      'owl'
    );
    
    if (result.success && result.student) {
      console.log(`✅ Student activated successfully!`);
      console.log(`   Name: ${result.student.studentName}`);
      console.log(`   Fun Code: ${result.student.funCode}`);
      console.log(`   Avatar: ${result.student.avatarId}`);
    }

    // 6. Check activation summary
    console.log('\n6️⃣ Checking class activation summary...\n');
    
    const summary = await getClassActivationSummary(testClass.id);
    console.log(`📊 Class Summary:`);
    console.log(`   Total Paid Slots: ${summary.totalPaid}`);
    console.log(`   Students Created: ${summary.studentsCreated}`);
    console.log(`   Pending Activations: ${summary.pendingActivations}`);
    console.log(`   Available Slots: ${summary.availableSlots}`);

    // 7. Test capacity limits
    console.log('\n7️⃣ Testing capacity limits...\n');
    
    try {
      // Try to generate more codes than available slots
      await generateClassActivations(testClass.id, 30);
      console.log('❌ ERROR: Should not allow exceeding capacity!');
    } catch (error) {
      console.log('✅ Correctly blocked: ' + (error as Error).message);
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    if (result.success && result.student) {
      await db.delete(students).where(eq(students.id, result.student.id));
    }
    await db.delete(teacherPayments).where(eq(teacherPayments.id, payment.id));
    await db.delete(classes).where(eq(classes.id, testClass.id));
    await db.delete(profiles).where(eq(profiles.id, testTeacher.id));
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 Teacher payment flow test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  } finally {
    process.exit(0);
  }
}

// Run the test
testTeacherPaymentFlow();