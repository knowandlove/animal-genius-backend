import { db } from '../server/db';
import { storeItems, itemTypes, assets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface StoreItemSeed {
  name: string;
  description: string;
  itemType: string;
  cost: number;
  rarity: 'common' | 'rare' | 'legendary';
  sortOrder: number;
  thumbnailUrl?: string;
  assetPath?: string;
}

// Comprehensive store inventory organized by category
const STORE_INVENTORY: StoreItemSeed[] = [
  // ========== AVATAR HATS ==========
  {
    name: 'Baseball Cap',
    description: 'A sporty cap for the athletic genius',
    itemType: 'avatar_hat',
    cost: 50,
    rarity: 'common',
    sortOrder: 100,
    assetPath: 'avatar/hats/baseball_cap.png'
  },
  {
    name: 'Wizard Hat',
    description: 'Channel your inner magic with this pointed hat adorned with stars',
    itemType: 'avatar_hat',
    cost: 150,
    rarity: 'rare',
    sortOrder: 101,
    assetPath: 'avatar/hats/wizard_hat.png'
  },
  {
    name: 'Crown',
    description: 'Rule your room with this majestic golden crown',
    itemType: 'avatar_hat',
    cost: 500,
    rarity: 'legendary',
    sortOrder: 102,
    assetPath: 'avatar/hats/crown.png'
  },
  {
    name: 'Safari Hat',
    description: 'Perfect for the adventurous explorer',
    itemType: 'avatar_hat',
    cost: 75,
    rarity: 'common',
    sortOrder: 103,
    assetPath: 'avatar/hats/safari_hat.png'
  },
  {
    name: 'Party Hat',
    description: 'Celebrate in style with this festive cone hat',
    itemType: 'avatar_hat',
    cost: 25,
    rarity: 'common',
    sortOrder: 104,
    assetPath: 'avatar/hats/party_hat.png'
  },

  // ========== AVATAR GLASSES ==========
  {
    name: 'Sunglasses',
    description: 'Cool shades for the coolest genius',
    itemType: 'avatar_glasses',
    cost: 60,
    rarity: 'common',
    sortOrder: 200,
    assetPath: 'avatar/glasses/sunglasses.png'
  },
  {
    name: 'Reading Glasses',
    description: 'For the studious and wise',
    itemType: 'avatar_glasses',
    cost: 40,
    rarity: 'common',
    sortOrder: 201,
    assetPath: 'avatar/glasses/reading_glasses.png'
  },
  {
    name: 'Heart Glasses',
    description: 'Show your love with these adorable heart-shaped frames',
    itemType: 'avatar_glasses',
    cost: 100,
    rarity: 'rare',
    sortOrder: 202,
    assetPath: 'avatar/glasses/heart_glasses.png'
  },
  {
    name: 'Star Glasses',
    description: 'Shine bright like a star with these unique frames',
    itemType: 'avatar_glasses',
    cost: 125,
    rarity: 'rare',
    sortOrder: 203,
    assetPath: 'avatar/glasses/star_glasses.png'
  },
  {
    name: 'VR Headset',
    description: 'Step into the future with this high-tech eyewear',
    itemType: 'avatar_glasses',
    cost: 300,
    rarity: 'legendary',
    sortOrder: 204,
    assetPath: 'avatar/glasses/vr_headset.png'
  },

  // ========== AVATAR ACCESSORIES ==========
  {
    name: 'Red Bow Tie',
    description: 'A classic and elegant accessory',
    itemType: 'avatar_accessory',
    cost: 35,
    rarity: 'common',
    sortOrder: 300,
    assetPath: 'avatar/accessories/red_bow_tie.png'
  },
  {
    name: 'Pearl Necklace',
    description: 'Timeless elegance with lustrous pearls',
    itemType: 'avatar_accessory',
    cost: 200,
    rarity: 'rare',
    sortOrder: 301,
    assetPath: 'avatar/accessories/pearl_necklace.png'
  },
  {
    name: 'Scarf',
    description: 'A cozy scarf to keep you warm and stylish',
    itemType: 'avatar_accessory',
    cost: 45,
    rarity: 'common',
    sortOrder: 302,
    assetPath: 'avatar/accessories/scarf.png'
  },
  {
    name: 'Gold Chain',
    description: 'Bling out with this shiny gold chain',
    itemType: 'avatar_accessory',
    cost: 250,
    rarity: 'rare',
    sortOrder: 303,
    assetPath: 'avatar/accessories/gold_chain.png'
  },
  {
    name: 'Cape',
    description: 'Every hero needs a flowing cape',
    itemType: 'avatar_accessory',
    cost: 400,
    rarity: 'legendary',
    sortOrder: 304,
    assetPath: 'avatar/accessories/cape.png'
  },

  // ========== ROOM FURNITURE ==========
  {
    name: 'Study Desk',
    description: 'A sturdy desk perfect for homework and projects',
    itemType: 'room_furniture',
    cost: 150,
    rarity: 'common',
    sortOrder: 400,
    assetPath: 'room/furniture/study_desk.png'
  },
  {
    name: 'Gaming Chair',
    description: 'Ultimate comfort for long study sessions',
    itemType: 'room_furniture',
    cost: 300,
    rarity: 'rare',
    sortOrder: 401,
    assetPath: 'room/furniture/gaming_chair.png'
  },
  {
    name: 'Bookshelf',
    description: 'Display your knowledge with this wooden bookshelf',
    itemType: 'room_furniture',
    cost: 125,
    rarity: 'common',
    sortOrder: 402,
    assetPath: 'room/furniture/bookshelf.png'
  },
  {
    name: 'Bean Bag',
    description: 'Relax in style with this comfy bean bag chair',
    itemType: 'room_furniture',
    cost: 100,
    rarity: 'common',
    sortOrder: 403,
    assetPath: 'room/furniture/bean_bag.png'
  },
  {
    name: 'Arcade Machine',
    description: 'Bring the arcade to your room!',
    itemType: 'room_furniture',
    cost: 750,
    rarity: 'legendary',
    sortOrder: 404,
    assetPath: 'room/furniture/arcade_machine.png'
  },

  // ========== ROOM DECORATIONS ==========
  {
    name: 'Potted Plant',
    description: 'Add some green to your space',
    itemType: 'room_decoration',
    cost: 30,
    rarity: 'common',
    sortOrder: 500,
    assetPath: 'room/decorations/potted_plant.png'
  },
  {
    name: 'Wall Clock',
    description: 'Always know what time it is',
    itemType: 'room_decoration',
    cost: 60,
    rarity: 'common',
    sortOrder: 501,
    assetPath: 'room/decorations/wall_clock.png'
  },
  {
    name: 'Lava Lamp',
    description: 'Groovy lighting for your room',
    itemType: 'room_decoration',
    cost: 120,
    rarity: 'rare',
    sortOrder: 502,
    assetPath: 'room/decorations/lava_lamp.png'
  },
  {
    name: 'Trophy Shelf',
    description: 'Display your achievements with pride',
    itemType: 'room_decoration',
    cost: 175,
    rarity: 'rare',
    sortOrder: 503,
    assetPath: 'room/decorations/trophy_shelf.png'
  },
  {
    name: 'Disco Ball',
    description: 'Turn your room into a dance floor!',
    itemType: 'room_decoration',
    cost: 350,
    rarity: 'legendary',
    sortOrder: 504,
    assetPath: 'room/decorations/disco_ball.png'
  },

  // ========== ROOM WALLPAPERS ==========
  {
    name: 'Sky Blue',
    description: 'A calming blue wallpaper',
    itemType: 'room_wallpaper',
    cost: 50,
    rarity: 'common',
    sortOrder: 600,
    assetPath: 'room/wallpapers/sky_blue.png'
  },
  {
    name: 'Space Theme',
    description: 'Explore the cosmos from your room',
    itemType: 'room_wallpaper',
    cost: 150,
    rarity: 'rare',
    sortOrder: 601,
    assetPath: 'room/wallpapers/space_theme.png'
  },
  {
    name: 'Jungle Vines',
    description: 'Transform your room into a jungle',
    itemType: 'room_wallpaper',
    cost: 125,
    rarity: 'common',
    sortOrder: 602,
    assetPath: 'room/wallpapers/jungle_vines.png'
  },
  {
    name: 'Rainbow Stripes',
    description: 'Brighten your room with colorful stripes',
    itemType: 'room_wallpaper',
    cost: 100,
    rarity: 'common',
    sortOrder: 603,
    assetPath: 'room/wallpapers/rainbow_stripes.png'
  },
  {
    name: 'Galaxy Swirl',
    description: 'A mesmerizing galaxy pattern',
    itemType: 'room_wallpaper',
    cost: 400,
    rarity: 'legendary',
    sortOrder: 604,
    assetPath: 'room/wallpapers/galaxy_swirl.png'
  },

  // ========== ROOM FLOORING ==========
  {
    name: 'Wooden Floor',
    description: 'Classic hardwood flooring',
    itemType: 'room_flooring',
    cost: 75,
    rarity: 'common',
    sortOrder: 700,
    assetPath: 'room/flooring/wooden_floor.png'
  },
  {
    name: 'Carpet',
    description: 'Soft and cozy carpet flooring',
    itemType: 'room_flooring',
    cost: 100,
    rarity: 'common',
    sortOrder: 701,
    assetPath: 'room/flooring/carpet.png'
  },
  {
    name: 'Checkerboard',
    description: 'Classic black and white pattern',
    itemType: 'room_flooring',
    cost: 125,
    rarity: 'rare',
    sortOrder: 702,
    assetPath: 'room/flooring/checkerboard.png'
  },
  {
    name: 'Grass',
    description: 'Bring the outdoors inside',
    itemType: 'room_flooring',
    cost: 150,
    rarity: 'rare',
    sortOrder: 703,
    assetPath: 'room/flooring/grass.png'
  },
  {
    name: 'Cloud Floor',
    description: 'Walk on clouds with this magical flooring',
    itemType: 'room_flooring',
    cost: 450,
    rarity: 'legendary',
    sortOrder: 704,
    assetPath: 'room/flooring/cloud_floor.png'
  }
];

async function seedStoreItems() {
  console.log('🛍️ Seeding store items...\n');

  try {
    // Wrap everything in a transaction for consistency
    await db.transaction(async (tx) => {
      // Get item type IDs
      const itemTypesList = await tx.select().from(itemTypes);
      const itemTypeMap = new Map(itemTypesList.map(it => [it.code, it.id]));

      console.log('Available item types:', Array.from(itemTypeMap.keys()).join(', '));

      // Fetch all existing item names in a single query to avoid N+1
      const existingItems = await tx.select({ name: storeItems.name }).from(storeItems);
      const existingItemNames = new Set(existingItems.map(item => item.name));
      console.log(`Found ${existingItemNames.size} existing items in the database.`);

      let created = 0;
      let skipped = 0;

      for (const seedItem of STORE_INVENTORY) {
        const itemTypeId = itemTypeMap.get(seedItem.itemType);
        
        if (!itemTypeId) {
          console.warn(`⚠️ Unknown item type: ${seedItem.itemType} for ${seedItem.name}`);
          continue;
        }

        // Check if item already exists using in-memory set
        if (existingItemNames.has(seedItem.name)) {
          console.log(`⏭️  Skipped: ${seedItem.name} (already exists)`);
          skipped++;
          continue;
        }

        // Create placeholder asset for now
        // In production, these would be real uploaded assets
        const assetId = randomUUID();
        const placeholderAsset = {
          id: assetId,
          fileName: `${seedItem.name.toLowerCase().replace(/\s+/g, '_')}.png`,
          fileType: 'image/png',
          fileSize: 1024,
          publicUrl: `https://placehold.co/512x512/random/white?text=${encodeURIComponent(seedItem.name)}`,
          category: seedItem.itemType.split('_')[0], // 'avatar' or 'room'
          bucket: 'store-items',
          path: seedItem.assetPath || `placeholder/${seedItem.itemType}/${seedItem.name.toLowerCase().replace(/\s+/g, '_')}.png`,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Create asset record
        await tx.insert(assets).values(placeholderAsset);

        // Create store item
        const storeItem = {
          id: randomUUID(),
          name: seedItem.name,
          description: seedItem.description,
          itemTypeId: itemTypeId,
          cost: seedItem.cost,
          rarity: seedItem.rarity,
          isActive: true,
          sortOrder: seedItem.sortOrder,
          assetId: assetId,
          thumbnailUrl: seedItem.thumbnailUrl || `https://placehold.co/128x128/random/white?text=${encodeURIComponent(seedItem.name)}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await tx.insert(storeItems).values(storeItem);
        console.log(`✅ Created: ${seedItem.name} (${seedItem.itemType}) - ${seedItem.cost} coins [${seedItem.rarity}]`);
        created++;
      }

      console.log(`\n📊 Summary:`);
      console.log(`- Total items: ${STORE_INVENTORY.length}`);
      console.log(`- Created: ${created}`);
      console.log(`- Skipped: ${skipped}`);
    });

    console.log(`\n✨ Store seeding complete!`);

  } catch (error) {
    console.error('❌ Error seeding store items:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedStoreItems()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedStoreItems, STORE_INVENTORY };