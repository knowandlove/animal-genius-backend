import { db } from "../server/db";
import { storeItems, assets, itemTypes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from 'crypto';

console.log("\n🏪 Populating store with items...\n");

// First, create some assets
const assetData = [
  { id: randomUUID(), fileName: 'explorer_hat.png', fileType: 'image/png', fileSize: 1024, storagePath: 'avatar-items/hats/explorer_hat.png', publicUrl: 'https://example.com/avatar-items/hats/explorer_hat.png', category: 'avatar' },
  { id: randomUUID(), fileName: 'safari_hat.png', fileType: 'image/png', fileSize: 1024, storagePath: 'avatar-items/hats/safari_hat.png', publicUrl: 'https://example.com/avatar-items/hats/safari_hat.png', category: 'avatar' },
  { id: randomUUID(), fileName: 'green_sunglasses.png', fileType: 'image/png', fileSize: 1024, storagePath: 'avatar-items/glasses/green_sunglasses.png', publicUrl: 'https://example.com/avatar-items/glasses/green_sunglasses.png', category: 'avatar' },
  { id: randomUUID(), fileName: 'heart_glasses.png', fileType: 'image/png', fileSize: 1024, storagePath: 'avatar-items/glasses/heart_glasses.png', publicUrl: 'https://example.com/avatar-items/glasses/heart_glasses.png', category: 'avatar' },
  { id: randomUUID(), fileName: 'bow_tie.png', fileType: 'image/png', fileSize: 1024, storagePath: 'avatar-items/accessories/bow_tie.png', publicUrl: 'https://example.com/avatar-items/accessories/bow_tie.png', category: 'avatar' },
  { id: randomUUID(), fileName: 'necklace.png', fileType: 'image/png', fileSize: 1024, storagePath: 'avatar-items/accessories/necklace.png', publicUrl: 'https://example.com/avatar-items/accessories/necklace.png', category: 'avatar' }
];

// Insert assets
console.log("Creating assets...");
for (const asset of assetData) {
  await db.insert(assets).values(asset).onConflictDoNothing();
}

// Get item type IDs from the database
console.log("Looking up item types...");
const itemTypeMap = new Map();

// Get all item types
const allItemTypes = await db.select().from(itemTypes);

// Create a map for easy lookup
allItemTypes.forEach(type => itemTypeMap.set(type.code, type.id));

console.log("Available item types:", Array.from(itemTypeMap.keys()));
console.log("Item types details:", allItemTypes.map(t => ({ code: t.code, name: t.name, category: t.category })));

// Now create store items linked to these assets and item types
const items = [
  {
    id: randomUUID(),
    name: 'Explorer Hat',
    description: 'A rugged hat for adventurers',
    itemTypeId: itemTypeMap.get('avatar_hat'),
    cost: 100,
    rarity: 'common',
    isActive: true,
    sortOrder: 1,
    assetId: assetData[0].id
  },
  {
    id: randomUUID(),
    name: 'Safari Hat', 
    description: 'Perfect for wildlife watching',
    itemTypeId: itemTypeMap.get('avatar_hat'),
    cost: 150,
    rarity: 'common',
    isActive: true,
    sortOrder: 2,
    assetId: assetData[1].id
  },
  {
    id: randomUUID(),
    name: 'Green Sunglasses',
    description: 'Cool shades for sunny days',
    itemTypeId: itemTypeMap.get('avatar_glasses'),
    cost: 75,
    rarity: 'common',
    isActive: true,
    sortOrder: 3,
    assetId: assetData[2].id
  },
  {
    id: randomUUID(),
    name: 'Heart Glasses',
    description: 'Show your love with style',
    itemTypeId: itemTypeMap.get('avatar_glasses'),
    cost: 100,
    rarity: 'rare',
    isActive: true,
    sortOrder: 4,
    assetId: assetData[3].id
  },
  {
    id: randomUUID(),
    name: 'Red Bow Tie',
    description: 'A classy accessory',
    itemTypeId: itemTypeMap.get('avatar_accessory'),
    cost: 50,
    rarity: 'common',
    isActive: true,
    sortOrder: 5,
    assetId: assetData[4].id
  },
  {
    id: randomUUID(),
    name: 'Pearl Necklace',
    description: 'Elegant and timeless',
    itemTypeId: itemTypeMap.get('avatar_accessory'),
    cost: 200,
    rarity: 'rare',
    isActive: true,
    sortOrder: 6,
    assetId: assetData[5].id
  }
].filter(item => item.itemTypeId); // Only include items where we found the itemTypeId

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
