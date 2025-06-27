import { db } from "../server/db";
import { students, classes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function testIslandEndpoint() {
  try {
    console.log("🔍 Testing island endpoint...\n");

    // Get a student to test with
    const testStudent = await db
      .select({
        id: students.id,
        studentName: students.studentName,
        passportCode: students.passportCode,
        classId: students.classId,
        currencyBalance: students.currencyBalance,
        avatarData: students.avatarData,
        roomData: students.roomData
      })
      .from(students)
      .limit(1);

    if (testStudent.length === 0) {
      console.error("No students found!");
      return;
    }

    const student = testStudent[0];
    console.log("Testing with student:", student.studentName);
    console.log("Passport code:", student.passportCode);
    console.log("Currency balance:", student.currencyBalance);
    console.log("Avatar data:", JSON.stringify(student.avatarData, null, 2));
    console.log("Room data:", JSON.stringify(student.roomData, null, 2));

    // Test the API endpoint directly
    const apiUrl = `http://localhost:5001/api/island-page-data/${student.passportCode}`;
    console.log("\nTesting API endpoint:", apiUrl);

    try {
      const response = await fetch(apiUrl);
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
      } else {
        const data = await response.json();
        console.log("\n✅ API Response received!");
        console.log("Island data:", {
          studentName: data.island?.studentName,
          passportCode: data.island?.passportCode,
          animalType: data.island?.animalType,
          currencyBalance: data.island?.currencyBalance,
          className: data.island?.className
        });
        console.log("Wallet:", data.wallet);
        console.log("Store status:", data.storeStatus);
        console.log("Store catalog items:", data.storeCatalog?.length || 0);
      }
    } catch (fetchError) {
      console.error("Failed to fetch:", fetchError);
    }

    // Also check if the student exists in the database with proper joins
    console.log("\n🔍 Checking database query...");
    const studentData = await db
      .select({
        id: students.id,
        studentName: students.studentName,
        passportCode: students.passportCode,
        className: classes.name,
        classId: classes.id
      })
      .from(students)
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(students.passportCode, student.passportCode))
      .limit(1);

    console.log("Database query result:", studentData);

  } catch (error) {
    console.error("❌ Error testing endpoint:", error);
  } finally {
    process.exit(0);
  }
}

// Run the script
testIslandEndpoint();
