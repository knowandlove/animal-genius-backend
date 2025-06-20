// Script to completely wipe the store and start fresh
// Run with: node wipe-store-clean.js

import { db } from './server/db.js';
import { storeItems, purchaseRequests, quizSubmissions } from './shared/schema.js';
import { sql } from 'drizzle-orm';

async function wipeStoreClean() {
  console.log('🧹 Starting complete store wipe...\n');
  
  try {
    // 1. Delete all store items
    console.log('1. Deleting all store items...');
    const deletedItems = await db
      .delete(storeItems)
      .returning();
    console.log(`   ✅ Deleted ${deletedItems.length} store items\n`);
    
    // 2. Delete all purchase requests
    console.log('2. Deleting all purchase requests...');
    const deletedRequests = await db
      .delete(purchaseRequests)
      .returning();
    console.log(`   ✅ Deleted ${deletedRequests.length} purchase requests\n`);
    
    // 3. Clear all owned items from students' avatarData
    console.log('3. Clearing all owned items from students...');
    
    // First, get all students with avatarData
    const studentsWithItems = await db
      .select({
        id: quizSubmissions.id,
        studentName: quizSubmissions.studentName,
        avatarData: quizSubmissions.avatarData
      })
      .from(quizSubmissions)
      .where(sql`${quizSubmissions.avatarData}->>'owned' IS NOT NULL`);
    
    console.log(`   Found ${studentsWithItems.length} students with owned items`);
    
    // Update each student to remove owned items but keep equipped items empty
    for (const student of studentsWithItems) {
      const currentAvatarData = student.avatarData || {};
      const updatedAvatarData = {
        ...currentAvatarData,
        owned: [],  // Clear owned items
        equipped: {} // Clear equipped items too
      };
      
      await db
        .update(quizSubmissions)
        .set({ avatarData: updatedAvatarData })
        .where(sql`${quizSubmissions.id} = ${student.id}`);
    }
    
    console.log(`   ✅ Cleared owned items from all students\n`);
    
    // 4. Reset the store_items sequence (optional - for cleaner IDs)
    console.log('4. Store cleanup complete!\n');
    
    console.log('🎉 SUCCESS! The store has been completely wiped clean.');
    console.log('   - All store items deleted');
    console.log('   - All purchase requests deleted');
    console.log('   - All student inventories cleared');
    console.log('\nYou can now start fresh with a completely empty store!');
    
  } catch (error) {
    console.error('❌ Error during store wipe:', error);
  }
  
  process.exit(0);
}

// Confirmation prompt
console.log('⚠️  WARNING: This will DELETE everything from the store!');
console.log('   - All store items');
console.log('   - All purchase requests');
console.log('   - All items owned by students\n');
console.log('Are you sure you want to continue? (Press Ctrl+C to cancel)\n');

// Give user 5 seconds to cancel
setTimeout(() => {
  wipeStoreClean();
}, 5000);

console.log('Starting in 5 seconds...');
