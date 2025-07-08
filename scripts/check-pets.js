import { db } from '../server/db.js';
import { pets } from '../shared/schema.js';

async function checkPets() {
  try {
    console.log('Checking pets in database...');
    const allPets = await db.select().from(pets);
    
    console.log(`Found ${allPets.length} pets:`);
    allPets.forEach(pet => {
      console.log(`- ${pet.name} (${pet.species}) - ${pet.cost} coins - ${pet.rarity}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking pets:', error);
    process.exit(1);
  }
}

checkPets();