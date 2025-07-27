import { db } from "../server/db";
import { storeItems, itemTypes } from "@shared/schema";
import { eq, or, like } from "drizzle-orm";

async function findAllPetItems() {
  try {
    console.log("Searching for pet-related items across ALL categories...\n");
    
    // Get all store items with their categories
    const allItems = await db
      .select({
        id: storeItems.id,
        name: storeItems.name,
        itemTypeId: storeItems.itemTypeId,
        categoryCode: itemTypes.code,
        categoryName: itemTypes.name,
        category: itemTypes.category,
        cost: storeItems.cost,
        thumbnailUrl: storeItems.thumbnailUrl,
        isActive: storeItems.isActive
      })
      .from(storeItems)
      .leftJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id));
    
    // Filter for pet-related items
    const petRelatedItems = allItems.filter(item => 
      item.name.toLowerCase().includes('fish') || 
      item.name.toLowerCase().includes('bowl') ||
      item.name.toLowerCase().includes('pet') ||
      item.category === 'pets'
    );
    
    console.log(`Found ${petRelatedItems.length} pet-related items:\n`);
    
    // Group by category
    const byCategory = petRelatedItems.reduce((acc, item) => {
      const cat = item.category || 'unknown';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, typeof petRelatedItems>);
    
    Object.entries(byCategory).forEach(([category, items]) => {
      console.log(`\n=== Category: ${category} ===`);
      items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Type Code: ${item.categoryCode}`);
        console.log(`   Type Name: ${item.categoryName}`);
        console.log(`   Cost: ${item.cost} coins`);
        console.log(`   Active: ${item.isActive}`);
        console.log(`   Has Thumbnail: ${item.thumbnailUrl ? 'Yes' : 'No'}`);
        console.log("---");
      });
    });
    
    // Now let's check if there are any room_object fish bowls
    console.log("\n\nChecking specifically for room_object category items that might be fish bowls...");
    
    const roomObjects = allItems.filter(item => 
      item.category === 'room_object' && 
      (item.name.toLowerCase().includes('fish') || item.name.toLowerCase().includes('bowl'))
    );
    
    if (roomObjects.length > 0) {
      console.log(`\n⚠️  Found ${roomObjects.length} fish/bowl items in room_object category!`);
      roomObjects.forEach(item => {
        console.log(`   - ${item.name} (ID: ${item.id})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

findAllPetItems();