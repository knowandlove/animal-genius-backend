#!/usr/bin/env node
/**
 * Debug pattern ownership issues
 */

import { db } from '../server/db.js';
import { students, studentInventory, storeItems, patterns, itemTypes } from '../shared/schema.js';
import { eq, and, or } from 'drizzle-orm';

async function debugPatternOwnership(passportCode) {
  console.log(`🔍 Debugging pattern ownership for passport: ${passportCode}\n`);
  
  try {
    // Find student
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.passportCode, passportCode))
      .limit(1);
    
    if (!student) {
      console.log(`❌ No student found with passport code: ${passportCode}`);
      return;
    }
    
    console.log(`✅ Found student: ${student.studentName} (${student.id})`);
    
    // Find all wallpaper/flooring items the student owns
    console.log('\n📦 Checking owned wallpaper/flooring items...\n');
    
    const ownedPatternItems = await db
      .select({
        inventoryId: studentInventory.id,
        itemId: storeItems.id,
        itemName: storeItems.name,
        patternId: storeItems.patternId,
        patternCode: patterns.code,
        patternName: patterns.name,
        surfaceType: patterns.surfaceType,
        itemType: itemTypes.code
      })
      .from(studentInventory)
      .innerJoin(storeItems, eq(studentInventory.storeItemId, storeItems.id))
      .innerJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
      .leftJoin(patterns, eq(storeItems.patternId, patterns.id))
      .where(
        and(
          eq(studentInventory.studentId, student.id),
          or(
            eq(itemTypes.code, 'room_wallpaper'),
            eq(itemTypes.code, 'room_flooring')
          )
        )
      );
    
    if (ownedPatternItems.length === 0) {
      console.log('❌ No wallpaper or flooring items owned!');
    } else {
      console.log(`Found ${ownedPatternItems.length} pattern items:\n`);
      
      for (const item of ownedPatternItems) {
        console.log(`📦 ${item.itemName}`);
        console.log(`   Item ID: ${item.itemId}`);
        console.log(`   Type: ${item.itemType}`);
        console.log(`   Has Pattern: ${item.patternId ? '✅' : '❌'}`);
        if (item.patternId) {
          console.log(`   Pattern Code: ${item.patternCode}`);
          console.log(`   Pattern Name: ${item.patternName}`);
          console.log(`   Surface Type: ${item.surfaceType}`);
        }
        console.log('');
      }
    }
    
    // Check current room data
    console.log('\n🏠 Current room data:\n');
    const roomData = student.roomData || {};
    console.log(`Wall Pattern: ${roomData.wallPattern || (roomData.wall && roomData.wall.value) || 'none'}`);
    console.log(`Floor Pattern: ${roomData.floorPattern || (roomData.floor && roomData.floor.value) || 'none'}`);
    
    // Find all available patterns (for debugging)
    console.log('\n🎨 All wallpaper patterns in database:\n');
    const allWallpapers = await db
      .select({
        code: patterns.code,
        name: patterns.name,
        hasStoreItem: storeItems.id
      })
      .from(patterns)
      .leftJoin(storeItems, eq(patterns.id, storeItems.patternId))
      .where(eq(patterns.surfaceType, 'background'));
    
    for (const wp of allWallpapers) {
      console.log(`- ${wp.name} (${wp.code}) - Store Item: ${wp.hasStoreItem ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Get passport code from command line
const passportCode = process.argv[2];
if (!passportCode) {
  console.log('Usage: node scripts/debug-pattern-ownership.mjs PASSPORT_CODE');
  console.log('Example: node scripts/debug-pattern-ownership.mjs PAN-2BQ');
  process.exit(1);
}

debugPatternOwnership(passportCode);