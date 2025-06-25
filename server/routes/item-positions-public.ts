import { Router } from 'express';
import { db } from '../db';
import { itemAnimalPositions } from '@shared/schema';

const router = Router();

/**
 * GET /api/item-positions/public
 * Public endpoint to get all item positions for avatars
 * This is used by student islands to position items correctly
 */
router.get('/public', async (req, res) => {
  try {
    console.log('[Item Positions] Fetching public positions');
    
    const positions = await db
      .select({
        item_id: itemAnimalPositions.itemId,
        animal_type: itemAnimalPositions.animalType,
        position_x: itemAnimalPositions.positionX,
        position_y: itemAnimalPositions.positionY,
        scale: itemAnimalPositions.scale,
        rotation: itemAnimalPositions.rotation,
      })
      .from(itemAnimalPositions);
    
    console.log(`[Item Positions] Found ${positions.length} positions`);
    
    res.json(positions);
  } catch (error) {
    console.error('Error fetching item positions:', error);
    res.status(500).json({ error: 'Failed to fetch item positions' });
  }
});

export default router;
