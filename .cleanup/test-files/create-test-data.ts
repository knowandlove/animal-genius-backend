import { db } from './server/db';
import { classes, profiles } from './shared/schema';
import { eq } from 'drizzle-orm';

async function createTestData() {
  console.log('🧪 Creating test data...\n');

  try {
    // Get the first available teacher
    const teachers = await db.select()
      .from(profiles)
      .limit(1);

    if (teachers.length === 0) {
      console.error('❌ No teachers found in database. Please create a teacher account first.');
      return;
    }

    const teacher = teachers[0];
    console.log(`Using teacher: ${teacher.fullName} (${teacher.email})`)

    // Check if we have a test class
    const existingClass = await db.select()
      .from(classes)
      .where(eq(classes.classCode, 'TEST-123'))
      .limit(1);

    if (existingClass.length === 0) {
      // Create a test class
      const [newClass] = await db.insert(classes).values({
        teacherId: teacher.id,
        name: 'Test Math Class',
        subject: 'Mathematics',
        gradeLevel: '5th Grade',
        classCode: 'TEST-123',
        schoolName: 'Test Elementary',
        icon: 'book',
        backgroundColor: '#829B79'
      }).returning();
      
      console.log('✓ Created test class');
      console.log(`  Class ID: ${newClass.id}`);
      console.log(`  Class Code: ${newClass.classCode}`);
    } else {
      console.log('- Test class already exists');
      console.log(`  Class ID: ${existingClass[0].id}`);
      console.log(`  Class Code: ${existingClass[0].classCode}`);
    }

    console.log('\n✅ Test data ready!');

  } catch (error) {
    console.error('\n❌ Error creating test data:', error);
  } finally {
    process.exit(0);
  }
}

// Run immediately
createTestData();