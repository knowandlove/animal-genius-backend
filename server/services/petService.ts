import { db } from "../db";
import { pets, studentPets, petInteractions, students, currencyTransactions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { Pet, StudentPet, NewStudentPet, NewPetInteraction } from "@shared/schema";

export interface PetStats {
  hunger: number;
  happiness: number;
}

export interface PetState {
  state: 'happy' | 'neutral' | 'sad';
  displayName: string;
}

/**
 * Calculate the current state of a pet based on time elapsed
 */
export function calculatePetState(
  currentStats: PetStats,
  lastInteractionAt: Date,
  decayRates: { hungerDecayRate: number; happinessDecayRate: number }
): PetStats {
  const now = new Date();
  const hoursElapsed = (now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60);
  
  // Calculate decay
  const hungerDecay = Math.min(100, hoursElapsed * decayRates.hungerDecayRate);
  const happinessDecay = Math.min(100, hoursElapsed * decayRates.happinessDecayRate);
  
  // Apply decay and clamp to valid range
  const newHunger = Math.max(0, Math.min(100, currentStats.hunger - hungerDecay));
  const newHappiness = Math.max(0, Math.min(100, currentStats.happiness - happinessDecay));
  
  return {
    hunger: Math.round(newHunger),
    happiness: Math.round(newHappiness)
  };
}

/**
 * Determine the pet's visual state based on stats
 */
export function getPetVisualState(stats: PetStats): PetState['state'] {
  const avgStat = (stats.hunger + stats.happiness) / 2;
  
  if (avgStat >= 80) return 'happy';
  if (avgStat >= 40) return 'neutral';
  return 'sad';
}

/**
 * Get all available pets from the catalog
 */
export async function getAvailablePets(): Promise<Pet[]> {
  return await db
    .select()
    .from(pets)
    .where(eq(pets.isActive, true))
    .orderBy(pets.sortOrder);
}

/**
 * Get a student's pet with calculated current state
 */
export async function getStudentPet(studentId: string): Promise<(StudentPet & { 
  pet: Pet; 
  calculatedStats: PetStats;
  visualState: PetState['state'];
}) | null> {
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
  
  // Calculate current state
  const calculatedStats = calculatePetState(
    { hunger: result.studentPet.hunger, happiness: result.studentPet.happiness },
    result.studentPet.lastInteractionAt,
    result.pet.baseStats as { hungerDecayRate: number; happinessDecayRate: number }
  );
  
  const visualState = getPetVisualState(calculatedStats);
  
  return {
    ...result.studentPet,
    pet: result.pet,
    calculatedStats,
    visualState
  };
}

/**
 * Purchase a pet for a student
 */
export async function purchasePet(
  studentId: string, 
  petId: string, 
  customName: string
): Promise<{ success: boolean; error?: string; studentPet?: StudentPet }> {
  try {
    return await db.transaction(async (tx) => {
      // Check if student already has a pet (MVP: one pet per student)
      const existingPet = await tx
        .select()
        .from(studentPets)
        .where(eq(studentPets.studentId, studentId))
        .limit(1);
        
      if (existingPet.length > 0) {
        return { success: false, error: "Student already has a pet" };
      }
      
      // Get pet details
      const [pet] = await tx
        .select()
        .from(pets)
        .where(eq(pets.id, petId))
        .limit(1);
        
      if (!pet || !pet.isActive) {
        return { success: false, error: "Pet not found or unavailable" };
      }
      
      // Check student balance
      const [student] = await tx
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);
        
      if (!student || student.currencyBalance === null || student.currencyBalance < pet.cost) {
        return { success: false, error: "Insufficient balance" };
      }
      
      // Deduct coins
      await tx
        .update(students)
        .set({ 
          currencyBalance: sql`${students.currencyBalance} - ${pet.cost}`,
          updatedAt: new Date()
        })
        .where(eq(students.id, studentId));
      
      // Create pet instance
      const [newPet] = await tx
        .insert(studentPets)
        .values({
          studentId,
          petId,
          customName
        })
        .returning();
      
      // Log transaction
      await tx.insert(currencyTransactions).values({
        studentId,
        amount: -pet.cost,
        transactionType: 'purchase',
        description: `Purchased pet: ${pet.name}`
      });
      
      return { success: true, studentPet: newPet };
    });
  } catch (error) {
    console.error('Error purchasing pet:', error);
    return { success: false, error: "Failed to purchase pet" };
  }
}

