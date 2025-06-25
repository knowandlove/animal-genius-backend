// Check all store items that need positioning
import { config } from 'dotenv';
config();

async function checkStoreItems() {
  console.log('🔍 Checking Store Items and Positioning Status\n');
  
  try {
    const { db } = await import('./server/db.js');
    const { sql } = await import('drizzle-orm');
    
    // Get all avatar items from store
    const storeResult = await db.execute(sql`
      SELECT 
        s.id, 
        s.name, 
        s.item_type,
        s.cost,
        COUNT(p.id) as position_count
      FROM store_items s
      LEFT JOIN item_animal_positions p ON s.id = p.item_id
      WHERE s.item_type LIKE 'avatar%'
      GROUP BY s.id, s.name, s.item_type, s.cost
      ORDER BY s.item_type, s.name
    `);
    
    console.log(`Found ${storeResult.rows.length} avatar items in store:\n`);
    
    const animals = ['meerkat', 'panda', 'owl', 'beaver', 'elephant', 'otter', 'parrot', 'border-collie'];
    const totalAnimals = animals.length;
    
    storeResult.rows.forEach((item: any) => {
      const completion = (item.position_count / totalAnimals * 100).toFixed(0);
      const status = item.position_count === 0 ? '❌ Not positioned' : 
                     item.position_count < totalAnimals ? `⚠️  ${item.position_count}/${totalAnimals} positioned` :
                     '✅ Fully positioned';
      
      console.log(`\n${item.name} (${item.item_type})`);
      console.log(`  ID: ${item.id}`);
      console.log(`  Cost: ${item.cost} coins`);
      console.log(`  Status: ${status} (${completion}% complete)`);
      
      if (item.position_count > 0 && item.position_count < totalAnimals) {
        // Show which animals are missing
        checkMissingAnimals(item.id, item.name);
      }
    });
    
    // Summary
    const totalItems = storeResult.rows.length;
    const fullyPositioned = storeResult.rows.filter((item: any) => item.position_count === totalAnimals).length;
    const notPositioned = storeResult.rows.filter((item: any) => item.position_count === 0).length;
    const partiallyPositioned = totalItems - fullyPositioned - notPositioned;
    
    console.log('\n\n📊 SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total avatar items: ${totalItems}`);
    console.log(`✅ Fully positioned: ${fullyPositioned}`);
    console.log(`⚠️  Partially positioned: ${partiallyPositioned}`);
    console.log(`❌ Not positioned: ${notPositioned}`);
    console.log(`\nTotal positions needed: ${totalItems * totalAnimals}`);
    console.log(`Total positions set: ${storeResult.rows.reduce((sum: number, item: any) => sum + parseInt(item.position_count), 0)}`);
    
    async function checkMissingAnimals(itemId: string, itemName: string) {
      const posResult = await db.execute(sql`
        SELECT animal_type 
        FROM item_animal_positions 
        WHERE item_id = ${itemId}
      `);
      
      const positionedAnimals = posResult.rows.map((row: any) => row.animal_type);
      const missing = animals.filter(animal => !positionedAnimals.includes(animal));
      
      if (missing.length > 0) {
        console.log(`  Missing: ${missing.join(', ')}`);
      }
    }
    
    console.log('\n\n💡 Next Steps:');
    console.log('1. Go to /admin/item-positioner');
    console.log('2. Select items that are not fully positioned');
    console.log('3. Position them for each animal');
    console.log('4. Use "Copy to All Animals" for items that work the same on all animals');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkStoreItems();
