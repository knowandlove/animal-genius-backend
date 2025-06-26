// Teacher Purchase Approval Routes
import type { Express } from "express";
import { db } from "../db";
import { purchaseRequests, quizSubmissions, currencyTransactions, classes, storeItems, students } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

// Approval schema
const approvalSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'deny']),
  reason: z.string().optional()
});

export function registerPurchaseApprovalRoutes(app: Express) {
  
  // Get pending purchase requests for a class
  app.get("/api/classes/:classId/purchase-requests", requireAuth, async (req, res) => {
    try {
      const { classId } = req.params;
      const userId = req.user?.userId || req.user?.id; // Support both userId and id
      
      // Verify teacher owns this class
      const classData = await db
        .select()
        .from(classes)
        .where(
          and(
            eq(classes.id, classId),
            eq(classes.teacherId, userId!)
          )
        )
        .limit(1);

      if (classData.length === 0) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all purchase requests for students in this class
      const requests = await db
        .select({
          id: purchaseRequests.id,
          studentId: purchaseRequests.studentId,
          studentName: students.studentName,
          studentBalance: students.currencyBalance,
          passportCode: students.passportCode,
          animalType: students.animalType,
          avatarData: students.avatarData,
          itemType: purchaseRequests.itemType,
          itemId: purchaseRequests.itemId,
          cost: purchaseRequests.cost,
          status: purchaseRequests.status,
          requestedAt: purchaseRequests.requestedAt,
          processedAt: purchaseRequests.processedAt
        })
        .from(purchaseRequests)
        .innerJoin(students, eq(purchaseRequests.studentId, students.id))
        .where(
          and(
            eq(students.classId, classId),
            eq(purchaseRequests.status, 'pending')
          )
        )
        .orderBy(desc(purchaseRequests.requestedAt));

      if (requests.length === 0) {
        return res.json([]);
      }

      // Collect all unique item IDs from the requests
      const itemIds = [...new Set(requests.map(r => r.itemId))];

      // Fetch all item details in a single query
      const itemDetailsList = await db
        .select()
        .from(storeItems)
        .where(inArray(storeItems.id, itemIds));

      // Create a lookup map for quick access
      const itemDetailsMap = new Map(itemDetailsList.map(item => [item.id, item]));

      // Map requests to include item details (in memory, no more DB calls)
      const requestsWithItems = requests.map(request => {
        const dbItem = itemDetailsMap.get(request.itemId);
        return {
          ...request,
          itemName: dbItem?.name || 'Unknown Item',
          itemDescription: dbItem?.description || 'Item not found in store',
          itemRarity: dbItem?.rarity || 'common',
          balanceAfterPurchase: (request.studentBalance || 0) - request.cost
        };
      });

      res.json(requestsWithItems);
    } catch (error) {
      console.error("Get purchase requests error:", error);
      res.status(500).json({ message: "Failed to get purchase requests" });
    }
  });

  // Approve or deny a purchase request
  app.post("/api/purchase-requests/process", requireAuth, async (req, res) => {
    try {
      const { requestId, action, reason } = approvalSchema.parse(req.body);
      const teacherId = req.user?.userId || req.user?.id;

      // Get the purchase request and verify it belongs to teacher's class
      const requestData = await db
        .select({
          request: purchaseRequests,
          studentId: purchaseRequests.studentId,
          studentBalance: students.currencyBalance,
          classId: students.classId,
          studentName: students.studentName
        })
        .from(purchaseRequests)
        .innerJoin(students, eq(purchaseRequests.studentId, students.id))
        .innerJoin(classes, eq(students.classId, classes.id))
        .where(
          and(
            eq(purchaseRequests.id, requestId),
            eq(classes.teacherId, teacherId!),
            eq(purchaseRequests.status, 'pending')
          )
        )
        .limit(1);

      if (requestData.length === 0) {
        return res.status(404).json({ message: "Purchase request not found or already processed" });
      }

      const { request, studentId, studentBalance, studentName } = requestData[0];

      // Start transaction
      await db.transaction(async (tx) => {
        // Update purchase request status
        await tx
          .update(purchaseRequests)
          .set({
            status: action === 'approve' ? 'approved' : 'denied',
            processedAt: new Date(),
            processedBy: teacherId
          })
          .where(eq(purchaseRequests.id, requestId));

        // If approved, deduct currency and update student balance
        if (action === 'approve') {
          // Check balance again in transaction
          if ((studentBalance || 0) < request.cost) {
            throw new Error("Insufficient funds");
          }

          // Update student balance and add item to avatarData
          const currentStudent = await tx
            .select({ avatarData: students.avatarData })
            .from(students)
            .where(eq(students.id, studentId))
            .limit(1);
          
          const currentAvatarData = currentStudent[0]?.avatarData || {};
          const currentOwnedItems = currentAvatarData.owned || [];
          
          console.log(`[APPROVAL DEBUG] Student ${studentId}:`);
          console.log('  - Current avatarData:', JSON.stringify(currentAvatarData));
          console.log('  - Current owned items:', currentOwnedItems);
          console.log('  - Adding item:', request.itemId);
          
          // Create new array to ensure Drizzle detects the change
          const newOwnedItems = currentOwnedItems.includes(request.itemId)
            ? currentOwnedItems
            : [...currentOwnedItems, request.itemId];
          
          console.log('  - New owned items:', newOwnedItems);
          
          const updateData = {
            currencyBalance: (studentBalance || 0) - request.cost,
            avatarData: {
              ...currentAvatarData,
              owned: newOwnedItems
            }
          };
          
          console.log('  - Update data:', JSON.stringify(updateData));
          
          const updateResult = await tx
            .update(students)
            .set(updateData)
            .where(eq(students.id, studentId))
            .returning();
            
          console.log('  - Update result:', updateResult?.[0]?.avatarData);

          // Create currency transaction record
          // Get item name from database for transaction record
          const itemData = await tx
            .select({ name: storeItems.name })
            .from(storeItems)
            .where(eq(storeItems.id, request.itemId))
            .limit(1);
          
          const itemName = itemData[0]?.name || request.itemId;
          
          await tx
            .insert(currencyTransactions)
            .values({
              studentId: studentId,
              teacherId: teacherId!,
              amount: -request.cost, // Negative for purchases
              reason: `Purchase: ${itemName}`,
              transactionType: 'purchase'
            });
        }
      });
      
      console.log('[APPROVAL DEBUG] Transaction completed successfully');

      const message = action === 'approve' 
        ? `Approved ${studentName}'s purchase request`
        : `Denied ${studentName}'s purchase request`;

      res.json({ message, success: true });
    } catch (error) {
      console.error("Process purchase request error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process request";
      res.status(500).json({ message: errorMessage });
    }
  });

  // Bulk approve/deny purchase requests
  app.post("/api/purchase-requests/bulk-process", requireAuth, async (req, res) => {
    try {
      const { requestIds, action } = z.object({
        requestIds: z.array(z.string().uuid()),
        action: z.enum(['approve', 'deny'])
      }).parse(req.body);
      
      const teacherId = req.user?.userId || req.user?.id;
      
      // Process each request
      const results = await Promise.allSettled(
        requestIds.map(async (requestId) => {
          // Use the same logic as single approval
          const requestData = await db
            .select({
              request: purchaseRequests,
              studentId: purchaseRequests.studentId,
              studentBalance: students.currencyBalance,
              classId: students.classId,
              studentName: students.studentName
            })
            .from(purchaseRequests)
            .innerJoin(students, eq(purchaseRequests.studentId, students.id))
            .innerJoin(classes, eq(students.classId, classes.id))
            .where(
              and(
                eq(purchaseRequests.id, requestId),
                eq(classes.teacherId, teacherId!),
                eq(purchaseRequests.status, 'pending')
              )
            )
            .limit(1);

          if (requestData.length === 0) {
            throw new Error(`Request ${requestId} not found`);
          }

          const { request, studentId, studentBalance, studentName } = requestData[0];

          await db.transaction(async (tx) => {
            await tx
              .update(purchaseRequests)
              .set({
                status: action === 'approve' ? 'approved' : 'denied',
                processedAt: new Date(),
                processedBy: teacherId
              })
              .where(eq(purchaseRequests.id, requestId));

            if (action === 'approve') {
              if ((studentBalance || 0) < request.cost) {
                throw new Error(`Insufficient funds for ${studentName}`);
              }

              // Update balance and add item to avatarData
              const currentStudent = await tx
                .select({ avatarData: students.avatarData })
                .from(students)
                .where(eq(students.id, studentId))
                .limit(1);
              
              const currentAvatarData = currentStudent[0]?.avatarData || {};
              const currentOwnedItems = currentAvatarData.owned || [];
              
              // Create new array to ensure Drizzle detects the change
              const newOwnedItems = currentOwnedItems.includes(request.itemId)
                ? currentOwnedItems
                : [...currentOwnedItems, request.itemId];
              
              await tx
                .update(students)
                .set({
                  currencyBalance: (studentBalance || 0) - request.cost,
                  avatarData: {
                    ...currentAvatarData,
                    owned: newOwnedItems
                  }
                })
                .where(eq(students.id, studentId));

              // Get item name from database for transaction record
              const itemData = await tx
                .select({ name: storeItems.name })
                .from(storeItems)
                .where(eq(storeItems.id, request.itemId))
                .limit(1);
              
              const itemName = itemData[0]?.name || request.itemId;
              
              await tx
                .insert(currencyTransactions)
                .values({
                  studentId: studentId,
                  teacherId: teacherId!,
                  amount: -request.cost,
                  reason: `Purchase: ${itemName}`,
                  transactionType: 'purchase'
                });
            }
          });

          return { requestId, success: true, studentName };
        })
      );

      // Count successes and failures
      const processed = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      res.json({
        message: `Processed ${processed} requests successfully${failed > 0 ? `, ${failed} failed` : ''}`,
        processed,
        failed,
        results
      });
    } catch (error) {
      console.error("Bulk process error:", error);
      res.status(500).json({ message: "Failed to process requests" });
    }
  });
}
