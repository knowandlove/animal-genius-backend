import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log("🔍 Checking database structure...\n");

  try {
    // Check if students table has passport_code column
    const columnsResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'students'
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Students table columns:");
    console.table(columnsResult.rows);
    
    // Check if any students exist and if they have passport codes
    const studentsResult = await db.execute(sql`
      SELECT id, name, passport_code, created_at
      FROM students
      LIMIT 5
    `);
    
    console.log("\n👥 Sample students:");
    console.table(studentsResult.rows);
    
    // Check the current get_student_balance function
    console.log("\n💰 Testing get_student_balance function:");
    try {
      const balanceTest = await db.execute(sql`
        SELECT get_student_balance('00000000-0000-0000-0000-000000000000'::uuid) as balance
      `);
      console.log("✅ Function works! Result:", balanceTest.rows[0]);
    } catch (error: any) {
      console.log("❌ Function error:", error.message);
    }
    
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    process.exit(0);
  }
}

checkDatabase();
