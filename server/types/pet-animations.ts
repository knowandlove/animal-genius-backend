// Pet animation system types
export type PetAnimationType = 
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'eat'
  | 'happy'
  | 'sad'
  | 'sleep'
  | 'play'
  | 'pet';

export interface AnimationDefinition {
  name: PetAnimationType;
  row: number; // which row in the sprite sheet
  frameCount: number;
  frameDuration: number; // ms per frame
  loop: boolean;
}

export interface SpriteSheetMetadata {
  // Image dimensions
  imageWidth: number;
  imageHeight: number;
  
  // Default frame size
  frameWidth: number;
  frameHeight: number;
  
  // How many rows of animations
  animationRows: number;
  
  // Animation definitions (simplified for storage)
  animations?: Record<PetAnimationType, AnimationDefinition>;
  
  // Display settings
  scale?: number; // How much to scale up (e.g., 2 for pixel art)
  pixelated?: boolean; // Whether to use pixel-perfect rendering
}

// Pet base stats including sprite metadata
export interface PetBaseStats {
  hungerDecayRate: number; // points per hour
  happinessDecayRate: number; // points per hour
  spriteMetadata?: SpriteSheetMetadata;
}

// Default animation definitions for standard 8-row sprite sheets
export const DEFAULT_ANIMATIONS: Record<PetAnimationType, AnimationDefinition> = {
  idle: { name: 'idle', row: 0, frameCount: 4, frameDuration: 200, loop: true },
  walk: { name: 'walk', row: 1, frameCount: 4, frameDuration: 150, loop: true },
  run: { name: 'run', row: 2, frameCount: 4, frameDuration: 100, loop: true },
  jump: { name: 'jump', row: 3, frameCount: 4, frameDuration: 150, loop: false },
  eat: { name: 'eat', row: 4, frameCount: 4, frameDuration: 200, loop: false },
  happy: { name: 'happy', row: 5, frameCount: 4, frameDuration: 150, loop: true },
  sad: { name: 'sad', row: 6, frameCount: 4, frameDuration: 250, loop: true },
  sleep: { name: 'sleep', row: 7, frameCount: 4, frameDuration: 400, loop: true },
  play: { name: 'play', row: 5, frameCount: 4, frameDuration: 150, loop: true }, // reuse happy
  pet: { name: 'pet', row: 5, frameCount: 4, frameDuration: 150, loop: true }, // reuse happy
};