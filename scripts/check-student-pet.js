import { db } from '../server/db.ts';
import { students, studentPets, pets } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkStudentPet() {
  try {
    // Find student by passport code
    const passportCode = 'OWL-9ON';
    console.log(`\nChecking pet status for passport code: ${passportCode}`);
    
    // Get student info
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
    
    if (!student) {
      console.log('❌ Student not found with this passport code');
      return;
    }
    
    console.log('\n📋 Student Info:');
    console.log(`- Name: ${student.name}`);
    console.log(`- ID: ${student.id}`);
    console.log(`- Balance: ${student.currencyBalance} coins`);
    
    // Check for existing pets
    const existingPets = await db
      .select({
        studentPet: studentPets,
        pet: pets
      })
      .from(studentPets)
      .leftJoin(pets, eq(studentPets.petId, pets.id))
      .where(eq(studentPets.studentId, student.id));
    
    console.log(`\n🐾 Existing Pets: ${existingPets.length}`);
    
    if (existingPets.length > 0) {
      console.log('\nPet Details:');
      existingPets.forEach((record, index) => {
        console.log(`\nPet ${index + 1}:`);
        console.log(`- Pet Name: ${record.studentPet.customName}`);
        console.log(`- Species: ${record.pet?.species || 'Unknown'}`);
        console.log(`- Pet ID: ${record.studentPet.petId}`);
        console.log(`- Purchased At: ${record.studentPet.createdAt}`);
        console.log(`- Hunger: ${record.studentPet.hunger}`);
        console.log(`- Happiness: ${record.studentPet.happiness}`);
      });
    } else {
      console.log('✅ No pets found for this student');
    }
    
    // Also check all student_pets records for this student ID
    console.log(`\n🔍 Double-checking all student_pets records for student ID: ${student.id}`);
    const allStudentPetRecords = await db
      .select()
      .from(studentPets)
      .where(eq(studentPets.studentId, student.id));
    
    console.log(`Found ${allStudentPetRecords.length} total records in student_pets table`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkStudentPet();