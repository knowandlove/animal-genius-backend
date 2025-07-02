import { db } from "../server/db";
import { students } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generatePassportCode } from "@shared/currency-types";

console.log("\n🔧 Fixing passport codes to use animal-based format...\n");

// Get all students
const allStudents = await db.select().from(students);

console.log(`Found ${allStudents.length} students to update\n`);

let updated = 0;
for (const student of allStudents) {
  if (!student.animalType) {
    console.log(`⚠️  Skipping ${student.studentName} - no animal type set`);
    continue;
  }

  // Generate new passport code based on animal type
  const newPassportCode = generatePassportCode(student.animalType);
  
  // Update the student
  await db
    .update(students)
    .set({ passportCode: newPassportCode })
    .where(eq(students.id, student.id));
  
  console.log(`✅ ${student.studentName}: ${student.passportCode} → ${newPassportCode} (${student.animalType})`);
  updated++;
}

console.log(`\n✅ Updated ${updated} passport codes to animal-based format!`);

// Show a few examples
console.log("\nExample passport codes:");
const examples = await db
  .select({
    studentName: students.studentName,
    animalType: students.animalType,
    passportCode: students.passportCode
  })
  .from(students)
  .limit(5);

examples.forEach(s => {
  console.log(`- ${s.studentName} (${s.animalType}): ${s.passportCode}`);
});

process.exit(0);
