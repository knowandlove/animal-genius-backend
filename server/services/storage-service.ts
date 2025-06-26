import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import sharp from 'sharp';

config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface UploadOptions {
  bucket: 'avatar-items' | 'store-uploads' | 'user-content';
  folder?: string;
  fileName?: string;
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export class StorageService {
  /**
   * Upload an image to Supabase Storage
   */
  static async uploadImage(
    file: Express.Multer.File | Buffer,
    options: UploadOptions
  ): Promise<{ url: string; path: string }> {
    try {
      // Get buffer from file
      const buffer = Buffer.isBuffer(file) ? file : file.buffer;
      
      // Optimize image if requested
      let processedBuffer = buffer;
      if (options.optimize) {
        processedBuffer = await this.optimizeImage(buffer, {
          maxWidth: options.maxWidth || 800,
          maxHeight: options.maxHeight || 800
        });
      }
      
      // Generate file path
      const fileName = options.fileName || `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const filePath = options.folder ? `${options.folder}/${fileName}` : fileName;
      
      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from(options.bucket)
        .upload(filePath, processedBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (error) {
        throw error;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(options.bucket)
        .getPublicUrl(filePath);
      
      return {
        url: publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error('Failed to upload image');
    }
  }
  
  /**
   * Delete an image from Supabase Storage
   */
  static async deleteImage(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) {
      console.error('Delete error:', error);
      throw new Error('Failed to delete image');
    }
  }
  
  /**
   * Optimize image using Sharp
   */
  private static async optimizeImage(
    buffer: Buffer,
    options: { maxWidth: number; maxHeight: number }
  ): Promise<Buffer> {
    return sharp(buffer)
      .resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();
  }
  
  /**
   * Get a signed URL for temporary access (if needed for private buckets)
   */
  static async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    
    if (error || !data) {
      throw new Error('Failed to create signed URL');
    }
    
    return data.signedUrl;
  }
  
  /**
   * List all files in a bucket/folder
   */
  static async listFiles(bucket: string, folder?: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 1000,
        offset: 0
      });
    
    if (error) {
      throw error;
    }
    
    return data;
  }
}

export default StorageService;
