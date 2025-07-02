#!/usr/bin/env tsx
/**
 * Script to apply code changes for UUID migration
 * This updates the codebase to work with UUID teacher_id columns
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('🔄 Applying UUID code changes...\n');

// Update shared/schema.ts
console.log('📝 Updating shared/schema.ts...');
const schemaPath = join(__dirname, 'shared/schema.ts');
let schemaContent = readFileSync(schemaPath, 'utf-8');

// Update classes table teacher_id to use UUID
schemaContent = schemaContent.replace(
  'teacherId: integer("teacher_id").notNull()',
  'teacherId: text("teacher_id").notNull().references(() => profiles.id)'
);

// Update lessonProgress teacherId
schemaContent = schemaContent.replace(
  'teacherId: integer("teacher_id").references(() => users.id).notNull()',
  'teacherId: text("teacher_id").references(() => profiles.id).notNull()'
);

// Update adminLogs adminId and targetUserId
schemaContent = schemaContent.replace(
  'adminId: integer("admin_id").references(() => users.id).notNull()',
  'adminId: text("admin_id").references(() => profiles.id).notNull()'
);
schemaContent = schemaContent.replace(
  'targetUserId: integer("target_user_id").references(() => users.id)',
  'targetUserId: text("target_user_id").references(() => profiles.id)'
);

// Update currencyTransactions teacherId
schemaContent = schemaContent.replace(
  'teacherId: integer("teacher_id").references(() => users.id).notNull()',
  'teacherId: text("teacher_id").references(() => profiles.id).notNull()'
);

// Update purchaseRequests processedBy
schemaContent = schemaContent.replace(
  'processedBy: integer("processed_by").references(() => users.id)',
  'processedBy: text("processed_by").references(() => profiles.id)'
);

writeFileSync(schemaPath, schemaContent);
console.log('✅ Updated schema.ts\n');

// Update server/middleware/auth.ts
console.log('📝 Updating server/middleware/auth.ts...');
const authPath = join(__dirname, 'server/middleware/auth.ts');
let authContent = readFileSync(authPath, 'utf-8');

// Update the Express Request interface
authContent = authContent.replace(
  `interface Request {
      user?: any;
      supabaseUser?: any;
    }`,
  `interface Request {
      user?: {
        userId: string; // Now using UUID
        email: string;
        is_admin: boolean;
      };
      profile?: any;
    }`
);

// Update requireAuth to handle profile properly
authContent = authContent.replace(
  `req.user = {
      userId: user.id,
      email: user.email,
      is_admin: profile?.is_admin || false
    };
    
    req.supabaseUser = user;`,
  `req.user = {
      userId: user.id, // UUID from Supabase
      email: user.email || profile.email,
      is_admin: profile.is_admin || false
    };
    
    req.profile = profile;`
);

writeFileSync(authPath, authContent);
console.log('✅ Updated auth.ts\n');

// Update storage interface
console.log('📝 Creating storage type updates...');
const storageTypesPath = join(__dirname, 'server/storage-types-update.ts');
const storageTypesContent = `// Updated storage interface signatures for UUID support
export interface StorageUpdates {
  // Profile-based methods (replacing user methods)
  getProfileById(id: string): Promise<any>;
  getProfileByEmail(email: string): Promise<any>;
  
  // Class methods with UUID teacherId
  createClass(data: { name: string; teacherId: string; iconEmoji?: string; iconColor?: string }): Promise<any>;
  getClassesByTeacherId(teacherId: string): Promise<any[]>;
  
  // Transaction methods with UUID teacherId
  giveCurrencyWithTransaction(
    studentId: string,
    amount: number,
    teacherId: string,
    reason: string
  ): Promise<{ newBalance: number }>;
  
  takeCurrencyWithTransaction(
    studentId: string,
    amount: number,
    teacherId: string,
    reason: string
  ): Promise<{ newBalance: number; actualAmount: number }>;
  
  // Admin methods with UUID adminId
  logAdminAction(data: {
    adminId: string;
    action: string;
    targetUserId?: string | null;
    targetClassId?: number | null;
    targetSubmissionId?: number | null;
    details?: any;
  }): Promise<void>;
  
  // Lesson progress with UUID teacherId
  markLessonComplete(teacherId: string, classId: number, lessonId: number): Promise<any>;
  isLessonComplete(teacherId: string, classId: number, lessonId: number): Promise<boolean>;
}
`;
writeFileSync(storageTypesPath, storageTypesContent);
console.log('✅ Created storage type updates\n');

console.log('✨ Code changes applied successfully!');
console.log('\nNext steps:');
console.log('1. Review the changes in each file');
console.log('2. Update storage.ts to implement the new UUID-based methods');
console.log('3. Test the backend with: npm run dev');
