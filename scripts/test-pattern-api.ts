import { db } from '../server/db';
import { patterns, storeItems, studentInventory, students } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function testPatternAPI() {
  console.log('🔍 Testing pattern inventory API logic...\n');

  // Get a student who has purchased patterns
  const [studentWithPatterns] = await db
    .select({
      studentId: students.id,
      studentName: students.studentName,
      passportCode: students.passportCode
    })
    .from(students)
    .innerJoin(studentInventory, eq(students.id, studentInventory.studentId))
    .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
    .where(and(
      eq(storeItems.itemTypeId, db.select({ id: itemTypes.id }).from(itemTypes).where(eq(itemTypes.code, 'room_wallpaper')).limit(1))
    ))
    .limit(1);

  if (!studentWithPatterns) {
    console.log('No students have purchased patterns yet');
    return;
  }

  console.log(`Testing with student: ${studentWithPatterns.studentName} (${studentWithPatterns.passportCode})\n`);

  // Simulate the pattern inventory query
  const ownedPatterns = await db
    .select({
      id: patterns.id,
      code: patterns.code,
      name: patterns.name,
      surfaceType: patterns.surfaceType,
      patternType: patterns.patternType,
      patternValue: patterns.patternValue,
      itemId: storeItems.id,
      itemName: storeItems.name,
      acquiredAt: studentInventory.acquiredAt,
    })
    .from(studentInventory)
    .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
    .innerJoin(patterns, eq(storeItems.patternId, patterns.id))
    .where(eq(studentInventory.studentId, studentWithPatterns.studentId));

  console.log(`Found ${ownedPatterns.length} owned patterns:`);
  ownedPatterns.forEach(p => {
    console.log(`\n- ${p.name} (${p.code})`);
    console.log(`  Type: ${p.patternType}`);
    console.log(`  Value: ${p.patternValue?.substring(0, 50)}...`);
    console.log(`  Surface: ${p.surfaceType}`);
  });

  process.exit(0);
}

// Import itemTypes
import { itemTypes } from '@shared/schema';

testPatternAPI().catch(console.error);