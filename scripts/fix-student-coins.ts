import { db } from "../server/db";
import { students, currencyTransactions } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixStudentCoins() {
  try {
    console.log("💰 Fixing student coin balances...\n");

    // Get all students with 0 balance
    const studentsWithNoCoins = await db
      .select({
        id: students.id,
        studentName: students.studentName,
        passportCode: students.passportCode,
        currencyBalance: students.currencyBalance,
        classId: students.classId
      })
      .from(students)
      .where(eq(students.currencyBalance, 0));

    console.log(`Found ${studentsWithNoCoins.length} students with 0 coins\n`);

    // Get the teacher ID from the first student's class
    if (studentsWithNoCoins.length > 0) {
      const classInfo = await db.query.classes.findFirst({
        where: (classes, { eq }) => eq(classes.id, studentsWithNoCoins[0].classId)
      });

      if (!classInfo) {
        console.error("Could not find class info!");
        return;
      }

      let fixedCount = 0;

      for (const student of studentsWithNoCoins) {
        try {
          // Update the student's balance
          await db
            .update(students)
            .set({ currencyBalance: 50 })
            .where(eq(students.id, student.id));

          // Create the missing currency transaction
          await db
            .insert(currencyTransactions)
            .values({
              studentId: student.id,
              teacherId: classInfo.teacherId,
              amount: 50,
              transactionType: 'quiz_complete',
              description: 'Quiz completion reward (retroactive fix)'
            });

          console.log(`✅ Fixed ${student.studentName} (${student.passportCode}) - now has 50 coins`);
          fixedCount++;

        } catch (error) {
          console.error(`❌ Failed to fix ${student.studentName}:`, error);
        }
      }

      console.log(`\n🎉 Successfully fixed ${fixedCount} out of ${studentsWithNoCoins.length} students!`);
    }

  } catch (error) {
    console.error("❌ Error fixing student coins:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
fixStudentCoins();
