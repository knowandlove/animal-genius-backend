import EnhancedStorageService from './enhanced-storage-service';
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
    // Sanitize fileName to prevent path traversal
    const sanitizedFileName = path.basename(fileName);
    
    // Sanitize folder to prevent directory traversal
    const sanitizedFolder = (options.folder || options.itemType || 'misc')
      .replace(/\.\./g, '')
      .replace(/[\/\\]/g, '-')
      .replace(/^[\-\.]+/, '')
      .replace(/[\-\.]+$/, '');
    
    // Always use cloud storage
    const uploadFile: UploadFile = {
      buffer,
      metadata: {
        bucket: options.bucket || 'store-items',
        folder: sanitizedFolder,
        fileName: sanitizedFileName,
        mimeType: options.mimeType || mime.lookup(sanitizedFileName) || 'application/octet-stream',
        type: options.type || 'item',
        category: options.category || options.itemType,
        name: options.name || sanitizedFileName
      }
    };

    const uploadResult = await EnhancedStorageService.upload(uploadFile);
    const asset = await EnhancedStorageService.createAsset(uploadResult, uploadFile.metadata);

    return {
      url: asset.publicUrl,
      assetId: asset.id,
      path: asset.storagePath
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
    // First check if we have a direct publicUrl from the asset
    if (item.asset && item.asset.publicUrl) {
      return item.asset.publicUrl;
    }
    
    // Fallback: construct URL from bucket and path if available
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
    // Sanitize inputs
    const sanitizedFileName = path.basename(fileName);
    const sanitizedItemType = itemType
      .replace(/\.\./g, '')
      .replace(/[\/\\]/g, '-')
      .replace(/^[\-\.]+/, '')
      .replace(/[\-\.]+$/, '');
    
    return this.uploadFile(buffer, sanitizedFileName, {
      bucket: 'store-items',
      folder: sanitizedItemType,
      type: 'item',
      category: sanitizedItemType,
      itemType: sanitizedItemType,
      name: itemName
    });
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<any> {
    // Always use cloud storage now
    return EnhancedStorageService.getStorageStats();
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

    // Return clean items with appropriate URLs based on asset type
    return items.map(item => {
      const baseItem: any = {
        ...item,
        assetType: item.assetType || 'image', // Use consistent naming
        asset: undefined // Don't expose internal asset object
      };
      
      // Handle URLs based on asset type
      if (baseItem.assetType === 'rive' && item.asset) {
        // For RIVE assets, the main URL is the .riv file
        baseItem.riveUrl = this.getImageUrl(item);
        
        // Use thumbnailUrl if available, otherwise use imageUrl as fallback
        if (item.thumbnailUrl) {
          baseItem.imageUrl = item.thumbnailUrl;
          baseItem.thumbnailUrl = item.thumbnailUrl;
        } else {
          // Fallback for items without thumbnails
          baseItem.imageUrl = this.getImageUrl(item);
        }
      } else {
        // Regular static image items
        baseItem.imageUrl = this.getImageUrl(item);
        
        // Use thumbnailUrl if available
        if (item.thumbnailUrl) {
          baseItem.thumbnailUrl = item.thumbnailUrl;
        }
      }
      
      return baseItem;
    });
  }
}

export default StorageRouter;
