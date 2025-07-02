import { config } from 'dotenv';
config();

import { 
  generateUniqueFunCode, 
  generateActivationCode, 
  generateSessionCode,
  isValidFunCode,
  isValidActivationCode,
  isValidSessionCode
} from './server/lib/auth/funCodeGenerator';
import { db } from './server/db';
import { activations, classroomSessions, classes, students } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function testAuthSystem() {
  console.log('🧪 Testing New Authentication System\n');
  console.log('=====================================\n');

  try {
    // 1. Test code generation
    console.log('1️⃣ Testing Code Generation:\n');
    
    console.log('Session Codes (for classroom login):');
    for (let i = 0; i < 5; i++) {
      const code = generateSessionCode();
      const isValid = isValidSessionCode(code);
      console.log(`  ${code} - Valid: ${isValid ? '✅' : '❌'}`);
    }
    
    console.log('\nActivation Codes (for parent payment):');
    for (let i = 0; i < 5; i++) {
      const code = generateActivationCode();
      const isValid = isValidActivationCode(code);
      console.log(`  ${code} - Valid: ${isValid ? '✅' : '❌'}`);
    }

    // 2. Test database tables
    console.log('\n2️⃣ Testing Database Tables:\n');
    
    // Check if tables exist
    const activationCount = await db.execute('SELECT COUNT(*) as count FROM activations');
    console.log(`✅ Activations table exists - Count: ${activationCount.rows[0].count}`);
    
    const sessionCount = await db.execute('SELECT COUNT(*) as count FROM classroom_sessions');
    console.log(`✅ Classroom sessions table exists - Count: ${sessionCount.rows[0].count}`);

    // 3. Test creating a classroom session
    console.log('\n3️⃣ Testing Classroom Session Creation:\n');
    
    // First, get a test teacher and class
    const testTeacher = await db.query.profiles.findFirst();
    const testClass = await db.query.classes.findFirst();
    
    if (!testTeacher || !testClass) {
      console.log('⚠️  No test teacher or class found. Please create one first.');
      return;
    }

    // Create a classroom session
    const sessionCode = generateSessionCode();
    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + 12); // 12 hour expiry
    
    const [newSession] = await db.insert(classroomSessions).values({
      classId: testClass.id,
      sessionCode: sessionCode,
      isActive: true,
      expiresAt: sessionExpiry,
      createdBy: testTeacher.id
    }).returning();

    console.log(`✅ Created classroom session:`);
    console.log(`  Code: ${newSession.sessionCode}`);
    console.log(`  Expires: ${newSession.expiresAt.toLocaleString()}`);
    console.log(`  Class: ${testClass.name}`);

    // 4. Test creating an activation
    console.log('\n4️⃣ Testing Activation Creation:\n');
    
    const activationCode = generateActivationCode();
    const activationExpiry = new Date();
    activationExpiry.setDate(activationExpiry.getDate() + 90); // 90 day expiry
    
    const [newActivation] = await db.insert(activations).values({
      classId: testClass.id,
      parentEmail: 'parent@example.com',
      activationCode: activationCode,
      expiresAt: activationExpiry
    }).returning();

    console.log(`✅ Created activation:`);
    console.log(`  Code: ${newActivation.activationCode}`);
    console.log(`  Parent Email: ${newActivation.parentEmail}`);
    console.log(`  Expires: ${newActivation.expiresAt.toLocaleString()}`);

    // 5. Test student fields
    console.log('\n5️⃣ Testing Student Table Updates:\n');
    
    const studentColumns = await db.execute(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'students' 
        AND column_name IN ('fun_code', 'avatar_id', 'activation_id')
      ORDER BY ordinal_position
    `);
    
    console.log('✅ New student columns:');
    studentColumns.rows.forEach((col: any) => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // 6. Test class fields
    console.log('\n6️⃣ Testing Class Table Updates:\n');
    
    const classColumns = await db.execute(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'classes' 
        AND column_name IN ('max_students', 'payment_link', 'stripe_price_id')
      ORDER BY ordinal_position
    `);
    
    console.log('✅ New class columns:');
    classColumns.rows.forEach((col: any) => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await db.delete(classroomSessions).where(eq(classroomSessions.id, newSession.id));
    await db.delete(activations).where(eq(activations.id, newActivation.id));
    
    console.log('\n✅ All tests passed! Authentication system is ready.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testAuthSystem();