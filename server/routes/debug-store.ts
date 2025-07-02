// @ts-nocheck
// Debug route - not critical for production, contains legacy property references
import { Router } from 'express';
import { db } from '../db';
import { storeItems, assets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import StorageRouter from '../services/storage-router';

const router = Router();

router.get('/test', async (req, res) => {
  try {
    // Get the Explorer Hat
    const [item] = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Explorer Hat'));
    
    console.log('Raw item from DB:', item);
    
    if (!item) {
      return res.json({ error: 'Explorer Hat not found' });
    }
    
    // Get its asset
    if (item.assetId) {
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, item.assetId));
      
      console.log('Asset from DB:', asset);
      
      // Build the URL manually
      const manualUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${asset.bucket}/${asset.path}`;
      console.log('Manual URL:', manualUrl);
      
      // Use StorageRouter
      const prepared = await StorageRouter.prepareStoreItemsResponse([item]);
      console.log('Prepared item:', prepared[0]);
      
      res.json({
        raw_item: item,
        asset: asset,
        manual_url: manualUrl,
        prepared_item: prepared[0],
        cloud_storage_enabled: process.env.USE_CLOUD_STORAGE
      });
    } else {
      res.json({ 
        raw_item: item, 
        error: 'No asset_id on item',
        cloud_storage_enabled: process.env.USE_CLOUD_STORAGE
      });
    }
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
