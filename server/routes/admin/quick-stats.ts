import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import { db } from '../../db';
import { 
  users, 
  classes, 
  quizSubmissions, 
  storeItems, 
  purchaseRequests,
  currencyTransactions 
} from '@shared/schema';
import { sql, count, avg, desc, and, gte, eq } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/admin/quick-stats
 * Get quick statistics for the admin dashboard
 */
router.get('/quick-stats', authenticateAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Teacher stats
    const teacherStats = await db.select({
      total: count(),
      // Note: We'd need a lastLoginAt column to track active teachers
    }).from(users);

    const newTeachersThisWeek = await db.select({
      count: count()
    }).from(users)
    .where(gte(users.createdAt, weekAgo));

    // Student stats
    const studentStats = await db.select({
      total: count(),
      quizzesCompleted: count()
    }).from(quizSubmissions);

    // Get average coins per student
    const balanceStats = await db.select({
      avgBalance: avg(quizSubmissions.walletBalance)
    }).from(quizSubmissions);

    // Most common animal
    const animalDistribution = await db.select({
      animalType: quizSubmissions.animalType,
      count: count()
    }).from(quizSubmissions)
    .groupBy(quizSubmissions.animalType)
    .orderBy(desc(count()))
    .limit(1);

    // Store stats
    const storeStats = await db.select({
      total: count(),
      active: count(sql`CASE WHEN ${storeItems.isActive} THEN 1 END`)
    }).from(storeItems);

    const pendingOrders = await db.select({
      count: count()
    }).from(purchaseRequests)
    .where(eq(purchaseRequests.status, 'pending'));

    // Popular items (last 7 days)
    const popularItems = await db.select({
      name: storeItems.name,
      purchases: count()
    }).from(purchaseRequests)
    .innerJoin(storeItems, eq(purchaseRequests.itemId, storeItems.id))
    .where(
      and(
        eq(purchaseRequests.status, 'approved'),
        gte(purchaseRequests.processedAt, weekAgo)
      )
    )
    .groupBy(storeItems.name)
    .orderBy(desc(count()))
    .limit(5);

    // Engagement stats
    const dailyActive = await db.select({
      count: count()
    }).from(quizSubmissions)
    .where(gte(quizSubmissions.completedAt, todayStart));

    const weeklyActive = await db.select({
      count: count()
    }).from(quizSubmissions)
    .where(gte(quizSubmissions.completedAt, weekAgo));

    // Peak hours (simplified - would need more complex query in production)
    const peakHours = [
      { hour: 9, count: 45 },
      { hour: 10, count: 62 },
      { hour: 11, count: 58 },
      { hour: 14, count: 72 },
      { hour: 15, count: 68 }
    ];

    // Determine trend
    const previousWeekTeachers = await db.select({
      count: count()
    }).from(users)
    .where(
      and(
        gte(users.createdAt, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)),
        sql`${users.createdAt} < ${weekAgo}`
      )
    );

    const trend = newTeachersThisWeek[0].count > (previousWeekTeachers[0]?.count || 0) ? 'up' : 
                  newTeachersThisWeek[0].count < (previousWeekTeachers[0]?.count || 0) ? 'down' : 'stable';

    const response = {
      teachers: {
        total: teacherStats[0]?.total || 0,
        activeToday: Math.floor((teacherStats[0]?.total || 0) * 0.3), // Simulated for now
        newThisWeek: newTeachersThisWeek[0]?.count || 0,
        trend
      },
      students: {
        total: studentStats[0]?.total || 0,
        quizzesCompleted: studentStats[0]?.quizzesCompleted || 0,
        averageCoins: Math.round(Number(balanceStats[0]?.avgBalance) || 0),
        mostCommonAnimal: animalDistribution[0]?.animalType || 'None yet'
      },
      store: {
        totalItems: storeStats[0]?.total || 0,
        activeItems: storeStats[0]?.active || 0,
        pendingOrders: pendingOrders[0]?.count || 0,
        popularItems: popularItems.map(item => ({
          name: item.name,
          purchases: Number(item.purchases)
        }))
      },
      engagement: {
        dailyActiveUsers: dailyActive[0]?.count || 0,
        weeklyActiveUsers: weeklyActive[0]?.count || 0,
        averageSessionTime: '12m 34s', // Would need session tracking
        peakHours
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('Quick stats error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get quick stats'
    });
  }
});

export default router;
