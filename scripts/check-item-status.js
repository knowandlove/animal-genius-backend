import { db } from '../server/db.js';
import { storeItems, patterns, itemTypes } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkItemStatus(itemId) {
  console.log(`🔍 Checking item status for ID: ${itemId}\n`);
  
  try {
    // Find the item
    const [item] = await db
      .select({
        id: storeItems.id,
        name: storeItems.name,
        isActive: storeItems.isActive,
        cost: storeItems.cost,
        patternId: storeItems.patternId,
        itemTypeId: storeItems.itemTypeId,
        createdAt: storeItems.createdAt,
        updatedAt: storeItems.updatedAt
      })
      .from(storeItems)
      .where(eq(storeItems.id, itemId))
      .limit(1);
    
    if (!item) {
      console.log('❌ Item not found in database!');
      console.log('\nThis item ID does not exist. It may have been deleted.');
      return;
    }
    
    console.log('✅ Item found:');
    console.log(`   Name: ${item.name}`);
    console.log(`   Active: ${item.isActive ? '✅ YES' : '❌ NO'}`);
    console.log(`   Cost: ${item.cost} coins`);
    console.log(`   Has Pattern: ${item.patternId ? '✅' : '❌'}`);
    console.log(`   Created: ${item.createdAt}`);
    console.log(`   Updated: ${item.updatedAt}`);
    
    if (!item.isActive) {
      console.log('\n⚠️  ISSUE: This item is INACTIVE!');
      console.log('   The item exists but isActive=false, which is why purchase fails.');
      console.log('\n🔧 To fix: Set isActive=true in the admin panel or database.');
    }
    
    // Check if it's a pattern item
    if (item.patternId) {
      const [pattern] = await db
        .select()
        .from(patterns)
        .where(eq(patterns.id, item.patternId))
        .limit(1);
      
      if (pattern) {
        console.log('\n📋 Linked Pattern:');
        console.log(`   Code: ${pattern.code}`);
        console.log(`   Name: ${pattern.name}`);
        console.log(`   Type: ${pattern.patternType}`);
        console.log(`   Active: ${pattern.isActive ? '✅' : '❌'}`);
      }
    }
    
    // Get item type
    const [itemType] = await db
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.id, item.itemTypeId))
      .limit(1);
    
    if (itemType) {
      console.log(`\n📦 Item Type: ${itemType.code} (${itemType.category})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get item ID from command line
const itemId = process.argv[2];
if (!itemId) {
  console.log('Usage: node scripts/check-item-status.js ITEM_ID');
  console.log('Example: node scripts/check-item-status.js 0197ddb5-76a6-7277-bd1c-2cd5de9016ac');
  process.exit(1);
}

checkItemStatus(itemId);