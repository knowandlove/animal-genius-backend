import { db } from './server/db';
import { students, classes } from './shared/schema';
import { v4 as uuidv4 } from 'uuid';

async function createTestStudent() {
  console.log('🎓 Creating Test Student\n');
  
  try {
    // 1. First, find or create a test class
    console.log('1️⃣ Looking for existing classes...');
    const existingClasses = await db.select().from(classes).limit(1);
    
    let classId: string;
    
    if (existingClasses.length > 0) {
      classId = existingClasses[0].id;
      console.log(`✅ Using existing class: ${existingClasses[0].className}`);
    } else {
      console.log('❌ No classes found');
      console.log('💡 Please create a teacher account and class first');
      return;
    }
    
    // 2. Generate a passport code
    const animals = ['OWL', 'CAT', 'DOG', 'FOX', 'BEE'];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const code = Math.random().toString(36).substring(2, 5).toUpperCase();
    const passportCode = `${animal}-${code}`;
    
    // 3. Create the student
    console.log(`\n2️⃣ Creating student with passport code: ${passportCode}`);
    
    const [newStudent] = await db.insert(students).values({
      id: uuidv4(),
      classId: classId,
      passportCode: passportCode,
      studentName: 'Test Student',
      gradeLevel: '5th',
      currencyBalance: 50 // Starting coins
    }).returning();
    
    console.log('\n✅ Test student created successfully!');
    console.log('📋 Student Details:');
    console.log(`  - Name: ${newStudent.studentName}`);
    console.log(`  - Passport Code: ${newStudent.passportCode}`);
    console.log(`  - Class ID: ${newStudent.classId}`);
    console.log(`  - Starting Coins: ${newStudent.currencyBalance}`);
    
    console.log('\n🚀 Next Steps:');
    console.log('1. Deploy the Edge Function: supabase functions deploy student-auth --no-verify-jwt');
    console.log('2. Run migrations: supabase db push');
    console.log('3. Test authentication: npm run test-auth');
    console.log(`4. Use passport code "${passportCode}" to log in as student`);
    
  } catch (error) {
    console.error('\n❌ Failed to create test student:', error);
    if (error.message?.includes('duplicate key')) {
      console.log('💡 A student with that passport code already exists');
    }
  } finally {
    process.exit();
  }
}

// Run the script
createTestStudent();