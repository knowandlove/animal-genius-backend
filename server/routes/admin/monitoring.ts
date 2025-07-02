// @ts-nocheck
// Admin monitoring route - not critical for core functionality
import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import StorageRouter from '../../services/storage-router';

const router = Router();

/**
 * GET /api/admin/system-health
 * Comprehensive system health and monitoring endpoint
 */
router.get('/system-health', authenticateAdmin, async (req, res) => {
  try {
    // Get storage statistics
    const storageStats = await StorageRouter.getStorageStats();
    
    // Get bandwidth usage (if tracking is implemented)
    const bandwidthQuery = await db.execute(sql`
      SELECT * FROM get_monthly_bandwidth_stats()
    `);
    
    // Get cleanup queue status
    const cleanupStatus = await db.execute(sql`
      SELECT * FROM asset_cleanup_status
    `);
    
    // Get database connection info
    const connectionCount = await db.execute(sql`
      SELECT count(*) as connections 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    // Get index usage stats
    const indexStats = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
    `);
    
    // Check for missing indexes (tables with sequential scans)
    const missingIndexes = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        CASE 
          WHEN seq_scan > 0 
          THEN ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
          ELSE 0
        END as seq_scan_percentage
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND seq_scan > 1000
      ORDER BY seq_scan DESC
    `);
    
    const response = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      storage: {
        ...storageStats,
        cloudEnabled: StorageRouter.isCloudStorageEnabled()
      },
      bandwidth: {
        monthly: bandwidthQuery.rows || [],
        // Note: Real bandwidth tracking would need to be implemented
        // via Supabase webhooks or log processing
        trackingEnabled: false
      },
      cleanup: cleanupStatus.rows[0] || {
        total_queued: 0,
        ready_for_cleanup: 0,
        overdue_items: 0
      },
      database: {
        connections: connectionCount.rows[0]?.connections || 0,
        indexes: {
          usage: indexStats.rows || [],
          potentiallyMissing: missingIndexes.rows || []
        }
      },
      recommendations: generateRecommendations({
        storageStats,
        cleanupStatus: cleanupStatus.rows[0],
        missingIndexes: missingIndexes.rows
      })
    };
    
    res.json(response);
    
  } catch (error: any) {
    console.error('System health check error:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/storage-alerts
 * Get any active storage/bandwidth alerts
 */
router.get('/storage-alerts', authenticateAdmin, async (req, res) => {
  try {
    // Check for bandwidth alerts
    const bandwidthAlerts = await db.execute(sql`
      SELECT * FROM bandwidth_alerts
      WHERE alert_level IN ('HIGH', 'MEDIUM')
      ORDER BY date DESC
      LIMIT 10
    `);
    
    // Check cleanup queue
    const cleanupBacklog = await db.execute(sql`
      SELECT COUNT(*) as overdue_count
      FROM asset_cleanup_queue
      WHERE deleted_at < NOW() - INTERVAL '24 hours'
    `);
    
    const alerts = [];
    
    // Add bandwidth alerts
    bandwidthAlerts.rows.forEach((row: any) => {
      alerts.push({
        type: 'bandwidth',
        level: row.alert_level,
        message: `High bandwidth usage: ${row.daily_gb}GB on ${row.date}`,
        date: row.date,
        metadata: row
      });
    });
    
    // Add cleanup alerts
    const overdueCount = cleanupBacklog.rows[0]?.overdue_count || 0;
    if (overdueCount > 0) {
      alerts.push({
        type: 'cleanup',
        level: overdueCount > 100 ? 'HIGH' : 'MEDIUM',
        message: `${overdueCount} assets pending cleanup for over 24 hours`,
        date: new Date().toISOString(),
        metadata: { overdueCount }
      });
    }
    
    res.json({
      alerts,
      summary: {
        total: alerts.length,
        high: alerts.filter(a => a.level === 'HIGH').length,
        medium: alerts.filter(a => a.level === 'MEDIUM').length
      }
    });
    
  } catch (error: any) {
    console.error('Storage alerts error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * Generate recommendations based on system metrics
 */
function generateRecommendations(data: any): string[] {
  const recommendations = [];
  
  // Storage recommendations
  if (data.storageStats?.totalSize > 1073741824) { // > 1GB
    recommendations.push('Consider implementing image optimization to reduce storage costs');
  }
  
  // Cleanup recommendations
  if (data.cleanupStatus?.overdue_items > 0) {
    recommendations.push(`${data.cleanupStatus.overdue_items} assets are overdue for cleanup - implement automated cleanup job`);
  }
  
  // Index recommendations
  if (data.missingIndexes?.length > 0) {
    data.missingIndexes.forEach((table: any) => {
      if (table.seq_scan_percentage > 50) {
        recommendations.push(`Table '${table.tablename}' has ${table.seq_scan_percentage}% sequential scans - consider adding indexes`);
      }
    });
  }
  
  // General recommendations
  if (!StorageRouter.isCloudStorageEnabled()) {
    recommendations.push('Cloud storage is disabled - enable for better scalability');
  }
  
  return recommendations;
}

export default router;
