#!/usr/bin/env tsx
/**
 * Script to run the avatar data backfill
 * Usage: npm run backfill:avatar
 */

import { backfillAvatarData } from "./server/migrations/update-avatar-routes";

console.log('Starting avatar data backfill process...');
console.log('This will sync studentInventory data to avatarData column');
console.log('---');

backfillAvatarData()
  .then(() => {
    console.log('\n✅ Backfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });