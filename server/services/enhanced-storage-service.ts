import { createClient } from '@supabase/supabase-js';
import { db } from '../db';
import { assets, type Asset, type NewAsset } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as mime from 'mime-types';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase environment variables - cloud storage disabled');
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export interface UploadFile {
  buffer: Buffer;
  metadata: {
    bucket: 'public-assets' | 'store-items' | 'user-generated';
    folder: string;
    fileName: string;
    mimeType?: string;
    type: 'animal' | 'item' | 'ui' | 'user';
    category?: string;
    name: string;
  };
}

export interface UploadResult {
  path: string;
  bucket: string;
  size: number;
  mimeType: string;
}

export interface BatchUploadResult {
  success: boolean;
  path?: string;
  bucket?: string;
  error?: string;
  metadata: UploadFile['metadata'];
}

export class EnhancedStorageService {
  /**
   * Check if cloud storage is enabled
   */
  static isEnabled(): boolean {
    return process.env.USE_CLOUD_STORAGE === 'true' && supabase !== null;
  }

  /**
   * Generate consistent asset paths
   */
  static generateAssetPath(type: string, category: string, name: string): string {
    // Sanitize category to prevent path traversal attacks
    const sanitizedCategory = category.replace(/[^a-zA-Z0-9-_]/g, '');
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-');
    const timestamp = Date.now();
    const ext = path.extname(name) || '.png';
    return `${sanitizedCategory}/${sanitizedName}-${timestamp}${ext}`;
  }

  /**
   * Upload a single file to Supabase Storage
   * Cloudflare handles all optimization - we just upload originals
   */
  static async upload(file: UploadFile): Promise<UploadResult> {
    if (!this.isEnabled()) {
      throw new Error('Cloud storage is not enabled');
    }

    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { buffer, metadata } = file;
    const filePath = this.generateAssetPath(
      metadata.type,
      metadata.folder,
      metadata.fileName
    );

    const mimeType = metadata.mimeType || mime.lookup(metadata.fileName) || 'application/octet-stream';

    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from(metadata.bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return {
      path: data.path,
      bucket: metadata.bucket,
      size: buffer.length,
      mimeType
    };
  }

  /**
   * Batch upload multiple files in parallel
   * Used for migration to upload many files efficiently
   */
  static async batchUpload(files: UploadFile[]): Promise<BatchUploadResult[]> {
    const uploadPromises = files.map(file => 
      this.upload(file)
        .then(result => ({
          success: true,
          path: result.path,
          bucket: result.bucket,
          metadata: file.metadata
        } as BatchUploadResult))
        .catch(error => ({
          success: false,
          error: error.message,
          metadata: file.metadata
        } as BatchUploadResult))
    );

    return Promise.all(uploadPromises);
  }

  /**
   * Create an asset record in the database
   */
  static async createAsset(uploadResult: UploadResult, metadata: UploadFile['metadata']): Promise<Asset> {
    const assetData: NewAsset = {
      fileName: metadata.name,
      fileType: uploadResult.mimeType,
      fileSize: uploadResult.size,
      storagePath: `${uploadResult.bucket}/${uploadResult.path}`,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${uploadResult.bucket}/${uploadResult.path}`,
      category: metadata.category
    };

    const [asset] = await db.insert(assets).values(assetData).returning();
    return asset;
  }

  /**
   * Generate a signed URL for private assets
   * Only needed for user-generated bucket
   */
  static async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('Cloud storage is not enabled');
    }

    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    if (bucket !== 'user-generated') {
      // Public buckets don't need signed URLs
      return this.getPublicUrl(bucket, path);
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Get public URL for assets in public buckets
   */
  static getPublicUrl(bucket: string, path: string): string {
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }

  /**
   * Delete a file from storage and its asset record
   */
  static async deleteAsset(assetId: string): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Cloud storage is not enabled');
    }

    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Get asset info
    const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
    if (!asset) {
      // Make operation idempotent - don't error if already deleted
      console.warn(`Asset with ID ${assetId} not found for deletion. Assuming already deleted.`);
      return;
    }

    // Delete from database first (safer for data consistency)
    await db.delete(assets).where(eq(assets.id, assetId));

    // Extract bucket and path from storagePath
    const [bucket, ...pathParts] = asset.storagePath.split('/');
    const filePath = pathParts.join('/');

    // Then delete from storage
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      // Log error but don't throw - DB record is already gone
      // The cleanup queue will handle orphaned files
      console.error(`Failed to delete file ${filePath} from bucket ${bucket}. Error: ${error.message}`);
      // File is now queued for cleanup via the trigger we set up
    }
  }

  /**
   * List files in a bucket/folder
   * Useful for debugging and migration verification
   */
  static async listFiles(bucket: string, folder?: string): Promise<any[]> {
    if (!this.isEnabled()) {
      throw new Error('Cloud storage is not enabled');
    }

    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 1000,
        offset: 0
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byBucket: Record<string, { count: number; size: number }>;
    byType: Record<string, { count: number; size: number }>;
  }> {
    const assetsData = await db.select().from(assets);

    const stats = {
      totalFiles: assetsData.length,
      totalSize: 0,
      byBucket: {} as Record<string, { count: number; size: number }>,
      byType: {} as Record<string, { count: number; size: number }>
    };

    assetsData.forEach(asset => {
      const size = asset.fileSize || 0;
      stats.totalSize += size;

      // Extract bucket from storagePath
      const [bucket] = asset.storagePath.split('/');
      
      // By bucket
      if (!stats.byBucket[bucket]) {
        stats.byBucket[bucket] = { count: 0, size: 0 };
      }
      stats.byBucket[bucket].count++;
      stats.byBucket[bucket].size += size;

      // By type (using fileType)
      if (!stats.byType[asset.fileType]) {
        stats.byType[asset.fileType] = { count: 0, size: 0 };
      }
      stats.byType[asset.fileType].count++;
      stats.byType[asset.fileType].size += size;
    });

    return stats;
  }
}

export default EnhancedStorageService;
