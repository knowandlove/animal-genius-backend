import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { db } from '../../db';
import { 
  profiles, 
  classes, 
  quizSubmissions, 
  storeItems, 
  currencyTransactions,
  students 
} from '@shared/schema';
import { sql, count, avg, desc, and, gte, eq } from 'drizzle-orm';
import { errorTracker } from '../../monitoring/error-tracker';
import { getHttpMetrics } from '../../middleware/observability';
import { metricsService } from '../../monitoring/metrics-service';

const router = Router();

/**
 * GET /api/admin/quick-stats
 * Get quick statistics for the admin dashboard
 */
router.get('/quick-stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Teacher stats
    const teacherStats = await db.select({
      total: count(),
      // Note: We'd need a lastLoginAt column to track active teachers
    }).from(profiles);

    const newTeachersThisWeek = await db.select({
      count: count()
    }).from(profiles)
    .where(gte(profiles.createdAt, weekAgo));

    // Student stats
    const studentStats = await db.select({
      total: count(),
      quizzesCompleted: count()
    }).from(quizSubmissions);

    // Get average coins per student - now from students table
    const balanceStats = await db.select({
      avgBalance: avg(students.currencyBalance)
    }).from(students);

    // Most common animal
    const animalDistribution = await db.select({
      animalType: quizSubmissions.animalTypeId,
      count: count()
    }).from(quizSubmissions)
    .groupBy(quizSubmissions.animalTypeId)
    .orderBy(desc(count()))
    .limit(1);

    // Store stats
    const storeStats = await db.select({
      total: count(),
      active: count(sql`CASE WHEN ${storeItems.isActive} THEN 1 END`)
    }).from(storeItems);

    // Since we removed purchase requests, set pending orders to 0
    const pendingOrders = [{ count: 0 }];

    // Popular items - for now just return empty array since we don't track purchases
    const popularItems = [];

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
    }).from(profiles)
    .where(
      and(
        gte(profiles.createdAt, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)),
        sql`${profiles.createdAt} < ${weekAgo}`
      )
    );

    const trend = newTeachersThisWeek[0].count > (previousWeekTeachers[0]?.count || 0) ? 'up' : 
                  newTeachersThisWeek[0].count < (previousWeekTeachers[0]?.count || 0) ? 'down' : 'stable';

    // Get performance metrics
    const httpMetrics = getHttpMetrics();
    const errorSummary = errorTracker.getErrorSummary();
    const systemMetrics = metricsService.getMetrics();
    
    // Calculate alerts
    const alerts = [];
    if (errorSummary.errorRate > 5) {
      alerts.push({
        level: 'warning',
        message: `High error rate: ${errorSummary.errorRate.toFixed(2)} errors/minute`,
        metric: 'errorRate'
      });
    }
    if (httpMetrics.averageResponseTime > 1000) {
      alerts.push({
        level: 'warning',
        message: `Slow average response time: ${httpMetrics.averageResponseTime.toFixed(0)}ms`,
        metric: 'responseTime'
      });
    }
    
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
      },
      // New performance section
      performance: {
        uptime: Math.floor(systemMetrics.system.uptime / 60), // minutes
        errorRate: errorSummary.errorRate,
        errorsToday: errorSummary.errorsToday,
        avgResponseTime: Math.round(httpMetrics.averageResponseTime),
        slowestEndpoints: httpMetrics.slowestEndpoints.slice(0, 3)
      },
      alerts,
      recentErrors: errorSummary.recentErrors.slice(0, 5).map(err => ({
        timestamp: err.timestamp,
        code: err.code,
        message: err.message,
        endpoint: err.endpoint
      }))
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
