import { db } from "../server/db";
import { students, classes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function listStudentPassportCodes() {
  try {
    console.log("🔍 Fetching student passport codes...\n");

    // Get all classes
    const allClasses = await db.select().from(classes);
    
    for (const cls of allClasses) {
      console.log(`\n📚 Class: ${cls.name} (${cls.passportCode})`);
      console.log("   Students:");
      
      // Get students in this class
      const classStudents = await db
        .select({
          studentName: students.studentName,
          passportCode: students.passportCode,
          animalType: students.animalType,
          currencyBalance: students.currencyBalance
        })
        .from(students)
        .where(eq(students.classId, cls.id))
        .orderBy(students.studentName);
      
      if (classStudents.length === 0) {
        console.log("   No students in this class");
      } else {
        classStudents.forEach((student, index) => {
          console.log(`   ${index + 1}. ${student.studentName} - ${student.animalType}`);
          console.log(`      Passport: ${student.passportCode}`);
          console.log(`      Island URL: http://localhost:5173/island/${student.passportCode}`);
          console.log(`      Coins: ${student.currencyBalance}`);
        });
      }
    }
    
    console.log("\n✅ Done!");
    
  } catch (error) {
    console.error("❌ Error listing passport codes:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
listStudentPassportCodes();
