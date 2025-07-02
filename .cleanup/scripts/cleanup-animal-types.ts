import { config } from "dotenv";
import { db } from "../server/db";
import { animalTypes, students, quizSubmissions, itemAnimalPositions } from "../shared/schema";
import { inArray, eq } from "drizzle-orm";

// Load environment variables
config();

async function cleanupAnimalTypes() {
  console.log("🧹 Starting Animal Types Cleanup...\n");
  
  try {
    // Define the animals to remove
    const animalsToRemove = ['dolphin', 'wolf', 'lion', 'fox'];
    
    // Get the IDs of animals to remove
    const animalsToDelete = await db
      .select()
      .from(animalTypes)
      .where(inArray(animalTypes.code, animalsToRemove));
    
    if (animalsToDelete.length === 0) {
      console.log("✅ No extra animals found to remove!");
      process.exit(0);
    }
    
    const idsToDelete = animalsToDelete.map(a => a.id);
    
    console.log(`Found ${animalsToDelete.length} animals to remove:`);
    animalsToDelete.forEach(animal => {
      console.log(`   - ${animal.name} (${animal.code})`);
    });
    
    // Check if any students have these animal types
    console.log("\n🔍 Checking for students with these animal types...");
    const affectedStudents = await db
      .select()
      .from(students)
      .where(inArray(students.animalTypeId, idsToDelete));
    
    if (affectedStudents.length > 0) {
      console.log(`\n⚠️  WARNING: Found ${affectedStudents.length} students with these animal types!`);
      console.log("These students would need to be updated first.");
      console.log("\nAffected students:");
      affectedStudents.forEach(student => {
        const animal = animalsToDelete.find(a => a.id === student.animalTypeId);
        console.log(`   - ${student.studentName} has animal type: ${animal?.name}`);
      });
      
      console.log("\n❌ Cannot proceed with cleanup. Please handle these students first.");
      process.exit(1);
    }
    
    // Check for quiz submissions
    console.log("\n🔍 Checking for quiz submissions with these animal types...");
    const affectedSubmissions = await db
      .select()
      .from(quizSubmissions)
      .where(inArray(quizSubmissions.animalTypeId, idsToDelete));
    
    if (affectedSubmissions.length > 0) {
      console.log(`\n⚠️  WARNING: Found ${affectedSubmissions.length} quiz submissions with these animal types!`);
      console.log("❌ Cannot proceed with cleanup. Please handle these submissions first.");
      process.exit(1);
    }
    
    // Check for item positions
    console.log("\n🔍 Checking for item positions with these animal types...");
    const affectedPositions = await db
      .select()
      .from(itemAnimalPositions)
      .where(inArray(itemAnimalPositions.animalTypeId, idsToDelete));
    
    console.log(`Found ${affectedPositions.length} item positions to remove.`);
    
    // Perform the cleanup
    console.log("\n🗑️  Starting deletion process...");
    
    await db.transaction(async (tx) => {
      // Delete item positions first
      if (affectedPositions.length > 0) {
        await tx
          .delete(itemAnimalPositions)
          .where(inArray(itemAnimalPositions.animalTypeId, idsToDelete));
        console.log(`✅ Deleted ${affectedPositions.length} item positions`);
      }
      
      // Delete the animal types
      await tx
        .delete(animalTypes)
        .where(inArray(animalTypes.id, idsToDelete));
      console.log(`✅ Deleted ${animalsToDelete.length} animal types`);
    });
    
    // Verify cleanup
    console.log("\n🔍 Verifying cleanup...");
    const remainingAnimals = await db.select().from(animalTypes);
    console.log(`\n✅ Cleanup complete! Now have ${remainingAnimals.length} animal types:`);
    remainingAnimals.forEach((animal, index) => {
      console.log(`${index + 1}. ${animal.name} (${animal.code})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Add confirmation prompt
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("⚠️  This will remove the following animal types from the database:");
console.log("   - Dolphin");
console.log("   - Wolf");
console.log("   - Lion");
console.log("   - Fox");
console.log("\nThis action cannot be undone!");

rl.question('\nDo you want to proceed? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    rl.close();
    cleanupAnimalTypes();
  } else {
    console.log("\n❌ Cleanup cancelled.");
    rl.close();
    process.exit(0);
  }
});
