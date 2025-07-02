import { db } from "../server/db";
import { animalTypes, itemTypes, geniusTypes } from "../shared/schema";
import { sql } from "drizzle-orm";

/**
 * Populate all lookup tables with the correct data
 * Run this script to initialize the database with all the lookup values
 */

async function populateLookupTables() {
  console.log("🚀 Starting lookup table population...");
  
  try {
    // Start a transaction to ensure all-or-nothing
    await db.transaction(async (tx) => {
      
      // ===== ANIMAL TYPES =====
      console.log("\n📝 Populating animal_types...");
      
      // Clear existing data
      await tx.delete(animalTypes);
      
      const animalData = [
        { code: 'meerkat', name: 'Meerkat', personalityType: 'ESTJ', geniusType: 'builder', description: 'Creative & Empathetic' },
        { code: 'panda', name: 'Panda', personalityType: 'ISFJ', geniusType: 'guardian', description: 'Thoughtful & Strategic' },
        { code: 'owl', name: 'Owl', personalityType: 'INTJ', geniusType: 'advisor', description: 'Independent & Analytical' },
        { code: 'beaver', name: 'Beaver', personalityType: 'ISTJ', geniusType: 'guardian', description: 'Reliable & Organized' },
        { code: 'elephant', name: 'Elephant', personalityType: 'ESFJ', geniusType: 'builder', description: 'Caring & Social' },
        { code: 'otter', name: 'Otter', personalityType: 'ENFP', geniusType: 'creator', description: 'Playful & Energetic' },
        { code: 'parrot', name: 'Parrot', personalityType: 'ESFP', geniusType: 'creator', description: 'Enthusiastic & Creative' },
        { code: 'border-collie', name: 'Border Collie', personalityType: 'ENFJ', geniusType: 'advisor', description: 'Leadership & Goal-oriented' },
        // Additional animals mentioned in the avatar system
        { code: 'fox', name: 'Fox', personalityType: 'ENTP', geniusType: 'creator', description: 'Clever & Adaptable' },
        { code: 'bear', name: 'Bear', personalityType: 'ISTP', geniusType: 'guardian', description: 'Strong & Independent' },
        { code: 'wolf', name: 'Wolf', personalityType: 'ENTJ', geniusType: 'builder', description: 'Strategic & Determined' },
        { code: 'deer', name: 'Deer', personalityType: 'INFP', geniusType: 'creator', description: 'Gentle & Imaginative' },
        { code: 'penguin', name: 'Penguin', personalityType: 'ISFP', geniusType: 'guardian', description: 'Unique & Harmonious' },
        { code: 'horse', name: 'Horse', personalityType: 'ESTP', geniusType: 'builder', description: 'Active & Practical' },
        { code: 'dove', name: 'Dove', personalityType: 'INFJ', geniusType: 'advisor', description: 'Peaceful & Insightful' },
        { code: 'lion', name: 'Lion', personalityType: 'ESTJ', geniusType: 'builder', description: 'Confident & Protective' }
      ];
      
      for (const animal of animalData) {
        await tx.insert(animalTypes).values(animal);
      }
      
      console.log(`✅ Inserted ${animalData.length} animal types`);
      
      // ===== GENIUS TYPES =====
      console.log("\n📝 Populating genius_types...");
      
      // Clear existing data
      await tx.delete(geniusTypes);
      
      const geniusData = [
        { code: 'feeler', name: 'Feeler', description: 'Emotionally intelligent and empathetic' },
        { code: 'thinker', name: 'Thinker', description: 'Logical and analytical' },
        { code: 'intuitive', name: 'Intuitive', description: 'Creative and imaginative' },
        { code: 'sensor', name: 'Sensor', description: 'Practical and detail-oriented' },
        // The schema references these genius types
        { code: 'builder', name: 'Builder', description: 'Leadership and action-oriented' },
        { code: 'guardian', name: 'Guardian', description: 'Protective and responsible' },
        { code: 'advisor', name: 'Advisor', description: 'Wise and supportive' },
        { code: 'creator', name: 'Creator', description: 'Innovative and expressive' }
      ];
      
      for (const genius of geniusData) {
        await tx.insert(geniusTypes).values(genius);
      }
      
      console.log(`✅ Inserted ${geniusData.length} genius types`);
      
      // ===== ITEM TYPES =====
      console.log("\n📝 Populating item_types...");
      
      // Clear existing data
      await tx.delete(itemTypes);
      
      const itemData = [
        // Avatar items - Hats
        { code: 'explorer', name: 'Explorer Hat', category: 'avatar_hat', description: 'Safari/Explorer hat' },
        { code: 'safari', name: 'Safari Hat', category: 'avatar_hat', description: 'Khaki safari hat' },
        { code: 'wizard_hat', name: 'Wizard Hat', category: 'avatar_hat', description: 'Magical wizard hat' },
        { code: 'crown', name: 'Crown', category: 'avatar_hat', description: 'Royal crown' },
        { code: 'baseball_cap', name: 'Baseball Cap', category: 'avatar_hat', description: 'Sporty baseball cap' },
        
        // Avatar items - Glasses
        { code: 'greenblinds', name: 'Green Sunglasses', category: 'avatar_glasses', description: 'Cool green sunglasses' },
        { code: 'hearts', name: 'Heart Glasses', category: 'avatar_glasses', description: 'Heart-shaped glasses' },
        { code: 'star_glasses', name: 'Star Glasses', category: 'avatar_glasses', description: 'Star-shaped glasses' },
        { code: 'reading_glasses', name: 'Reading Glasses', category: 'avatar_glasses', description: 'Smart reading glasses' },
        
        // Avatar items - Accessories
        { code: 'bow_tie', name: 'Bow Tie', category: 'avatar_accessory', description: 'Fancy red bow tie' },
        { code: 'necklace', name: 'Pearl Necklace', category: 'avatar_accessory', description: 'Elegant pearl necklace' },
        { code: 'scarf', name: 'Scarf', category: 'avatar_accessory', description: 'Cozy scarf' },
        { code: 'bandana', name: 'Bandana', category: 'avatar_accessory', description: 'Cool bandana' },
        
        // Room items - Furniture
        { code: 'wooden_desk', name: 'Wooden Desk', category: 'room_furniture', description: 'Study desk' },
        { code: 'bookshelf', name: 'Bookshelf', category: 'room_furniture', description: 'Book storage' },
        { code: 'bean_bag', name: 'Bean Bag Chair', category: 'room_furniture', description: 'Comfy seating' },
        { code: 'gaming_chair', name: 'Gaming Chair', category: 'room_furniture', description: 'Pro gaming seat' },
        
        // Room items - Decorations
        { code: 'poster_space', name: 'Space Poster', category: 'room_decoration', description: 'Cool space poster' },
        { code: 'plant_cactus', name: 'Cactus Plant', category: 'room_decoration', description: 'Desert plant' },
        { code: 'lamp_lava', name: 'Lava Lamp', category: 'room_decoration', description: 'Groovy lava lamp' },
        { code: 'trophy', name: 'Trophy', category: 'room_decoration', description: 'Achievement trophy' },
        
        // Room items - Floor
        { code: 'rug_rainbow', name: 'Rainbow Rug', category: 'room_floor', description: 'Colorful floor rug' },
        { code: 'carpet_shag', name: 'Shag Carpet', category: 'room_floor', description: 'Soft shag carpet' },
        
        // Room items - Wallpaper
        { code: 'wallpaper_stars', name: 'Star Wallpaper', category: 'room_wallpaper', description: 'Night sky wallpaper' },
        { code: 'wallpaper_stripes', name: 'Striped Wallpaper', category: 'room_wallpaper', description: 'Classic stripes' }
      ];
      
      for (const item of itemData) {
        await tx.insert(itemTypes).values(item);
      }
      
      console.log(`✅ Inserted ${itemData.length} item types`);
      
      // Note: quiz_answer_types table doesn't exist in current schema
      
    });
    
    console.log("\n🎉 All lookup tables populated successfully!");
    
  } catch (error) {
    console.error("\n❌ Error populating lookup tables:", error);
    throw error;
  }
}

// Run the population
populateLookupTables()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
