// Check and fix all hat positions
import { db } from './server/db.js';
import { itemAnimalPositions } from '@shared/schema';
import { eq, or, like } from 'drizzle-orm';

async function checkAndFixHatPositions() {
  console.log('Checking all hat positions...\n');
  
  // Get all hat positions (explorer, safari, and any other hats)
  const hatPositions = await db
    .select()
    .from(itemAnimalPositions)
    .where(
      or(
        eq(itemAnimalPositions.itemId, 'explorer'),
        eq(itemAnimalPositions.itemId, 'safari'),
        like(itemAnimalPositions.itemId, '%hat%')
      )
    );
  
  console.log(`Found ${hatPositions.length} hat positions in database:\n`);
  
  // Group by item
  const positionsByItem: Record<string, any[]> = {};
  hatPositions.forEach(pos => {
    if (!positionsByItem[pos.itemId]) {
      positionsByItem[pos.itemId] = [];
    }
    positionsByItem[pos.itemId].push(pos);
  });
  
  // Check each item's positions
  for (const [itemId, positions] of Object.entries(positionsByItem)) {
    console.log(`\n${itemId.toUpperCase()} HAT:`);
    console.log('=' .repeat(50));
    
    for (const pos of positions) {
      const issues = [];
      
      // Check for common issues
      if (pos.positionX < 20 || pos.positionX > 80) {
        issues.push(`X position out of range (${pos.positionX})`);
      }
      if (pos.positionY < 5 || pos.positionY > 30) {
        issues.push(`Y position out of range (${pos.positionY})`);
      }
      if (pos.scale < 0.1 || pos.scale > 1) {
        issues.push(`Scale out of range (${pos.scale})`);
      }
      if (Math.abs(pos.rotation) > 45) {
        issues.push(`Extreme rotation (${pos.rotation}°)`);
      }
      
      console.log(`  ${pos.animalType.padEnd(15)} - X: ${pos.positionX}, Y: ${pos.positionY}, Scale: ${pos.scale}, Rotation: ${pos.rotation}`);
      
      if (issues.length > 0) {
        console.log(`    ⚠️  Issues: ${issues.join(', ')}`);
        
        // Fix the position
        const fixed = await db
          .update(itemAnimalPositions)
          .set({
            positionX: Math.min(Math.max(pos.positionX, 40), 60), // Clamp between 40-60
            positionY: Math.min(Math.max(pos.positionY, 10), 25), // Clamp between 10-25
            scale: Math.min(Math.max(pos.scale, 0.25), 0.5),     // Clamp between 0.25-0.5
            rotation: Math.min(Math.max(pos.rotation, -20), 20),  // Clamp between -20 to 20
            updatedAt: new Date()
          })
          .where(eq(itemAnimalPositions.id, pos.id))
          .returning();
        
        console.log(`    ✅ Fixed to - X: ${fixed[0].positionX}, Y: ${fixed[0].positionY}, Scale: ${fixed[0].scale}, Rotation: ${fixed[0].rotation}`);
      }
    }
  }
  
  console.log('\n\nDone checking and fixing hat positions!');
}

checkAndFixHatPositions().catch(console.error);