/**
 * Interact with a pet (feed, play, pet)
 */
export async function interactWithPet(
  studentPetId: string,
  interactionType: 'feed' | 'play' | 'pet',
  studentId: string
): Promise<{ success: boolean; error?: string; newStats?: PetStats }> {
  const interactionEffects = {
    feed: { hunger: 30, happiness: 0, cost: 5 },
    play: { hunger: 0, happiness: 20, cost: 0 },
    pet: { hunger: 0, happiness: 10, cost: 0 }
  };
  
  const effect = interactionEffects[interactionType];
  
  try {
    return await db.transaction(async (tx) => {
      // Get current pet state
      const whereConditions = studentId === 'teacher-override' 
        ? eq(studentPets.id, studentPetId)  // Teachers can interact with any pet
        : and(
            eq(studentPets.id, studentPetId),
            eq(studentPets.studentId, studentId)  // Students can only interact with their own pets
          );
      
      const [petData] = await tx
        .select({
          studentPet: studentPets,
          pet: pets,
          student: students
        })
        .from(studentPets)
        .innerJoin(pets, eq(studentPets.petId, pets.id))
        .innerJoin(students, eq(studentPets.studentId, students.id))
        .where(whereConditions)
        .limit(1);
        
      if (!petData) {
        return { success: false, error: "Pet not found" };
      }
      
      // Check balance for feed interaction (skip for teachers)
      if (studentId !== 'teacher-override' && effect.cost > 0 && (petData.student.currencyBalance === null || petData.student.currencyBalance < effect.cost)) {
        return { success: false, error: "Insufficient balance" };
      }
      
      // Calculate current state
      const currentStats = calculatePetState(
        { hunger: petData.studentPet.hunger, happiness: petData.studentPet.happiness },
        petData.studentPet.lastInteractionAt,
        petData.pet.baseStats as { hungerDecayRate: number; happinessDecayRate: number }
      );
      
      // Apply interaction effects
      const newStats: PetStats = {
        hunger: Math.min(100, currentStats.hunger + effect.hunger),
        happiness: Math.min(100, currentStats.happiness + effect.happiness)
      };
      
      // Update pet stats
      await tx
        .update(studentPets)
        .set({
          hunger: newStats.hunger,
          happiness: newStats.happiness,
          lastInteractionAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(studentPets.id, studentPetId));
      
      // Deduct coins if needed (skip for teachers)
      if (studentId !== 'teacher-override' && effect.cost > 0) {
        await tx
          .update(students)
          .set({ 
            currencyBalance: sql`${students.currencyBalance} - ${effect.cost}`,
            updatedAt: new Date()
          })
          .where(eq(students.id, petData.student.id));
          
        await tx.insert(currencyTransactions).values({
          studentId: petData.student.id,
          amount: -effect.cost,
          transactionType: 'purchase',
          description: `Fed pet: ${petData.studentPet.customName}`
        });
      }
      
      // Log interaction
      await tx.insert(petInteractions).values({
        studentPetId,
        interactionType,
        hungerBefore: currentStats.hunger,
        happinessBefore: currentStats.happiness,
        hungerAfter: newStats.hunger,
        happinessAfter: newStats.happiness,
        coinsCost: effect.cost
      });
      
      return { success: true, newStats };
    });
  } catch (error) {
    console.error('Error interacting with pet:', error);
    return { success: false, error: "Failed to interact with pet" };
  }
}

/**
 * Update pet position in room
 */
export async function updatePetPosition(
  studentPetId: string,
  studentId: string,
  position: { x: number; y: number }
): Promise<boolean> {
  try {
    const result = await db
      .update(studentPets)
      .set({ 
        position,
        updatedAt: new Date()
      })
      .where(and(
        eq(studentPets.id, studentPetId),
        eq(studentPets.studentId, studentId)
      ));
      
    return true;
  } catch (error) {
    console.error('Error updating pet position:', error);
    return false;
  }
}

/**
 * Rename a pet
 */
export async function renamePet(
  studentPetId: string,
  studentId: string,
  newName: string
): Promise<boolean> {
  try {
    await db
      .update(studentPets)
      .set({ 
        customName: newName,
        updatedAt: new Date()
      })
      .where(and(
        eq(studentPets.id, studentPetId),
        eq(studentPets.studentId, studentId)
      ));
      
    return true;
  } catch (error) {
    console.error('Error renaming pet:', error);
    return false;
  }
}