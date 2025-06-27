import { promises as fs } from 'fs';
import path from 'path';

async function archiveOldMigrations() {
  const migrationsDir = './migrations';
  const archiveDir = './migrations/archive';
  
  // Files to keep in the migrations directory
  const filesToKeep = [
    '0000_conscious_albert_cleary.sql', // Initial Drizzle migration
    'clean-schema-with-rls.sql',         // Our source of truth
    'archive_old_migrations.sh',         // This cleanup script
    'cleanup-migrations.ts'              // This file
  ];
  
  // Directories to keep
  const dirsToKeep = ['meta', 'archive'];
  
  try {
    // Get all files in migrations directory
    const files = await fs.readdir(migrationsDir);
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const stats = await fs.stat(filePath);
      
      // Skip directories we want to keep
      if (stats.isDirectory() && dirsToKeep.includes(file)) {
        continue;
      }
      
      // Skip files we want to keep
      if (!stats.isDirectory() && filesToKeep.includes(file)) {
        continue;
      }
      
      // Move everything else to archive
      const destPath = path.join(archiveDir, file);
      await fs.rename(filePath, destPath);
      console.log(`Archived: ${file}`);
    }
    
    console.log('\nMigration cleanup complete!');
    console.log('\nKept in migrations/:');
    console.log('- 0000_conscious_albert_cleary.sql (initial Drizzle migration)');
    console.log('- clean-schema-with-rls.sql (current schema source of truth)');
    console.log('- meta/ (Drizzle metadata)');
    console.log('\nAll other files moved to archive/');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup
archiveOldMigrations();