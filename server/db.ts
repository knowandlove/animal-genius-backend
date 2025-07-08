import { config } from 'dotenv';
// Load environment variables at the top
config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";
import { CONFIG } from './config/constants';

// Debug: Check if DATABASE_URL is set
if (process.env.NODE_ENV === 'development') {
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('SSL validation enabled:', process.env.DATABASE_URL?.includes('supabase.co') || process.env.NODE_ENV === 'production');
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure SSL based on environment
// For Supabase connections, we need SSL but may need to handle certificate validation
const sslConfig = process.env.DATABASE_URL?.includes('supabase.co')
  ? {
      // Supabase requires SSL connection
      rejectUnauthorized: process.env.NODE_ENV === 'production' 
        ? false // In production, Supabase may use certificates that Node.js doesn't recognize
        : process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
    }
  : process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true } // Non-Supabase production databases should validate certs
    : false; // No SSL for local development

// Create pool with SSL configuration
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: CONFIG.DATABASE.POOL_MAX,
  min: CONFIG.DATABASE.POOL_MIN,
  idleTimeoutMillis: CONFIG.DATABASE.IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONFIG.DATABASE.CONNECTION_TIMEOUT_MS,
  acquireTimeoutMillis: CONFIG.DATABASE.ACQUIRE_TIMEOUT_MS,
});

// Add error handling for pool
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  
  // Provide helpful error messages for common SSL issues
  if (err.message?.includes('self signed certificate') || 
      err.message?.includes('unable to verify') ||
      err.message?.includes('certificate')) {
    console.error('\n⚠️  SSL Certificate Error Detected!');
    console.error('This usually means the database SSL certificate cannot be validated.');
    console.error('For production, ensure you\'re connecting to a database with valid SSL certificates.');
    console.error('\nIf this is a development environment with a self-signed certificate,');
    console.error('you may need to temporarily set NODE_TLS_REJECT_UNAUTHORIZED=0');
    console.error('but NEVER do this in production!\n');
  }
});

// Connection pool monitoring for classroom load
pool.on('connect', (client) => {
  console.log(`🔗 New client connected. Pool: ${pool.totalCount}/${pool.options.max} connections`);
});

pool.on('acquire', (client) => {
  const waiting = pool.waitingCount;
  if (waiting > 0) {
    console.warn(`⏳ Connection acquired. ${waiting} requests waiting in queue`);
  }
});

// Import cleanup utilities if available
let dbMonitorInterval: NodeJS.Timeout;

// Log pool stats every 30 seconds during operation
const monitorDbPool = () => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: pool.options.max
  };
  
  // Only log if there's activity or near capacity
  if (stats.total > 5 || stats.waiting > 0) {
    console.log(`📊 DB Pool Stats:`, stats);
  }
  
  // Warning if pool is getting full
  if (stats.total > (stats.max * 0.8)) {
    console.warn(`⚠️ Database pool at ${Math.round((stats.total/stats.max)*100)}% capacity!`);
  }
};

// Use managed interval if available, fallback to regular interval
if (process.env.NODE_ENV !== 'test') {
  import('./lib/resource-cleanup').then(({ createManagedInterval }) => {
    dbMonitorInterval = createManagedInterval(monitorDbPool, 30000, 'db-pool-monitor');
  }).catch(() => {
    // Fallback to regular interval
    dbMonitorInterval = setInterval(monitorDbPool, 30000);
  });
}

export const db = drizzle(pool, { schema });
