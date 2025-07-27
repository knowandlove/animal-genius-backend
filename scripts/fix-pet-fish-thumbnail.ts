import { db } from "../server/db";
import { pets } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixPetFishThumbnail() {
  try {
    console.log("Fixing Pet Fish thumbnail...\n");
    
    // Update the Pet Fish thumbnail
    const thumbnailUrl = 'https://zqyvfnbwpagguutzdvpy.supabase.co/storage/v1/object/public/store-items/pets/fishpreview.png';
    
    const result = await db
      .update(pets)
      .set({
        thumbnailUrl: thumbnailUrl,
        updatedAt: new Date()
      })
      .where(eq(pets.species, 'goldfish'))
      .returning();
    
    if (result.length > 0) {
      console.log('Successfully updated Pet Fish:');
      console.log(`  - Name: ${result[0].name}`);
      console.log(`  - Species: ${result[0].species}`);
      console.log(`  - Thumbnail URL: ${result[0].thumbnailUrl}`);
    } else {
      console.error('No goldfish pet found to update');
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixPetFishThumbnail();