// Fix meerkat hat positions
import { db } from './server/db.js';
import { itemAnimalPositions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

async function fixMeerkatHatPosition() {
  console.log('Checking meerkat hat positions...');
  
  // Get all hat positions for meerkat
  const meerkatHatPositions = await db
    .select()
    .from(itemAnimalPositions)
    .where(eq(itemAnimalPositions.animalType, 'meerkat'));
  
  console.log(`Found ${meerkatHatPositions.length} positions for meerkat:`);
  meerkatHatPositions.forEach(pos => {
    console.log(`- Item: ${pos.itemId}, X: ${pos.positionX}, Y: ${pos.positionY}, Scale: ${pos.scale}, Rotation: ${pos.rotation}`);
  });
  
  // Fix explorer hat position for meerkat
  const explorerHatPosition = await db
    .select()
    .from(itemAnimalPositions)
    .where(
      and(
        eq(itemAnimalPositions.itemId, 'explorer'),
        eq(itemAnimalPositions.animalType, 'meerkat')
      )
    )
    .limit(1);
  
  if (explorerHatPosition.length > 0) {
    console.log('\nCurrent explorer hat position for meerkat:', explorerHatPosition[0]);
    
    // Update to correct position
    const updated = await db
      .update(itemAnimalPositions)
      .set({
        positionX: 50,  // Center horizontally
        positionY: 15,  // Top of head
        scale: 0.35,    // Appropriate scale
        rotation: 0,    // No rotation
        updatedAt: new Date()
      })
      .where(eq(itemAnimalPositions.id, explorerHatPosition[0].id))
      .returning();
    
    console.log('Updated to:', updated[0]);
  } else {
    console.log('\nNo explorer hat position found for meerkat. Creating one...');
    
    const created = await db
      .insert(itemAnimalPositions)
      .values({
        itemId: 'explorer',
        animalType: 'meerkat',
        positionX: 50,
        positionY: 15,
        scale: 0.35,
        rotation: 0
      })
      .returning();
    
    console.log('Created:', created[0]);
  }
  
  console.log('\nDone!');
}

fixMeerkatHatPosition().catch(console.error);
