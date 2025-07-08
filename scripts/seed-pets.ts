import { db } from '../server/db.js';
import { pets } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function seedPets() {
  try {
    console.log('Checking for existing pets...');
    
    // Check if pets already exist
    const existingPets = await db.select().from(pets);
    
    if (existingPets.length > 0) {
      console.log(`Pets already exist (${existingPets.length} found). Skipping seed.`);
      process.exit(0);
    }
    
    console.log('No pets found. Inserting seed data...');
    
    // Insert seed pets
    const seedData = [
      {
        species: 'space_cat',
        name: 'Cosmic Cat',
        description: 'A mystical feline from the stars',
        assetUrl: '/assets/pets/space_cat.png',
        cost: 100,
        rarity: 'common' as const,
        sortOrder: 1,
        baseStats: { hungerDecayRate: 0.42, happinessDecayRate: 0.625 }
      },
      {
        species: 'code_dog',
        name: 'Digital Dog',
        description: 'A loyal companion who loves algorithms',
        assetUrl: '/assets/pets/code_dog.png',
        cost: 150,
        rarity: 'common' as const,
        sortOrder: 2,
        baseStats: { hungerDecayRate: 0.42, happinessDecayRate: 0.625 }
      },
      {
        species: 'math_monkey',
        name: 'Math Monkey',
        description: 'A clever primate who excels at calculations',
        assetUrl: '/assets/pets/math_monkey.png',
        cost: 200,
        rarity: 'uncommon' as const,
        sortOrder: 3,
        baseStats: { hungerDecayRate: 0.35, happinessDecayRate: 0.5 }
      }
    ];
    
    await db.insert(pets).values(seedData);
    
    console.log('✅ Successfully inserted 3 seed pets!');
    
    // Verify insertion
    const allPets = await db.select().from(pets);
    console.log('\nCurrent pets in database:');
    allPets.forEach(pet => {
      console.log(`- ${pet.name} (${pet.species}) - ${pet.cost} coins - ${pet.rarity}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding pets:', error);
    process.exit(1);
  }
}

seedPets();