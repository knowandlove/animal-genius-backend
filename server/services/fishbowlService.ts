import { db } from "../db";
import { pets, studentPets, students } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';

// Fish color variants for random selection
const FISH_VARIANTS = [
  { name: 'Goldie', color: 'goldfish', primaryColor: '#FF6B35' },
  { name: 'Bluey', color: 'bluefish', primaryColor: '#4A90E2' },
  { name: 'Pinky', color: 'pinkfish', primaryColor: '#FF69B4' },
  { name: 'Greenie', color: 'greenfish', primaryColor: '#50C878' },
];

/**
 * Create a fish pet for a student when they purchase a fishbowl
 * This is called within the store purchase transaction
 */
export async function createFishForStudent(
  tx: any, // Transaction object from store-direct.ts
  studentId: string
): Promise<{ petId: string; fishName: string; fishColor: string }> {
  try {
    // Check if student already has a pet (shouldn't happen with fishbowl system)
    const existingPet = await tx
      .select()
      .from(studentPets)
      .where(eq(studentPets.studentId, studentId))
      .limit(1);
      
    if (existingPet.length > 0) {
      throw new Error("Student already has a pet");
    }
    
    // First, ensure we have a fish pet type in the catalog
    let [fishPetType] = await tx
      .select()
      .from(pets)
      .where(eq(pets.species, 'goldfish'))
      .limit(1);
    
    if (!fishPetType) {
      // Create the fish pet type if it doesn't exist
      const fishPetId = uuidv4();
      [fishPetType] = await tx
        .insert(pets)
        .values({
          id: fishPetId,
          species: 'goldfish',
          name: 'Pet Fish',
          description: 'A friendly fish that lives in a bowl',
          assetUrl: 'fishbowl', // Special marker for fishbowl pets
          cost: 0, // Cost is handled by the fishbowl item
          rarity: 'common',
          baseStats: {
            hungerDecayRate: 2, // points per hour
            happinessDecayRate: 3 // points per hour
          },
          isActive: true,
          sortOrder: 1000
        })
        .returning();
    }
    
    // Select a random fish variant
    const variant = FISH_VARIANTS[Math.floor(Math.random() * FISH_VARIANTS.length)];
    
    // Create the student's pet
    const [newPet] = await tx
      .insert(studentPets)
      .values({
        studentId,
        petId: fishPetType.id,
        customName: variant.name,
        hunger: 80,
        happiness: 80,
        position: { x: 50, y: 50 }, // Center of room
        // Store variant data for future Rive integration
        variantData: {
          color: variant.color,
          primaryColor: variant.primaryColor,
          riveArtboard: variant.color // Will map to Rive artboard names
        }
      })
      .returning();
    
    return {
      petId: newPet.id,
      fishName: variant.name,
      fishColor: variant.color
    };
  } catch (error) {
    console.error('Error creating fish for student:', error);
    throw error;
  }
}

/**
 * Get the pet ID associated with a fishbowl placement
 * This is used when clicking on a fishbowl to get the pet data
 */
export async function getFishbowlPet(studentId: string): Promise<any | null> {
  const [result] = await db
    .select({
      studentPet: studentPets,
      pet: pets
    })
    .from(studentPets)
    .innerJoin(pets, eq(studentPets.petId, pets.id))
    .where(eq(studentPets.studentId, studentId))
    .limit(1);
    
  if (!result) return null;
  
  // Calculate current state (reuse logic from petService)
  const now = new Date();
  const hoursElapsed = (now.getTime() - result.studentPet.lastInteractionAt.getTime()) / (1000 * 60 * 60);
  
  const baseStats = result.pet.baseStats as { hungerDecayRate: number; happinessDecayRate: number };
  const hungerDecay = Math.min(100, hoursElapsed * baseStats.hungerDecayRate);
  const happinessDecay = Math.min(100, hoursElapsed * baseStats.happinessDecayRate);
  
  const calculatedStats = {
    hunger: Math.max(0, Math.min(100, result.studentPet.hunger - hungerDecay)),
    happiness: Math.max(0, Math.min(100, result.studentPet.happiness - happinessDecay))
  };
  
  return {
    ...result.studentPet,
    pet: result.pet,
    calculatedStats,
    variantData: result.studentPet.variantData || {}
  };
}