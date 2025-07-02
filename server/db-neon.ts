import { config } from 'dotenv';
// Load environment variables at the top
config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket for Neon in development  
// @ts-ignore - window doesn't exist in Node
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws;
  // Disable SSL verification for local development with Railway
  neonConfig.fetchConnectionCache = true;
  neonConfig.wsProxy = (host) => `${host}?sslmode=disable`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
}

// Configure Neon for better connection handling
neonConfig.fetchConnectionCache = true;

// Debug: Check if DATABASE_URL is set
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool with improved configuration for Neon
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced pool size for serverless
  idleTimeoutMillis: 10000, // Shorter idle timeout
  connectionTimeoutMillis: 5000, // Longer connection timeout
  maxUses: 7500, // Limit connection reuse
  allowExitOnIdle: false,
});

// Add error handling for pool
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle({ client: pool, schema });