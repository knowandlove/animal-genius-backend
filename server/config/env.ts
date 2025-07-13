import { z } from 'zod';
import { config } from 'dotenv';

// Load environment variables
config();

// Define the schema for environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server configuration
  PORT: z.coerce.number().int().positive().default(5001),
  
  // Database
  DATABASE_URL: z.string().url().min(1, "DATABASE_URL is required"),
  
  // Supabase configuration
  SUPABASE_URL: z.string().url().min(1, "SUPABASE_URL is required"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_KEY: z.string().min(1, "SUPABASE_SERVICE_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required").optional(), // Alias for SUPABASE_SERVICE_KEY
  
  // JWT configuration (optional - only for legacy auth migration)
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),
  
  // Student authentication (deprecated - will be removed after Custom JWT implementation)
  STUDENT_PASSWORD_SALT: z.string().min(16, "STUDENT_PASSWORD_SALT must be at least 16 characters").optional(),
  
  // Optional configurations
  FRONTEND_URL: z.string().url().optional(),
  APP_VERSION: z.string().optional(),
  
  // Metrics
  METRICS_ENABLED: z.string().transform(val => val !== 'false').default('true'),
});

// Parse and validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    console.error('\nPlease check your .env file and ensure all required variables are set correctly.');
    process.exit(1);
  }
  throw error;
}

// Export validated environment variables
export { env };

// Type for the validated environment
export type ValidatedEnv = typeof env;