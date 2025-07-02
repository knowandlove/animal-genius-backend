#!/usr/bin/env tsx
/**
 * Minimal Migration Script - Essential Assets Only
 * Migrates: 8 animal images, shelves-and-trim.png, KAL.png
 * 
 * This script is idempotent - safe to run multiple times
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { db } from '../server/db.ts';
import { assets } from '../shared/schema.ts';
import { eq, and } from 'drizzle-orm';
import EnhancedStorageService from '../server/services/enhanced-storage-service.ts';
import * as mime from 'mime-types';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

// Essential assets to migrate
const ESSENTIAL_ASSETS = [
  // 8 Animal images
  { file: 'animals/beaver.png', bucket: 'public-assets', folder: 'animals', name: 'Beaver' },
  { file: 'animals/border-collie.png', bucket: 'public-assets', folder: 'animals', name: 'Border Collie' },
  { file: 'animals/elephant.png', bucket: 'public-assets', folder: 'animals', name: 'Elephant' },
  { file: 'animals/meerkat.png', bucket: 'public-assets', folder: 'animals', name: 'Meerkat' },
  { file: 'animals/otter.png', bucket: 'public-assets', folder: 'animals', name: 'Otter' },
  { file: 'animals/owl.png', bucket: 'public-assets', folder: 'animals', name: 'Owl' },
  { file: 'animals/panda.png', bucket: 'public-assets', folder: 'animals', name: 'Panda' },
  { file: 'animals/parrot.png', bucket: 'public-assets', folder: 'animals', name: 'Parrot' },
  
  // UI essentials
  { file: 'ui/shelves-and-trim.png', bucket: 'public-assets', folder: 'ui', name: 'Shelves and Trim' },
  { file: 'KAL.png', bucket: 'public-assets', folder: 'ui', name: 'KAL Logo' },
] as const;

interface MigrationResult {
  asset: typeof ESSENTIAL_ASSETS[number];
  status: 'success' | 'skipped' | 'failed';
  message: string;
  error?: string;
}

class AssetMigration {
  private results: MigrationResult[] = [];
  private publicDir: string;

  constructor() {
    // Frontend public directory
    this.publicDir = join(__dirname, '../../../animal-genius-frontend/public');
  }

  async checkFile(filePath: string): Promise<boolean> {
    try {
      await access(join(this.publicDir, filePath), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async migrateAsset(asset: typeof ESSENTIAL_ASSETS[number]): Promise<MigrationResult> {
    try {
      // Check if already migrated
      const existing = await db.select()
        .from(assets)
        .where(and(
          eq(assets.name, asset.name),
          eq(assets.bucket, asset.bucket as any)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return {
          asset,
          status: 'skipped',
          message: `Already migrated (ID: ${existing[0].id})`
        };
      }

      // Check if file exists
      const fullPath = join(this.publicDir, asset.file);
      if (!await this.checkFile(asset.file)) {
        return {
          asset,
          status: 'failed',
          message: 'File not found',
          error: `Missing: ${fullPath}`
        };
      }

      // Read file
      const buffer = await readFile(fullPath);
      const fileName = asset.file.split('/').pop()!;
      const mimeType = mime.lookup(fileName) || 'application/octet-stream';

      // Upload to Supabase
      const uploadResult = await EnhancedStorageService.upload({
        buffer,
        metadata: {
          bucket: asset.bucket as any,
          folder: asset.folder,
          fileName,
          mimeType,
          type: asset.folder === 'animals' ? 'animal' : 'ui',
          category: asset.folder,
          name: asset.name
        }
      });

      // Create asset record
      await EnhancedStorageService.createAsset(uploadResult, {
        bucket: asset.bucket as any,
        folder: asset.folder,
        fileName,
        mimeType,
        type: asset.folder === 'animals' ? 'animal' : 'ui',
        category: asset.folder,
        name: asset.name
      });

      return {
        asset,
        status: 'success',
        message: `Migrated to ${uploadResult.path}`
      };

    } catch (error) {
      return {
        asset,
        status: 'failed',
        message: 'Migration failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async run() {
    console.log('🚀 Starting Essential Assets Migration');
    console.log(`📁 Public directory: ${this.publicDir}`);
    console.log(`☁️  Cloud storage enabled: ${process.env.USE_CLOUD_STORAGE === 'true'}`);
    console.log(`🔗 Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log('');

    // Check if cloud storage is configured
    if (!EnhancedStorageService.isEnabled()) {
      console.error('❌ Cloud storage is not enabled!');
      console.error('   Set USE_CLOUD_STORAGE=true in your .env file');
      process.exit(1);
    }

    // Process each asset
    console.log(`📦 Processing ${ESSENTIAL_ASSETS.length} essential assets...\n`);
    
    for (const asset of ESSENTIAL_ASSETS) {
      process.stdout.write(`⏳ ${asset.name.padEnd(20)} ... `);
      const result = await this.migrateAsset(asset);
      this.results.push(result);
      
      if (result.status === 'success') {
        console.log('✅ Success');
      } else if (result.status === 'skipped') {
        console.log('⏭️  Skipped (already migrated)');
      } else {
        console.log(`❌ Failed: ${result.error || result.message}`);
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('─'.repeat(50));
    
    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      skipped: this.results.filter(r => r.status === 'skipped').length,
      failed: this.results.filter(r => r.status === 'failed').length
    };

    console.log(`Total assets: ${summary.total}`);
    console.log(`✅ Migrated: ${summary.success}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log(`❌ Failed: ${summary.failed}`);

    // Show failures
    if (summary.failed > 0) {
      console.log('\n❌ Failed migrations:');
      this.results
        .filter(r => r.status === 'failed')
        .forEach(r => {
          console.log(`  - ${r.asset.name}: ${r.error || r.message}`);
        });
    }

    // Final status
    console.log('\n' + '─'.repeat(50));
    if (summary.failed === 0) {
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Deploy the backend with USE_CLOUD_STORAGE=true');
      console.log('2. Deploy the frontend with VITE_USE_CLOUD_STORAGE=true');
      console.log('3. Test that all images load correctly');
    } else {
      console.log('⚠️  Migration completed with errors');
      console.log('   Fix the errors and run the script again');
      process.exit(1);
    }
  }
}

// Run migration
const migration = new AssetMigration();
migration.run().catch(error => {
  console.error('\n💥 Critical error:', error);
  process.exit(1);
});
