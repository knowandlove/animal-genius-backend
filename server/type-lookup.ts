import { db } from './db';
import { animalTypes, geniusTypes } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function getAnimalTypeId(animalCode: string): Promise<string> {
  if (!animalCode?.trim()) {
    throw new Error('Animal type code is required');
  }
  
  const [animalType] = await db
    .select({ id: animalTypes.id })
    .from(animalTypes)
    .where(eq(animalTypes.code, animalCode.toLowerCase()));
  
  if (!animalType) {
    throw new Error(`Animal type '${animalCode}' not found in database`);
  }
  
  return animalType.id;
}

export async function getGeniusTypeId(geniusName: string): Promise<string> {
  if (!geniusName?.trim()) {
    throw new Error('Genius type name is required');
  }
  
  // Handle common mappings
  const geniusMap: Record<string, string> = {
    'Thinker': 'thinker',
    'Feeler': 'feeler',
    'Doer': 'doer',
    'Creative & Empathetic': 'creative',
    'Thoughtful & Strategic': 'strategic',
    'Independent & Analytical': 'analytical',
    'Reliable & Organized': 'practical',
    'Caring & Social': 'social',
    'Playful & Energetic': 'playful',
    'Enthusiastic & Creative': 'innovative',
    'Leadership & Goal-oriented': 'strategic'
  };
  
  const geniusCode = geniusMap[geniusName] || geniusName.toLowerCase();
  
  const [geniusType] = await db
    .select({ id: geniusTypes.id })
    .from(geniusTypes)
    .where(eq(geniusTypes.code, geniusCode));
  
  if (!geniusType) {
    throw new Error(`Genius type '${geniusName}' (code: '${geniusCode}') not found in database`);
  }
  
  return geniusType.id;
}