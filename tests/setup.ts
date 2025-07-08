import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '../server/db';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret';

// Clean up database before and after tests
beforeAll(async () => {
  // Optional: Run migrations if needed
  console.log('Test setup initialized');
});

afterAll(async () => {
  // Clean up connections
  console.log('Test cleanup completed');
});

beforeEach(async () => {
  // Optional: Reset specific tables if needed
});

afterEach(async () => {
  // Optional: Clean up test data
});