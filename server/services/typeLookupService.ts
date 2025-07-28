import { db } from "../db";
import { animalTypes, itemTypes, geniusTypes } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Enhanced Type Lookup Service with configuration file support
 * 
 * This service manages the translation between string codes/names and UUIDs
 * for all lookup tables. It now supports:
 * - Loading from database on startup
 * - Exporting current data to configuration file
 * - Manual refresh without server restart
 * - Admin-triggered updates
 */
export class TypeLookupService {
  private static instance: TypeLookupService;
  
  // Maps for quick lookups
  private animalsByCode = new Map<string, { id: string; name: string }>();
  private animalsById = new Map<string, { code: string; name: string }>();
  
  private itemsByCode = new Map<string, { id: string; name: string; category: string }>();
  private itemsById = new Map<string, { code: string; name: string; category: string }>();
  
  private geniusByCode = new Map<string, { id: string; name: string }>();
  private geniusById = new Map<string, { code: string; name: string }>();
  
  private answerTypesByCode = new Map<string, { id: string; label: string }>();
  private answerTypesById = new Map<string, { code: string; label: string }>();
  
  // Track initialization status
  private initialized = false;
  private lastRefresh: Date | null = null;
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  static getInstance(): TypeLookupService {
    if (!TypeLookupService.instance) {
      TypeLookupService.instance = new TypeLookupService();
    }
    return TypeLookupService.instance;
  }
  
  /**
   * Initialize the service by loading all lookup tables into memory
   */
  async initialize(): Promise<void> {
    console.log("🔄 Initializing Type Lookup Service...");
    
    try {
      await this.loadFromDatabase();
      this.initialized = true;
      this.lastRefresh = new Date();
      
      console.log("✅ Type Lookup Service initialized successfully");
      console.log(`   - ${this.animalsByCode.size} animal types loaded`);
      console.log(`   - ${this.itemsByCode.size} item types loaded`);
      console.log(`   - ${this.geniusByCode.size} genius types loaded`);
      console.log(`   - ${this.answerTypesByCode.size} answer types loaded`);
    } catch (error) {
      console.error("❌ Failed to initialize Type Lookup Service:", error);
      throw error;
    }
  }
  
  /**
   * Refresh the lookup data from database
   * Can be called without restarting the server
   */
  async refresh(): Promise<void> {
    console.log("🔄 Refreshing Type Lookup Service data...");
    
    // Clear existing data
    this.animalsByCode.clear();
    this.animalsById.clear();
    this.itemsByCode.clear();
    this.itemsById.clear();
    this.geniusByCode.clear();
    this.geniusById.clear();
    this.answerTypesByCode.clear();
    this.answerTypesById.clear();
    
    // Reload from database
    await this.loadFromDatabase();
    this.lastRefresh = new Date();
    
    console.log("✅ Type Lookup Service refreshed successfully");
  }
  
  /**
   * Load all data from database
   */
  private async loadFromDatabase(): Promise<void> {
    await Promise.all([
      this.loadAnimalTypes(),
      this.loadItemTypes(),
      this.loadGeniusTypes(),
      this.loadAnswerTypes()
    ]);
  }
  
