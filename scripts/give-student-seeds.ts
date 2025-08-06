import { db } from '../server/db.js';
import { students, studentInventory, storeItems } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function giveStudentSeeds() {
  try {
    console.log('=== Giving Seeds to Student ===\n');
    
    const passportCode = 'OTT-PQ1';
    
    // Get student - minimal fields
    const [student] = await db.select({
      id: students.id,
      studentName: students.studentName,
      currencyBalance: students.currencyBalance
    })
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
      
    if (!student) {
      console.error('Student not found!');
      process.exit(1);
    }
    
    console.log(`Student: ${student.studentName}`);
    console.log(`Balance: ${student.currencyBalance} coins\n`);
    
    // Get different seed types from store
    const seedItems = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Tomato Seeds'))
      .limit(1);
      
    const strawberrySeeds = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Strawberry Seeds'))
      .limit(1);
      
    const lettuceSeeds = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Lettuce Seeds'))
      .limit(1);
    
    // Give seeds to student
    console.log('Giving seeds to student...\n');
    
    if (seedItems[0]) {
      // Update quantity if exists, otherwise insert
      try {
        await db.insert(studentInventory)
          .values({
            studentId: student.id,
            storeItemId: seedItems[0].id,
            quantity: 5
          });
      } catch (e: any) {
        if (e.code === '23505') { // duplicate key
          await db.update(studentInventory)
            .set({ quantity: 5 })
            .where(and(
              eq(studentInventory.studentId, student.id),
              eq(studentInventory.storeItemId, seedItems[0].id)
            ));
        } else {
          throw e;
        }
      }
      console.log('✅ Gave 5 Tomato Seeds');
    }
    
    if (strawberrySeeds[0]) {
      try {
        await db.insert(studentInventory)
          .values({
            studentId: student.id,
            storeItemId: strawberrySeeds[0].id,
            quantity: 3
          });
      } catch (e: any) {
        if (e.code === '23505') {
          await db.update(studentInventory)
            .set({ quantity: 3 })
            .where(and(
              eq(studentInventory.studentId, student.id),
              eq(studentInventory.storeItemId, strawberrySeeds[0].id)
            ));
        } else {
          throw e;
        }
      }
      console.log('✅ Gave 3 Strawberry Seeds');
    }
    
    if (lettuceSeeds[0]) {
      try {
        await db.insert(studentInventory)
          .values({
            studentId: student.id,
            storeItemId: lettuceSeeds[0].id,
            quantity: 4
          });
      } catch (e: any) {
        if (e.code === '23505') {
          await db.update(studentInventory)
            .set({ quantity: 4 })
            .where(and(
              eq(studentInventory.studentId, student.id),
              eq(studentInventory.storeItemId, lettuceSeeds[0].id)
            ));
        } else {
          throw e;
        }
      }
      console.log('✅ Gave 4 Lettuce Seeds');
    }
    
    // Check what's in inventory now
    console.log('\n=== Current Inventory ===');
    const inventory = await db
      .select({
        id: studentInventory.id,
        quantity: studentInventory.quantity,
        storeItemId: studentInventory.storeItemId
      })
      .from(studentInventory)
      .where(eq(studentInventory.studentId, student.id));
    
    console.log(`Total items in inventory: ${inventory.length}`);
    
    // Get item names
    for (const item of inventory) {
      const [storeItem] = await db
        .select({ name: storeItems.name })
        .from(storeItems)
        .where(eq(storeItems.id, item.storeItemId))
        .limit(1);
        
      if (storeItem) {
        console.log(`- ${storeItem.name} x${item.quantity}`);
      }
    }
    
    console.log('\n✅ Done! The student now has seeds in their inventory.');
    console.log('Go to the UI and click on an empty plot square to see the planting modal.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

giveStudentSeeds();