import { db } from "../server/db";
import { students, storeItems, assets } from "@shared/schema";
import { eq } from "drizzle-orm";

console.log("\n🔍 Checking database state...\n");

// Check students
const studentCount = await db.select().from(students);
console.log(`✅ Students in database: ${studentCount.length}`);

// Check store items
const items = await db.select().from(storeItems);
console.log(`✅ Store items in database: ${items.length}`);
if (items.length > 0) {
  console.log("Sample item:", {
    name: items[0].name,
    assetId: items[0].assetId,
    imageUrl: items[0].imageUrl
  });
}

// Check assets
const assetCount = await db.select().from(assets);
console.log(`✅ Assets in database: ${assetCount.length}`);

// Check if item_positions table exists
try {
  // We'll check this differently since itemPositions isn't exported
  console.log("⚠️  Note: item_positions table check skipped (not in schema exports)");
} catch (error) {
  console.log("❌ Error:", error.message);
}

// Check a specific student's data
const student = await db
  .select()
  .from(students)
  .where(eq(students.passportCode, "253-C5D"))
  .limit(1);

if (student.length > 0) {
  console.log("\n📊 Emma Johnson's data:");
  console.log("Animal type:", student[0].animalType);
  console.log("Avatar data:", JSON.stringify(student[0].avatarData, null, 2));
}

process.exit(0);
