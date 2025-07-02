import { config } from "dotenv";
import { db } from "../server/db";
import { animalTypes } from "../shared/schema";

// Load environment variables
config();

async function checkAnimalTypes() {
  console.log("🔍 Checking animal types in database...\n");
  
  try {
    // Get all animal types
    const allAnimals = await db.select().from(animalTypes);
    
    console.log(`Found ${allAnimals.length} animal types:\n`);
    
    // List all animals
    allAnimals.forEach((animal, index) => {
      console.log(`${index + 1}. Code: "${animal.code}", Name: "${animal.name}"`);
    });
    
    // Define the correct 8 animals based on your documentation
    const correctAnimals = [
      'meerkat',
      'panda', 
      'owl',
      'beaver',
      'elephant',
      'otter',
      'parrot',
      'border-collie'
    ];
    
    console.log("\n✅ Expected animals (8 total):");
    correctAnimals.forEach(code => console.log(`   - ${code}`));
    
    // Find extras
    const extraAnimals = allAnimals.filter(animal => 
      !correctAnimals.includes(animal.code)
    );
    
    if (extraAnimals.length > 0) {
      console.log("\n❌ Extra animals found that should be removed:");
      extraAnimals.forEach(animal => {
        console.log(`   - Code: "${animal.code}", Name: "${animal.name}", ID: ${animal.id}`);
      });
      
      console.log("\n⚠️  To fix this, run: npm run cleanup:animal-types");
    } else {
      console.log("\n✅ No extra animals found!");
    }
    
    // Find missing
    const existingCodes = allAnimals.map(a => a.code);
    const missingAnimals = correctAnimals.filter(code => 
      !existingCodes.includes(code)
    );
    
    if (missingAnimals.length > 0) {
      console.log("\n❌ Missing animals that should be added:");
      missingAnimals.forEach(code => console.log(`   - ${code}`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error checking animal types:", error);
    process.exit(1);
  }
}

checkAnimalTypes();