  /**
   * Export current lookup data to a configuration file
   * Useful for backing up or version controlling the lookup data
   */
  async exportToConfigFile(filePath?: string): Promise<void> {
    const configPath = filePath || path.join(process.cwd(), 'config', 'type-lookups.json');
    
    const data = {
      exportedAt: new Date().toISOString(),
      animalTypes: Array.from(this.animalsByCode.entries()).map(([code, data]) => ({
        code,
        name: data.name,
        id: data.id
      })),
      itemTypes: Array.from(this.itemsByCode.entries()).map(([code, data]) => ({
        code,
        name: data.name,
        category: data.category,
        id: data.id
      })),
      geniusTypes: Array.from(this.geniusByCode.entries()).map(([code, data]) => ({
        code,
        name: data.name,
        id: data.id
      })),
      answerTypes: Array.from(this.answerTypesByCode.entries()).map(([code, data]) => ({
        code,
        label: data.label,
        id: data.id
      }))
    };
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Write file with pretty formatting
    await fs.writeFile(configPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Exported type lookups to ${configPath}`);
  }
  
  /**
   * Load animal types into memory
   */
  private async loadAnimalTypes(): Promise<void> {
    const animals = await db.select().from(animalTypes);
    
    for (const animal of animals) {
      this.animalsByCode.set(animal.code, { id: animal.id, name: animal.name });
      this.animalsById.set(animal.id, { code: animal.code, name: animal.name });
    }
  }
  
  /**
   * Load item types into memory
   */
  private async loadItemTypes(): Promise<void> {
    const items = await db.select().from(itemTypes);
    
    for (const item of items) {
      this.itemsByCode.set(item.code, { 
        id: item.id, 
        name: item.name,
        category: item.category 
      });
      this.itemsById.set(item.id, { 
        code: item.code, 
        name: item.name,
        category: item.category 
      });
    }
  }
  
  /**
   * Load genius types into memory
   */
  private async loadGeniusTypes(): Promise<void> {
    const geniuses = await db.select().from(geniusTypes);
    
    for (const genius of geniuses) {
      this.geniusByCode.set(genius.code, { id: genius.id, name: genius.name });
      this.geniusById.set(genius.id, { code: genius.code, name: genius.name });
    }
  }
  
  /**
   * Load answer types into memory
   */
  private async loadAnswerTypes(): Promise<void> {
    // TODO: Implement when quizAnswerTypes table is added
    // const answers = await db.select().from(quizAnswerTypes);
    // 
    // for (const answer of answers) {
    //   this.answerTypesByCode.set(answer.code, { id: answer.id, label: answer.label });
    //   this.answerTypesById.set(answer.id, { code: answer.code, label: answer.label });
    // }
  }
  
  // ===== ANIMAL TYPE METHODS =====
  
  /**
   * Get animal type ID from code or name
   */
  getAnimalTypeId(codeOrName: string): string | null {
    // First try as code
    const byCode = this.animalsByCode.get(codeOrName);
    if (byCode) return byCode.id;
    
    // Then try as name (case insensitive)
    for (const [code, data] of this.animalsByCode) {
      if (data.name.toLowerCase() === codeOrName.toLowerCase()) {
        return data.id;
      }
    }
    
    // Also check common variations
    const normalized = codeOrName.toLowerCase().replace(/[\s-_]/g, '');
    if (normalized === 'bordercollie') {
      return this.getAnimalTypeId('border-collie');
    }
    
    return null;
  }
  
  /**
   * Get animal type code from ID
   */
  getAnimalTypeCode(id: string): string | null {
    return this.animalsById.get(id)?.code || null;
  }
  
  /**
   * Get animal type name from ID
   */
  getAnimalTypeName(id: string): string | null {
    return this.animalsById.get(id)?.name || null;
  }
  
  /**
   * Get animal type name from code
   */
  getAnimalTypeNameByCode(code: string): string | null {
    return this.animalsByCode.get(code)?.name || null;
  }
  
  // ===== ITEM TYPE METHODS =====
  
  /**
   * Get item type ID from code
   */
  getItemTypeId(code: string): string | null {
    return this.itemsByCode.get(code)?.id || null;
  }
  
  /**
   * Get item type code from ID
   */
  getItemTypeCode(id: string): string | null {
    return this.itemsById.get(id)?.code || null;
  }
  
  /**
   * Get item type category from ID
   */
  getItemTypeCategory(id: string): string | null {
    return this.itemsById.get(id)?.category || null;
  }
  
  // ===== GENIUS TYPE METHODS =====
  
  /**
   * Get genius type ID from code or name
   */
  getGeniusTypeId(codeOrName: string): string | null {
    // First try as code
    const byCode = this.geniusByCode.get(codeOrName);
    if (byCode) return byCode.id;
    
    // Then try as name (case insensitive)
    for (const [code, data] of this.geniusByCode) {
      if (data.name.toLowerCase() === codeOrName.toLowerCase()) {
        return data.id;
      }
    }
    
    return null;
  }
  
  /**
   * Get genius type code from ID
   */
  getGeniusTypeCode(id: string): string | null {
    return this.geniusById.get(id)?.code || null;
  }
  
  /**
   * Get genius type name from ID
   */
  getGeniusTypeName(id: string): string | null {
    return this.geniusById.get(id)?.name || null;
  }
  
  // ===== ANSWER TYPE METHODS =====
  
  /**
   * Get answer type ID from code
   */
  getAnswerTypeId(code: string): string | null {
    return this.answerTypesByCode.get(code)?.id || null;
  }
  
  /**
   * Get answer type code from ID
   */
  getAnswerTypeCode(id: string): string | null {
    return this.answerTypesById.get(id)?.code || null;
  }
  
  // ===== UTILITY METHODS =====
  
  /**
   * Get all animal types
   */
  getAllAnimalTypes(): Array<{ id: string; code: string; name: string }> {
    return Array.from(this.animalsById.entries()).map(([id, data]) => ({
      id,
      code: data.code,
      name: data.name
    }));
  }
  
  /**
   * Get all item types
   */
  getAllItemTypes(): Array<{ id: string; code: string; name: string; category: string }> {
    return Array.from(this.itemsById.entries()).map(([id, data]) => ({
      id,
      code: data.code,
      name: data.name,
      category: data.category
    }));
  }
  
  /**
   * Get all genius types
   */
  getAllGeniusTypes(): Array<{ id: string; code: string; name: string }> {
    return Array.from(this.geniusById.entries()).map(([id, data]) => ({
      id,
      code: data.code,
      name: data.name
    }));
  }
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      lastRefresh: this.lastRefresh,
      counts: {
        animalTypes: this.animalsByCode.size,
        itemTypes: this.itemsByCode.size,
        geniusTypes: this.geniusByCode.size,
        answerTypes: this.answerTypesByCode.size
      }
    };
  }
}

// Export a singleton instance
export const typeLookup = TypeLookupService.getInstance();
