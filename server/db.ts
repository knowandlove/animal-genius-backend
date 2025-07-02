import { config } from 'dotenv';
// Load environment variables at the top
config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

// Debug: Check if DATABASE_URL is set
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure SSL based on environment
// For Supabase, SSL is required in production but the certificate is managed by them
const sslConfig = process.env.NODE_ENV === 'production' 
  ? {
      rejectUnauthorized: false, // Supabase uses self-signed certificates
      // If you have a CA certificate from Supabase, you can use:
      // ca: fs.readFileSync('./path/to/ca-certificate.crt').toString(),
    }
  : false; // No SSL for local development

// Create pool with SSL configuration
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: 25, // Increased for 20-30 concurrent users + buffer
  min: 5,  // Maintain minimum connections for quick response
  idleTimeoutMillis: 30000, // Increased idle timeout
  connectionTimeoutMillis: 8000, // Slightly increased timeout
  acquireTimeoutMillis: 10000, // Max wait time for acquiring connection
});

// Add error handling for pool
pool.on('error', (err) => {
  console.error('Database pool error:', err);
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

// Log pool stats every 30 seconds during operation
setInterval(() => {
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
}, 30000);

export const db = drizzle(pool, { schema });
