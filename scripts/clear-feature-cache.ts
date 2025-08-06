import { getCache } from '../server/lib/cache-factory.js';

async function clearFeatureCache() {
  try {
    const cache = getCache();
    await cache.del('feature-flag:garden_system');
    console.log('✅ Feature flag cache cleared');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearFeatureCache();