import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { insertStoreItemSchema } from './shared/schema';
import { z } from 'zod';

config();

async function testSchema() {
  console.log('=== TESTING STORE ITEM SCHEMA ===\n');
  
  // Test data with assetId
  const testData = {
    name: 'Test Item',
    description: 'Test description',
    itemType: 'avatar_hat',
    cost: 100,
    imageUrl: 'https://example.com/test.png',
    assetId: 'test-asset-id-123',
    rarity: 'common',
    isActive: true,
    sortOrder: 0
  };
  
  console.log('Test data:', testData);
  console.log('\nRunning schema validation...\n');
  
  try {
    const validated = insertStoreItemSchema.parse(testData);
    console.log('Validated data:', validated);
    console.log('\nDoes validated data have assetId?', !!validated.assetId);
    console.log('assetId value:', validated.assetId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation failed:', error.errors);
    } else {
      console.error('Error:', error);
    }
  }
  
  // Also test the schema shape
  console.log('\n=== SCHEMA SHAPE ===');
  console.log('Schema fields:', Object.keys(insertStoreItemSchema.shape));
  console.log('Has assetId in shape?', 'assetId' in insertStoreItemSchema.shape);
  
  process.exit(0);
}

testSchema();
