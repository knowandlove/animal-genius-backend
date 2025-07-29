import { config } from 'dotenv';

// Load environment variables
config();

// Define the schema for environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Server configuration
  PORT: z.coerce.number().int().positive().default(5001),
  
  // Database - must be a valid PostgreSQL URL
  DATABASE_URL: z.string()
    .url()
    .min(1, "DATABASE_URL is required")
    .refine(val => val.startsWith('postgresql://') || val.startsWith('postgres://'), 
      'DATABASE_URL must be a valid PostgreSQL connection string'),
  
  // Supabase configuration with enhanced validation
  SUPABASE_URL: z.string()
    .url()
    .min(1, "SUPABASE_URL is required")
    .refine(val => val.includes('supabase.co') || process.env.NODE_ENV === 'development',
      'SUPABASE_URL should be a valid Supabase URL'),
  SUPABASE_ANON_KEY: z.string()
    .min(40, "SUPABASE_ANON_KEY appears to be invalid - should be a JWT token"),
  SUPABASE_SERVICE_KEY: z.string()
    .min(40, "SUPABASE_SERVICE_KEY appears to be invalid - should be a JWT token"),
  SUPABASE_SERVICE_ROLE_KEY: z.string()
    .min(40, "SUPABASE_SERVICE_ROLE_KEY appears to be invalid - should be a JWT token")
    .optional(), // Alias for SUPABASE_SERVICE_KEY
  
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
  
  // Security warnings for production
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 Running in PRODUCTION mode - security checks:');
    
    // Check for default or weak values
    if (env.STUDENT_PASSWORD_SALT === 'ag2025$student#salt!9X2') {
      console.warn('⚠️  WARNING: Using default STUDENT_PASSWORD_SALT - please change this!');
    }
    
    // Ensure we're not exposing debug info
    if (process.env.DEBUG) {
      console.warn('⚠️  WARNING: DEBUG mode is enabled in production!');
    }
    
    console.log('✅ Environment validation complete');
  }
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