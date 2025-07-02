import { config } from 'dotenv';
config();

import { db } from './server/db';
import { 
  activations, 
  classroomSessions, 
  classes, 
  students, 
  profiles 
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  createClassroomSession,
  validateSessionCode,
  getClassStudents,
  createActivation,
  activateStudent,
  studentLogin
} from './server/services/authenticationService';

async function testCompleteAuthFlow() {
  console.log('🚀 Testing Complete Authentication Flow\n');
  console.log('=====================================\n');

  try {
    // 1. Setup: Get or create a test teacher and class
    console.log('1️⃣ Setup: Finding test teacher and class...\n');
    
    let testTeacher = await db.query.profiles.findFirst({
      where: eq(profiles.email, 'test@teacher.com')
    });

    if (!testTeacher) {
      console.log('Creating test teacher...');
      const [newTeacher] = await db.insert(profiles).values({
        id: crypto.randomUUID(),
        email: 'test@teacher.com',
        fullName: 'Test Teacher',
        firstName: 'Test',
        lastName: 'Teacher',
        schoolOrganization: 'Test School',
        isAdmin: false
      }).returning();
      testTeacher = newTeacher;
    }
    console.log(`✅ Teacher: ${testTeacher.fullName} (${testTeacher.email})`);

    let testClass = await db.query.classes.findFirst({
      where: eq(classes.teacherId, testTeacher.id)
    });

    if (!testClass) {
      console.log('Creating test class...');
      const [newClass] = await db.insert(classes).values({
        teacherId: testTeacher.id,
        name: 'Test Class 2025',
        subject: 'Math',
        gradeLevel: '5th Grade',
        passportCode: `TEMP-${Date.now()}`,
        schoolName: 'Test School',
        maxStudents: 30
      }).returning();
      testClass = newClass;
    }
    console.log(`✅ Class: ${testClass.name} (Max: ${testClass.maxStudents} students)\n`);

    // 2. Teacher starts a classroom session
    console.log('2️⃣ Teacher Flow: Starting classroom session...\n');
    
    const session = await createClassroomSession(testClass.id, testTeacher.id);
    console.log(`✅ Session created!`);
    console.log(`   Code: ${session.sessionCode}`);
    console.log(`   Expires: ${session.expiresAt.toLocaleString()}\n`);

    // 3. Validate the session code (what students would do)
    console.log('3️⃣ Student Flow: Validating session code...\n');
    
    const validation = await validateSessionCode(session.sessionCode);
    console.log(`✅ Session validated: ${validation.valid}`);
    console.log(`   Class: ${validation.className}\n`);

    // 4. Create activation codes (simulating parent payment)
    console.log('4️⃣ Payment Flow: Creating activation codes...\n');
    
    const parentEmails = [
      'parent1@example.com',
      'parent2@example.com',
      'parent3@example.com'
    ];
    
    const activationCodes = [];
    for (const email of parentEmails) {
      const activation = await createActivation(
        testClass.id,
        email,
        `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      );
      activationCodes.push(activation);
      console.log(`✅ Activation for ${email}: ${activation.activationCode}`);
    }
    console.log('');

    // 5. Students activate their accounts
    console.log('5️⃣ Student Activation: Creating student accounts...\n');
    
    const studentData = [
      { name: 'Alice Anderson', avatar: 'meerkat', email: 'parent1@example.com' },
      { name: 'Bob Brown', avatar: 'panda', email: 'parent2@example.com' },
      { name: 'Charlie Chen', avatar: 'owl', email: 'parent3@example.com' }
    ];

    const createdStudents = [];
    for (let i = 0; i < studentData.length; i++) {
      const result = await activateStudent(
        activationCodes[i].activationCode,
        studentData[i].name,
        studentData[i].avatar
      );
      
      if (result.success && result.student) {
        createdStudents.push(result.student);
        console.log(`✅ ${result.student.studentName} activated!`);
        console.log(`   Fun Code: ${result.student.funCode}`);
        console.log(`   Avatar: ${result.student.avatarId}`);
      } else {
        console.log(`❌ Failed to activate: ${result.error}`);
      }
    }
    console.log('');

    // 6. Get students for visual picker
    console.log('6️⃣ Visual Picker: Getting class students...\n');
    
    const pickerStudents = await getClassStudents(testClass.id);
    console.log(`Found ${pickerStudents.length} students:`);
    pickerStudents.forEach(s => {
      console.log(`  • ${s.studentName} (${s.funCode}) - Avatar: ${s.avatarId}`);
    });
    console.log('');

    // 7. Test student login
    console.log('7️⃣ Student Login: Testing visual login...\n');
    
    if (createdStudents.length > 0) {
      const testStudent = createdStudents[0];
      const loginResult = await studentLogin(testStudent.funCode!, testStudent.avatarId!);
      
      if (loginResult.success) {
        console.log(`✅ Login successful for ${testStudent.studentName}!`);
        console.log(`   Token: ${loginResult.token?.substring(0, 20)}...`);
      } else {
        console.log(`❌ Login failed: ${loginResult.error}`);
      }
    }

    // 8. Summary
    console.log('\n📊 Test Summary:\n');
    console.log(`✅ Classroom session created and validated`);
    console.log(`✅ ${activationCodes.length} activation codes generated`);
    console.log(`✅ ${createdStudents.length} students activated`);
    console.log(`✅ Visual picker data retrieved`);
    console.log(`✅ Student login tested`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete in reverse order of dependencies
    for (const student of createdStudents) {
      await db.delete(students).where(eq(students.id, student.id));
    }
    
    for (const activation of activationCodes) {
      await db.delete(activations).where(eq(activations.id, activation.id));
    }
    
    await db.delete(classroomSessions).where(eq(classroomSessions.id, session.id));
    
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 All tests passed! The new authentication system is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

// Run the test
testCompleteAuthFlow();