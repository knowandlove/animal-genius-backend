// Test script to verify database migration works
// Run this AFTER running the SQL migrations

import { db } from "./server/db";
import { students, quizSubmissions } from "./shared/schema";
import { sql } from "drizzle-orm";

async function testDatabaseMigration() {
  try {
    console.log("🔍 Testing database migration...\n");

    // 1. Check if students table exists and has data
    const studentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(students);
    
    console.log(`✅ Students table has ${studentCount[0].count} records`);

    // 2. Check a sample of students
    const sampleStudents = await db
      .select()
      .from(students)
      .limit(5);
    
    console.log("\n📊 Sample students:");
    sampleStudents.forEach(s => {
      console.log(`  - ${s.displayName} (${s.passportCode}) - Balance: ${s.walletBalance} coins`);
    });

    // 3. Check if quiz_submissions are linked
    const linkedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(quizSubmissions)
      .where(sql`student_id IS NOT NULL`);
    
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(quizSubmissions);
    
    console.log(`\n🔗 Linked submissions: ${linkedCount[0].count} out of ${totalCount[0].count} total`);

    // 4. Verify data integrity
    const orphanedSubmissions = await db
      .select({ count: sql<number>`count(*)` })
      .from(quizSubmissions)
      .where(sql`passport_code IS NOT NULL AND student_id IS NULL`);
    
    if (orphanedSubmissions[0].count > 0) {
      console.log(`\n⚠️  Warning: ${orphanedSubmissions[0].count} submissions not linked to students`);
    } else {
      console.log("\n✅ All submissions properly linked!");
    }

    console.log("\n🎉 Database migration test complete!");
    
  } catch (error) {
    console.error("❌ Error testing migration:", error);
  } finally {
    process.exit();
  }
}

testDatabaseMigration();
