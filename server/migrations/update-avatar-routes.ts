/**
 * Migration to update avatar routes to also save to avatarData column
 * This ensures dual-write for backward compatibility
 */

import { db } from "../db";
import { students, studentInventory } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Updated avatar save function that performs dual writes
 * Updates both studentInventory table and avatarData column
 */
export async function saveAvatarDataDualWrite(
  studentId: number, 
  passportCode: string,
  equipped: Record<string, string | undefined>
) {
  await db.transaction(async (tx) => {
    // 1. Update studentInventory table (existing logic)
    // First, unequip all items
    await tx
      .update(studentInventory)
      .set({ isEquipped: false })
      .where(eq(studentInventory.studentId, studentId));
    
    // Then equip the specified items
    const equippedItemIds = Object.values(equipped || {}).filter(Boolean) as string[];
    for (const itemId of equippedItemIds) {
      await tx
        .update(studentInventory)
        .set({ isEquipped: true })
        .where(
          and(
            eq(studentInventory.studentId, studentId),
            eq(studentInventory.storeItemId, itemId)
          )
        );
    }
    
    // 2. Also update avatarData column for consistency
    await tx
      .update(students)
      .set({
        avatarData: {
          equipped: equipped || {},
          // Preserve any other avatar data that might exist
          ...(await tx
            .select({ avatarData: students.avatarData })
            .from(students)
            .where(eq(students.id, studentId))
            .limit(1)
            .then(res => res[0]?.avatarData || {})),
          equipped: equipped || {}
        }
      })
      .where(eq(students.id, studentId));
  });
}

/**
 * Backfill script to sync existing studentInventory data to avatarData column
 */
export async function backfillAvatarData() {
  console.log('Starting avatar data backfill...');
  
  // Get all students
  const allStudents = await db
    .select({
      id: students.id,
      passportCode: students.passportCode
    })
    .from(students);
  
  console.log(`Found ${allStudents.length} students to process`);
  
  let processed = 0;
  const batchSize = 100;
  
  // Process in batches
  for (let i = 0; i < allStudents.length; i += batchSize) {
    const batch = allStudents.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (student) => {
      // Get equipped items from studentInventory
      const equippedItems = await db
        .select({
          storeItemId: studentInventory.storeItemId,
          itemType: studentInventory.itemType
        })
        .from(studentInventory)
        .where(
          and(
            eq(studentInventory.studentId, student.id),
            eq(studentInventory.isEquipped, true)
          )
        );
      
      // Convert to equipped object format
      const equipped: Record<string, string> = {};
      for (const item of equippedItems) {
        // Map item types to slots
        const slot = mapItemTypeToSlot(item.itemType);
        if (slot) {
          equipped[slot] = item.storeItemId;
        }
      }
      
      // Update avatarData column
      await db
        .update(students)
        .set({
          avatarData: {
            equipped,
            // Preserve owned items list if it exists
            owned: await getOwnedItemIds(student.id)
          }
        })
        .where(eq(students.id, student.id));
    }));
    
    processed += batch.length;
    console.log(`Processed ${processed}/${allStudents.length} students`);
  }
  
  console.log('Avatar data backfill complete!');
}

function mapItemTypeToSlot(itemType: string): string | null {
  // Map item types to avatar slots
  const typeToSlot: Record<string, string> = {
    'avatar_hat': 'hat',
    'avatar_glasses': 'glasses',
    'avatar_accessory': 'accessory',
    'avatar_neckwear': 'neckwear',
    'avatar_held': 'held'
  };
  
  return typeToSlot[itemType] || null;
}

async function getOwnedItemIds(studentId: number): Promise<string[]> {
  const owned = await db
    .select({ storeItemId: studentInventory.storeItemId })
    .from(studentInventory)
    .where(eq(studentInventory.studentId, studentId));
  
  return owned.map(item => item.storeItemId);
}

// Run backfill if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillAvatarData()
    .then(() => {
      console.log('Backfill completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backfill failed:', error);
      process.exit(1);
    });
}