import { db } from '../server/db';
import { patterns, storeItems, studentInventory, students } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function checkPatternPurchase() {
  console.log('🔍 Checking CSS pattern purchases...\n');

  // Get CSS patterns
  const cssPatterns = await db
    .select()
    .from(patterns)
    .where(eq(patterns.patternType, 'css'));

  console.log(`Found ${cssPatterns.length} CSS patterns:`);
  cssPatterns.forEach(p => {
    console.log(`- ${p.name} (${p.code})`);
  });

  // Check if they have store items
  console.log('\n📦 Checking store items for CSS patterns:');
  for (const pattern of cssPatterns) {
    const [storeItem] = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.patternId, pattern.id))
      .limit(1);

    if (storeItem) {
      console.log(`✅ ${pattern.name} has store item (${storeItem.cost} coins)`);
      
      // Check if anyone has purchased it
      const purchases = await db
        .select({
          studentName: students.studentName,
          acquiredAt: studentInventory.acquiredAt
        })
        .from(studentInventory)
        .innerJoin(students, eq(studentInventory.studentId, students.id))
        .where(eq(studentInventory.storeItemId, storeItem.id));

      if (purchases.length > 0) {
        console.log(`   - Purchased by ${purchases.length} students`);
      } else {
        console.log(`   - Not purchased yet`);
      }
    } else {
      console.log(`❌ ${pattern.name} has NO store item!`);
    }
  }

  process.exit(0);
}

checkPatternPurchase().catch(console.error);