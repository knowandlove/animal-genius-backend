import { config } from 'dotenv';
// Load environment variables at the top
config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

// Debug: Check if DATABASE_URL is set
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Determine if in production
const isProduction = process.env.NODE_ENV === 'production';

// Get the base connection string
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Append sslmode for production to ensure a secure and reliable connection to Supabase
const connectionString = isProduction ? `${dbUrl}?sslmode=require` : dbUrl;

// Create pool with the modified connection string
export const pool = new Pool({ 
  connectionString: connectionString,
  // SSL object removed - sslmode in connection string handles this better
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

// Add error handling for pool
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle(pool, { schema });
