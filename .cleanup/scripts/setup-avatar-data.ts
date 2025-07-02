import { db } from "../server/db";
import { students } from "@shared/schema";
import { eq } from "drizzle-orm";

console.log("\n🦫 Setting up avatar data for students...\n");

// Get all students
const allStudents = await db.select().from(students);

for (const student of allStudents) {
  // Skip if already has avatar data
  if (student.avatarData && Object.keys(student.avatarData).length > 0) {
    console.log(`✓ ${student.studentName} already has avatar data`);
    continue;
  }

  // Set basic avatar data based on their animal type
  const avatarData = {
    animalType: student.animalType?.toLowerCase().replace(/\s+/g, '-') || 'meerkat',
    equipped: {}, // No items equipped initially
    owned: []     // No items owned initially
  };

  await db
    .update(students)
    .set({ avatarData })
    .where(eq(students.id, student.id));

  console.log(`✅ Set avatar data for ${student.studentName} (${student.animalType})`);
}

// Check Emma specifically
const emma = await db
  .select()
  .from(students)
  .where(eq(students.passportCode, "253-C5D"))
  .limit(1);

if (emma.length > 0) {
  console.log("\n📊 Emma's updated avatar data:");
  console.log(JSON.stringify(emma[0].avatarData, null, 2));
}

process.exit(0);
