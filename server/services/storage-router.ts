import EnhancedStorageService from './enhanced-storage-service';
import StorageService from './storage-service';
import type { UploadFile, UploadResult } from './enhanced-storage-service';
import { db } from '../db';
import { storeItems, assets } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import path from 'path';
import * as mime from 'mime-types';



/**
 * Storage Router Service
 * Routes storage operations based on USE_CLOUD_STORAGE feature flag
 * Ensures consistent behavior during migration and rollback
 */
export class StorageRouter {
  /**
   * Cloud storage is always enabled now
   */
  static isCloudStorageEnabled(): boolean {
    return true; // Always use cloud storage
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
      itemType?: string;
      name?: string;
      mimeType?: string;
    } = {}
  ): Promise<{ url: string; assetId: string; path: string }> {
    // Always use cloud storage
    const uploadFile: UploadFile = {
      buffer,
      metadata: {
        bucket: options.bucket || 'store-items',
        folder: options.folder || options.itemType || 'misc',
        fileName,
        mimeType: options.mimeType || mime.lookup(fileName) || 'application/octet-stream',
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
  }

  /**
   * Delete a file - Always uses cloud storage
   */
  static async deleteFile(assetId: string): Promise<void> {
    await EnhancedStorageService.deleteAsset(assetId);
  }

  /**
   * Get image URL - Simple version, no legacy support
   */
  static getImageUrl(item: any): string {
    // Only support cloud storage assets
    if (item.asset && item.asset.bucket && item.asset.path) {
      return EnhancedStorageService.getPublicUrl(item.asset.bucket, item.asset.path);
    }
    
    // No asset = no image
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
   * Prepare store items for response - Clean version
   */
  static async prepareStoreItemsResponse(items: any[]): Promise<any[]> {
    // Fetch all assets in one query
    const assetIds = items
      .filter(item => item.assetId)
      .map(item => item.assetId);
    
    if (assetIds.length > 0) {
      const assetsData = await db.select()
        .from(assets)
        .where(inArray(assets.id, assetIds));
      
      const assetMap = new Map(assetsData.map(a => [a.id, a]));
      
      items.forEach(item => {
        if (item.assetId && assetMap.has(item.assetId)) {
          item.asset = assetMap.get(item.assetId);
        }
      });
    }

    // Return clean items with single imageUrl
    return items.map(item => ({
      ...item,
      imageUrl: this.getImageUrl(item),
      asset: undefined // Don't expose internal asset object
    }));
  }
}

export default StorageRouter;
