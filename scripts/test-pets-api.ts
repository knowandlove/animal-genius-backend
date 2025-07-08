import { db } from '../server/db.js';
import { pets } from '../shared/schema.js';

async function testPetsApi() {
  try {
    console.log('Testing pets API...\n');
    
    // 1. Check database directly
    const allPets = await db.select().from(pets);
    console.log(`✅ Database has ${allPets.length} pets:`);
    allPets.forEach(pet => {
      console.log(`   - ${pet.name} (${pet.species}) - ${pet.cost} coins`);
    });
    
    // 2. Test the API endpoint
    console.log('\n📡 Testing API endpoint...');
    const response = await fetch('http://localhost:5001/api/pets/catalog');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ API returned ${data.length} pets`);
    } else {
      const text = await response.text();
      console.log(`   ❌ API error:`, text.substring(0, 100));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPetsApi();