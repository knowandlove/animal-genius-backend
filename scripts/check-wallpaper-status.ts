#!/usr/bin/env ts-node
/**
 * Script to check the status of wallpaper items and fix any issues
 */

import { db } from '../server/db';
import { storeItems, patterns, itemTypes } from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';

async function checkWallpaperStatus() {
  console.log('🔍 Checking wallpaper items status...\n');
  
  try {
    // Find wallpaper item type
    const [wallpaperType] = await db
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.code, 'room_wallpaper'))
      .limit(1);
    
    if (!wallpaperType) {
      console.log('❌ No room_wallpaper item type found in database!');
      return;
    }
    
    console.log('✅ Found wallpaper item type:', wallpaperType.code);
    
    // Find all wallpaper items
    const wallpaperItems = await db
      .select({
        id: storeItems.id,
        name: storeItems.name,
        isActive: storeItems.isActive,
        cost: storeItems.cost,
        patternId: storeItems.patternId,
        assetId: storeItems.assetId,
        imageUrl: storeItems.imageUrl,
        createdAt: storeItems.createdAt
      })
      .from(storeItems)
      .where(eq(storeItems.itemTypeId, wallpaperType.id));
    
    console.log(`\n📊 Found ${wallpaperItems.length} wallpaper items:\n`);
    
    for (const item of wallpaperItems) {
      console.log(`📦 ${item.name}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Active: ${item.isActive ? '✅' : '❌'}`);
      console.log(`   Cost: ${item.cost} coins`);
      console.log(`   Has Pattern: ${item.patternId ? '✅' : '❌'}`);
      console.log(`   Has Asset: ${item.assetId ? '✅' : '❌'}`);
      console.log(`   Created: ${item.createdAt}`);
      
      if (!item.isActive) {
        console.log(`   ⚠️  This item is INACTIVE and won't appear in store!`);
        
        // Offer to activate it
        console.log(`   🔧 Activating ${item.name}...`);
        await db
          .update(storeItems)
          .set({ isActive: true })
          .where(eq(storeItems.id, item.id));
        console.log(`   ✅ Activated!`);
      }
      
      if (item.patternId) {
        // Check if pattern exists
        const [pattern] = await db
          .select()
          .from(patterns)
          .where(eq(patterns.id, item.patternId))
          .limit(1);
        
        if (pattern) {
          console.log(`   Pattern: ${pattern.name} (${pattern.code})`);
          console.log(`   Surface: ${pattern.surfaceType}`);
          console.log(`   Type: ${pattern.patternType}`);
        } else {
          console.log(`   ❌ Pattern ID references non-existent pattern!`);
        }
      }
      
      console.log('');
    }
    
    // Check for orphaned patterns
    console.log('\n🔍 Checking for wallpaper patterns without store items...\n');
    
    const wallpaperPatterns = await db
      .select()
      .from(patterns)
      .where(eq(patterns.surfaceType, 'background'));
    
    for (const pattern of wallpaperPatterns) {
      const [linkedItem] = await db
        .select()
        .from(storeItems)
        .where(eq(storeItems.patternId, pattern.id))
        .limit(1);
      
      if (!linkedItem) {
        console.log(`⚠️  Pattern "${pattern.name}" (${pattern.code}) has no store item!`);
      }
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkWallpaperStatus();