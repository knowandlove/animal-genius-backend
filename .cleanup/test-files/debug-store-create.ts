import { config } from 'dotenv';
import { insertStoreItemSchema } from './shared/schema';

config();

// Test the schema validation
const testPayload = {
  name: "Test Hat",
  description: "A test hat",
  itemType: "avatar_hat",
  cost: 100,
  imageUrl: "https://example.com/test.png",
  assetId: "test-asset-id-123",
  rarity: "common",
  isActive: true,
  sortOrder: 0
};

console.log('=== TESTING STORE ITEM SCHEMA VALIDATION ===\n');
console.log('Input payload:', JSON.stringify(testPayload, null, 2));

try {
  const validated = insertStoreItemSchema.parse(testPayload);
  console.log('\nValidated output:', JSON.stringify(validated, null, 2));
  console.log('\nFields in validated output:', Object.keys(validated));
  console.log('Has assetId?', 'assetId' in validated);
  console.log('assetId value:', validated.assetId);
} catch (error) {
  console.error('Validation error:', error);
}

// Check the schema shape
console.log('\n=== SCHEMA INSPECTION ===');
console.log('Schema shape keys:', Object.keys(insertStoreItemSchema.shape));
console.log('assetId field definition:', insertStoreItemSchema.shape.assetId);
