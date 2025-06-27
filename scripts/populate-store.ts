import { db } from "../server/db";
import { storeItems, assets } from "@shared/schema";
import { v4 as uuidv4 } from 'uuid';

console.log("\n🏪 Populating store with items...\n");

// First, create some assets
const assetData = [
  { id: uuidv4(), fileName: 'explorer_hat.png', fileType: 'image/png', fileSize: 1024, bucketName: 'avatar-items', bucketPath: 'hats/explorer_hat.png' },
  { id: uuidv4(), fileName: 'safari_hat.png', fileType: 'image/png', fileSize: 1024, bucketName: 'avatar-items', bucketPath: 'hats/safari_hat.png' },
  { id: uuidv4(), fileName: 'green_sunglasses.png', fileType: 'image/png', fileSize: 1024, bucketName: 'avatar-items', bucketPath: 'glasses/green_sunglasses.png' },
  { id: uuidv4(), fileName: 'heart_glasses.png', fileType: 'image/png', fileSize: 1024, bucketName: 'avatar-items', bucketPath: 'glasses/heart_glasses.png' },
  { id: uuidv4(), fileName: 'bow_tie.png', fileType: 'image/png', fileSize: 1024, bucketName: 'avatar-items', bucketPath: 'accessories/bow_tie.png' },
  { id: uuidv4(), fileName: 'necklace.png', fileType: 'image/png', fileSize: 1024, bucketName: 'avatar-items', bucketPath: 'accessories/necklace.png' }
];

// Insert assets
console.log("Creating assets...");
for (const asset of assetData) {
  await db.insert(assets).values(asset).onConflictDoNothing();
}

// Now create store items linked to these assets
const items = [
  {
    id: uuidv4(),
    name: 'Explorer Hat',
    description: 'A rugged hat for adventurers',
    itemType: 'avatar_hat',
    cost: 100,
    rarity: 'common',
    isActive: true,
    sortOrder: 1,
    assetId: assetData[0].id
  },
  {
    id: uuidv4(),
    name: 'Safari Hat', 
    description: 'Perfect for wildlife watching',
    itemType: 'avatar_hat',
    cost: 150,
    rarity: 'common',
    isActive: true,
    sortOrder: 2,
    assetId: assetData[1].id
  },
  {
    id: uuidv4(),
    name: 'Green Sunglasses',
    description: 'Cool shades for sunny days',
    itemType: 'avatar_glasses',
    cost: 75,
    rarity: 'common',
    isActive: true,
    sortOrder: 3,
    assetId: assetData[2].id
  },
  {
    id: uuidv4(),
    name: 'Heart Glasses',
    description: 'Show your love with style',
    itemType: 'avatar_glasses',
    cost: 100,
    rarity: 'rare',
    isActive: true,
    sortOrder: 4,
    assetId: assetData[3].id
  },
  {
    id: uuidv4(),
    name: 'Red Bow Tie',
    description: 'A classy accessory',
    itemType: 'avatar_accessory',
    cost: 50,
    rarity: 'common',
    isActive: true,
    sortOrder: 5,
    assetId: assetData[4].id
  },
  {
    id: uuidv4(),
    name: 'Pearl Necklace',
    description: 'Elegant and timeless',
    itemType: 'avatar_accessory',
    cost: 200,
    rarity: 'rare',
    isActive: true,
    sortOrder: 6,
    assetId: assetData[5].id
  }
];

// Insert store items
console.log("\nCreating store items...");
for (const item of items) {
  await db.insert(storeItems).values(item).onConflictDoNothing();
}

console.log("\n✅ Store populated with", items.length, "items!");

// Display what was created
const finalItems = await db.select().from(storeItems);
console.log("\nStore now contains:");
finalItems.forEach(item => {
  console.log(`- ${item.name} (${item.itemType}) - ${item.cost} coins`);
});

process.exit(0);
