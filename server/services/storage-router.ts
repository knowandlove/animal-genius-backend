import EnhancedStorageService from './enhanced-storage-service';
import StorageService from './storage-service';
import type { UploadFile, UploadResult } from './enhanced-storage-service';
import { db } from '../db';
import { storeItems, assets } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import path from 'path';
import * as mime from 'mime-types';

// Debug logging for cloud storage flag
console.log('🚀 StorageRouter initializing...');
console.log('USE_CLOUD_STORAGE env:', process.env.USE_CLOUD_STORAGE);
console.log('Type:', typeof process.env.USE_CLOUD_STORAGE);
console.log('Equals true (boolean)?:', process.env.USE_CLOUD_STORAGE === true);
console.log('Equals "true" (string)?:', process.env.USE_CLOUD_STORAGE === 'true');

/**
 * Storage Router Service
 * Routes storage operations based on USE_CLOUD_STORAGE feature flag
 * Ensures consistent behavior during migration and rollback
 */
export class StorageRouter {
  /**
   * Check if cloud storage is enabled
   */
  static isCloudStorageEnabled(): boolean {
    const useCloudStorage = process.env.USE_CLOUD_STORAGE === 'true';
    console.log('🔍 isCloudStorageEnabled called, returning:', useCloudStorage);
    return useCloudStorage;
  }

  /**
   * Upload a file using the appropriate storage method
   */
  static async uploadFile(
    buffer: Buffer,
    fileName: string,
    options: {
      bucket?: 'public-assets' | 'store-items' | 'user-generated';
      folder?: string;
      type?: 'animal' | 'item' | 'ui' | 'user';
      category?: string;
      itemType?: string; // For store items
      name?: string;
    } = {}
  ): Promise<{ url: string; assetId?: string; path?: string }> {
    if (this.isCloudStorageEnabled()) {
      // Use cloud storage
      const uploadFile: UploadFile = {
        buffer,
        metadata: {
          bucket: options.bucket || 'store-items',
          folder: options.folder || options.itemType || 'misc',
          fileName,
          mimeType: mime.lookup(fileName) || 'application/octet-stream',
          type: options.type || 'item',
          category: options.category || options.itemType,
          name: options.name || fileName
        }
      };

      const uploadResult = await EnhancedStorageService.upload(uploadFile);
      const asset = await EnhancedStorageService.createAsset(uploadResult, uploadFile.metadata);

      return {
        url: EnhancedStorageService.getPublicUrl(asset.bucket, asset.path),
        assetId: asset.id,
        path: asset.path
      };
    } else {
      // Use local storage (legacy)
      // For now, just return a local URL
      // TODO: Implement actual local file storage if needed
      const localPath = `/uploads/${options.folder || 'misc'}/${fileName}`;
      return {
        url: localPath,
        // No assetId for legacy uploads
      };
    }
  }

  /**
   * Delete a file using the appropriate storage method
   */
  static async deleteFile(
    identifier: string | { assetId?: string; url?: string }
  ): Promise<void> {
    if (this.isCloudStorageEnabled()) {
      // For cloud storage, we need an assetId
      let assetId: string;
      
      if (typeof identifier === 'string') {
        assetId = identifier;
      } else if (identifier.assetId) {
        assetId = identifier.assetId;
      } else {
        throw new Error('Asset ID required for cloud storage deletion');
      }

      await EnhancedStorageService.deleteAsset(assetId);
    } else {
      // For local storage, we need a URL
      let url: string;
      
      if (typeof identifier === 'string') {
        url = identifier;
      } else if (identifier.url) {
        url = identifier.url;
      } else {
        throw new Error('URL required for local storage deletion');
      }

      // For local storage, we can't actually delete files
      // Just log it for now
      console.log(`Would delete local file at: ${url}`);
    }
  }

  /**
   * Get the appropriate image URL based on storage method
   */
  static getImageUrl(item: any): string {
    console.log('🔍 getImageUrl called with item:', { 
      hasAsset: !!item.asset, 
      assetId: item.assetId,
      imageUrl: item.imageUrl,
      cloudEnabled: this.isCloudStorageEnabled() 
    });
    
    if (this.isCloudStorageEnabled() && item.asset) {
      // Use cloud storage URL
      const cloudUrl = EnhancedStorageService.getPublicUrl(item.asset.bucket, item.asset.path);
      console.log('☁️ Returning cloud URL:', cloudUrl);
      return cloudUrl;
    } else if (item.imageUrl) {
      // Use legacy URL
      // Ensure it's an absolute URL
      if (item.imageUrl.startsWith('/')) {
        const fullUrl = `${process.env.API_URL || ''}${item.imageUrl}`;
        console.log('📁 Returning legacy URL:', fullUrl);
        return fullUrl;
      }
      return item.imageUrl;
    }
    
    // Fallback
    console.log('⚠️ Using fallback placeholder');
    return '/placeholder.png';
  }

  /**
   * Upload store item image with proper routing
   */
  static async uploadStoreItemImage(
    buffer: Buffer,
    fileName: string,
    itemType: string,
    itemName: string
  ): Promise<{ url: string; assetId?: string }> {
    return this.uploadFile(buffer, fileName, {
      bucket: 'store-items',
      folder: itemType,
      type: 'item',
      category: itemType,
      itemType,
      name: itemName
    });
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<any> {
    if (this.isCloudStorageEnabled()) {
      return EnhancedStorageService.getStorageStats();
    } else {
      // For local storage, return basic stats
      const items = await db.select().from(storeItems);
      return {
        totalFiles: items.filter(i => i.imageUrl).length,
        totalSize: 0, // Unknown for local files
        byType: {
          'store-items': { count: items.filter(i => i.imageUrl).length, size: 0 }
        }
      };
    }
  }

  /**
   * Prepare store item for response (includes proper image URL)
   */
  static async prepareStoreItemResponse(item: any): Promise<any> {
    // If cloud storage is enabled and item has asset_id, fetch the asset
    if (this.isCloudStorageEnabled() && item.assetId) {
      const [asset] = await db.select()
        .from(assets)
        .where(eq(assets.id, item.assetId))
        .limit(1);
      
      if (asset) {
        item.asset = asset;
      }
    }

    // Get the appropriate URL
    const imageUrl = this.getImageUrl(item);

    return {
      ...item,
      imageUrl, // Always include imageUrl for backward compatibility
      // Include asset info if available
      ...(item.asset && {
        assetId: item.assetId,
        assetUrl: imageUrl
      })
    };
  }

  /**
   * Batch prepare store items for response
   */
  static async prepareStoreItemsResponse(items: any[]): Promise<any[]> {
    // If cloud storage enabled, fetch all assets in one query
    if (this.isCloudStorageEnabled()) {
      const assetIds = items
        .filter(item => item.assetId)
        .map(item => item.assetId);
      
      if (assetIds.length > 0) {
        const assetsData = await db.select()
          .from(assets)
          .where(inArray(assets.id, assetIds)); // Fixed: Use inArray for proper batch query
        
        // Create a map for quick lookup
        const assetMap = new Map(assetsData.map(a => [a.id, a]));
        
        // Attach assets to items
        items.forEach(item => {
          if (item.assetId && assetMap.has(item.assetId)) {
            item.asset = assetMap.get(item.assetId);
          }
        });
      }
    }

    // Now map over items to generate final response (avoid N+1)
    return items.map(item => {
      const imageUrl = this.getImageUrl(item);
      return {
        ...item,
        imageUrl,
        ...(item.asset && {
          assetId: item.assetId,
          assetUrl: imageUrl
        })
      };
    });
  }
}

export default StorageRouter;
