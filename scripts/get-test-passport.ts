import { db } from '../server/db.js';
import { students } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function getTestPassport() {
  try {
    const result = await db
      .select({
        passportCode: students.passportCode,
        classId: students.classId,
        id: students.id
      })
      .from(students)
      .limit(1);
    
    if (result.length === 0) {
      console.log('No students found in database');
    } else {
      console.log('Test student:', result[0]);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getTestPassport();