import { db } from "../server/db";
import { storeItems, itemTypes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixFishItem() {
  try {
    console.log("Fixing fish item in the database...\n");
    
    // First, find the pets item type
    const [petType] = await db
      .select()
      .from(itemTypes)
      .where(eq(itemTypes.category, 'pets'))
      .limit(1);
    
    if (!petType) {
      console.error("Could not find 'pets' category in item_types table");
      
      // Let's check what categories exist
      const allTypes = await db.select().from(itemTypes);
      console.log("Available item types:");
      allTypes.forEach(type => {
        console.log(`  - ${type.code} (${type.category})`);
      });
      
      process.exit(1);
    }
    
    console.log(`Found pets item type: ${petType.name} (ID: ${petType.id})`);
    
    // Find the fish item
    const [fishItem] = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.name, 'Fish Bowl'))
      .limit(1);
    
    if (!fishItem) {
      console.error("Could not find 'Fish Bowl' item");
      process.exit(1);
    }
    
    console.log(`Found fish item with ID: ${fishItem.id}`);
    console.log(`Current itemTypeId: ${fishItem.itemTypeId}`);
    console.log(`Current thumbnailUrl: ${fishItem.thumbnailUrl}`);
    
    // Update the fish item
    const thumbnailUrl = 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/store-items/pets/fishpreview.png';
    
    await db
      .update(storeItems)
      .set({
        itemTypeId: petType.id,
        thumbnailUrl: thumbnailUrl,
        updatedAt: new Date()
      })
      .where(eq(storeItems.id, fishItem.id));
    
    console.log('\nSuccessfully updated fish item:');
    console.log(`  - Set itemTypeId to pets category (${petType.id})`);
    console.log(`  - Set thumbnailUrl to: ${thumbnailUrl}`);
    
    // Verify the update
    const [updatedItem] = await db
      .select({
        name: storeItems.name,
        category: itemTypes.category,
        thumbnailUrl: storeItems.thumbnailUrl
      })
      .from(storeItems)
      .leftJoin(itemTypes, eq(storeItems.itemTypeId, itemTypes.id))
      .where(eq(storeItems.id, fishItem.id))
      .limit(1);
    
    console.log('\nVerification:');
    console.log(`  - Name: ${updatedItem.name}`);
    console.log(`  - Category: ${updatedItem.category}`);
    console.log(`  - Thumbnail URL: ${updatedItem.thumbnailUrl}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixFishItem();