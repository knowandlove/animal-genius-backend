import { createClient } from '@supabase/supabase-js';

interface PresignedUploadResult {
  url: string;
  fields: Record<string, string>;
}

interface PresignedUploadOptions {
  bucket: string;
  path: string;
  contentType?: string;
  expiresIn?: number; // seconds
}

/**
 * Storage Service
 * Handles file storage operations with Supabase Storage
 */
class StorageService {
  private supabase;
  
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  /**
   * Create a presigned URL for direct upload to Supabase Storage
   */
  async createPresignedUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult> {
    const { bucket, path, contentType, expiresIn = 600 } = options;
    
    try {
      // Create signed upload URL
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path, {
          expiresIn,
        });
      
      if (error || !data) {
        throw error || new Error('Failed to create upload URL');
      }
      
      // Supabase returns a simple signed URL
      // We need to format it for our frontend
      return {
        url: data.signedUrl,
        fields: {
          // Add any additional fields if needed
          'Content-Type': contentType || 'application/octet-stream',
        },
      };
      
    } catch (error) {
      console.error('Create presigned URL error:', error);
      throw new Error('Failed to create upload URL');
    }
  }
  
  /**
   * Get public URL for an asset
   */
  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }
  
  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) {
      console.error('Delete file error:', error);
      throw new Error('Failed to delete file');
    }
  }
  
  /**
   * Delete multiple files from storage
   */
  async deleteFiles(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    
    const { error } = await this.supabase.storage
      .from(bucket)
      .remove(paths);
    
    if (error) {
      console.error('Delete files error:', error);
      throw new Error('Failed to delete files');
    }
  }
  
  /**
   * Get file metadata
   */
  async getFileMetadata(bucket: string, path: string): Promise<any> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(path.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: path.split('/').pop(),
      });
    
    if (error) {
      throw error;
    }
    
    return data?.[0] || null;
  }
  
  /**
   * Check if cloud storage is enabled
   */
  static isCloudStorageEnabled(): boolean {
    return process.env.USE_CLOUD_STORAGE === 'true';
  }
}

// Export singleton instance
export default new StorageService();
