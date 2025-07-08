#!/usr/bin/env ts-node
/**
 * Script to fix existing wallpaper/flooring items that don't have pattern records
 * This creates pattern records and links them to existing store items
 */

import { db } from '../server/db';
import { storeItems, patterns, itemTypes } from '@shared/schema';
import { eq, and, isNull, or, inArray } from 'drizzle-orm';

async function fixWallpaperPatterns() {
  console.log('🔍 Finding wallpaper/flooring items without pattern records...');
  
  try {
    // Find wallpaper and flooring item types
    const patternItemTypes = await db
      .select()
      .from(itemTypes)
      .where(or(
        eq(itemTypes.code, 'room_wallpaper'),
        eq(itemTypes.code, 'room_flooring')
      ));
    
    if (patternItemTypes.length === 0) {
      console.log('❌ No wallpaper or flooring item types found in database');
      return;
    }
    
    const patternItemTypeIds = patternItemTypes.map(t => t.id);
    console.log('Found item types:', patternItemTypes.map(t => t.code).join(', '));
    
    // Find store items that are wallpaper/flooring but don't have patternId
    const itemsWithoutPatterns = await db
      .select()
      .from(storeItems)
      .where(and(
        inArray(storeItems.itemTypeId, patternItemTypeIds),
        isNull(storeItems.patternId)
      ));
    
    console.log(`Found ${itemsWithoutPatterns.length} items without pattern records`);
    
    if (itemsWithoutPatterns.length === 0) {
      console.log('✅ All wallpaper/flooring items have pattern records!');
      return;
    }
    
    // Create pattern records for each item
    for (const item of itemsWithoutPatterns) {
      console.log(`\n📝 Processing: ${item.name}`);
      
      // Determine item type
      const itemType = patternItemTypes.find(t => t.id === item.itemTypeId);
      const isWallpaper = itemType?.code === 'room_wallpaper';
      
      // Generate pattern code
      const patternPrefix = isWallpaper ? 'wallpaper' : 'flooring';
      const patternCode = `${patternPrefix}_${item.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      // Determine surface type
      const surfaceType = isWallpaper ? 'background' : 'texture';
      
      // Get the image URL - could be from imageUrl field or need to fetch from asset
      let imageUrl = item.imageUrl;
      
      if (!imageUrl && item.assetId) {
        // If no imageUrl but has assetId, we'd need to fetch from assets table
        // For now, skip these items
        console.log(`⚠️  Skipping ${item.name} - has assetId but no imageUrl`);
        continue;
      }
      
      if (!imageUrl) {
        console.log(`⚠️  Skipping ${item.name} - no image URL found`);
        continue;
      }
      
      console.log(`Creating pattern: ${patternCode}`);
      console.log(`Surface type: ${surfaceType}`);
      console.log(`Image URL: ${imageUrl}`);
      
      try {
        // Create pattern record
        const [pattern] = await db
          .insert(patterns)
          .values({
            code: patternCode,
            name: item.name,
            description: item.description,
            surfaceType: surfaceType,
            patternType: 'image',
            patternValue: imageUrl,
            theme: null,
            thumbnailUrl: item.thumbnailUrl || imageUrl,
            isActive: item.isActive,
          })
          .returning();
        
        console.log(`✅ Created pattern with ID: ${pattern.id}`);
        
        // Update store item with pattern ID
        await db
          .update(storeItems)
          .set({ patternId: pattern.id })
          .where(eq(storeItems.id, item.id));
        
        console.log(`✅ Updated store item with pattern ID`);
        
      } catch (error) {
        console.error(`❌ Error processing ${item.name}:`, error);
      }
    }
    
    console.log('\n✅ Pattern fix complete!');
    
    // Show summary
    const updatedItems = await db
      .select()
      .from(storeItems)
      .where(and(
        inArray(storeItems.itemTypeId, patternItemTypeIds),
        isNull(storeItems.patternId)
      ));
    
    console.log(`\n📊 Summary:`);
    console.log(`- Items processed: ${itemsWithoutPatterns.length}`);
    console.log(`- Items still without patterns: ${updatedItems.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixWallpaperPatterns();