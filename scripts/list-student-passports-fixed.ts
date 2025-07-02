import { db } from "../server/db";
import { students, classes, animalTypes, geniusTypes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function listStudentPassportCodes() {
  try {
    console.log("🔍 Fetching student passport codes...\n");

    // Get all classes
    const allClasses = await db.select().from(classes);
    
    for (const cls of allClasses) {
      console.log(`\n📚 Class: ${cls.name} (Code: ${cls.classCode})`);
      console.log("   Students:");
      
      // Get students in this class
      const classStudents = await db
        .select({
          id: students.id,
          studentName: students.studentName,
          passportCode: students.passportCode,
          animalTypeId: students.animalTypeId,
          geniusTypeId: students.geniusTypeId,
          currencyBalance: students.currencyBalance
        })
        .from(students)
        .where(eq(students.classId, cls.id));
      
      if (classStudents.length === 0) {
        console.log("   No students in this class");
      } else {
        for (const [index, student] of classStudents.entries()) {
          console.log(`   ${index + 1}. ${student.studentName || 'Unnamed Student'}`);
          console.log(`      Passport: ${student.passportCode}`);
          console.log(`      Island URL: http://localhost:5173/island/${student.passportCode}`);
          console.log(`      Coins: ${student.currencyBalance}`);
          console.log(`      Animal Type ID: ${student.animalTypeId || 'Not set'}`);
          console.log(`      Genius Type ID: ${student.geniusTypeId || 'Not set'}`);
        }
      }
    }
    
    // Also list any students without a class (shouldn't happen, but just in case)
    const orphanStudents = await db
      .select({
        studentName: students.studentName,
        passportCode: students.passportCode,
        currencyBalance: students.currencyBalance
      })
      .from(students);
    
    if (orphanStudents.length > 0) {
      console.log("\n📋 All Students (including any without classes):");
      orphanStudents.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.studentName || 'Unnamed'} - ${student.passportCode} (${student.currencyBalance} coins)`);
      });
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