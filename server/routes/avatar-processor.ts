import { Router } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';

const router = Router();

// Color mapping for each animal type's default colors
const COLOR_MAPPINGS: Record<string, Record<string, string>> = {
  meerkat: {
    '#dbb79c': 'primary',    // Main fur color
    '#f0d6c2': 'secondary',  // Light fur
    '#e8c3a3': 'secondary',  // Light fur variant
    '#d3ae91': 'primary',    // Darker fur
    '#895f4a': 'primary',    // Dark accents
    '#875c4b': 'primary',    // Dark accents
    '#df9c8d': 'secondary',  // Light accents
  },
  panda: {
    '#444': 'primary',       // Dark fur
    '#1e1e1e': 'primary',    // Black patches
    '#282828': 'primary',    // Dark accents
    '#4d4d4d': 'primary',    // Gray fur
    '#fff': 'secondary',     // White fur
    '#b7483d': 'secondary',  // Accent color (nose/mouth)
  },
  border_collie: {
    '#8B4513': 'primary',    // Brown fur
    '#A0522D': 'primary',    // Darker brown
    '#D2691E': 'primary',    // Light brown
    '#FFFFFF': 'secondary',  // White markings
    '#F5DEB3': 'secondary',  // Light fur
    '#FFF8DC': 'secondary',  // Cream color
  },
  owl: {
    '#8B7355': 'primary',    // Brown feathers
    '#A0826D': 'primary',    // Medium brown
    '#6B4E3D': 'primary',    // Dark brown
    '#F5DEB3': 'secondary',  // Light feathers
    '#FFF8DC': 'secondary',  // Cream feathers
    '#FAEBD7': 'secondary',  // Light accents
  },
  otter: {
    '#6c4c40': 'primary',    // Dark brown
    '#4c3b3b': 'primary',    // Darker brown
    '#4f3a33': 'primary',    // Brown
    '#755c51': 'primary',    // Medium brown
    '#896f62': 'primary',    // Light brown
    '#f6edd7': 'secondary',  // Light fur
    '#d2b7a5': 'secondary',  // Light brown
    '#f2f2f2': 'secondary',  // White
    '#dba39f': 'secondary',  // Light accent
  },
  // Add more animals as needed
  default: {
    '#dbb79c': 'primary',
    '#f0d6c2': 'secondary',
    '#e8c3a3': 'secondary',
    '#d3ae91': 'primary',
    '#895f4a': 'primary',
    '#875c4b': 'primary',
    '#df9c8d': 'secondary',
  }
};

/**
 * GET /api/avatar/:animalType
 * Returns a processed SVG with custom colors
 * Query params:
 * - primary: Primary color (hex)
 * - secondary: Secondary color (hex)
 * - items: Comma-separated item IDs (future feature)
 */
router.get('/:animalType', async (req, res) => {
  try {
    const { animalType } = req.params;
    const { 
      primary = '#D4A574', 
      secondary = '#FFFDD0',
      items 
    } = req.query;
    
    console.log('Avatar processor received:', {
      animalType,
      primary,
      secondary,
      items
    });

    // Sanitize and normalize animal type to match file names
    // Replace spaces with underscores to match file naming convention
    const safeAnimalType = animalType.toLowerCase()
      .replace(/\s+/g, '_')  // Replace spaces with underscores
      .replace(/[^a-z0-9_-]/g, '');  // Remove any other invalid chars
    
    // Path to SVG files in the frontend's public folder
    // Since backend and frontend are separate projects, we need to go up and over
    const frontendPath = path.join(process.cwd(), '..', 'animal-genius-frontend');
    const svgPath = path.join(frontendPath, 'public/avatars/animals', `${safeAnimalType}.svg`);
    
    // Check if file exists
    try {
      await fs.access(svgPath);
    } catch {
      return res.status(404).json({ error: 'Avatar not found' });
    }

    // Read the SVG file
    let svgContent = await fs.readFile(svgPath, 'utf-8');
    
    // Get color mappings for this animal type
    const colorMap = COLOR_MAPPINGS[safeAnimalType] || COLOR_MAPPINGS.default;
    
    let replacementCount = 0;
    
    // Replace colors - handle both hex colors in CSS and fill attributes
    for (const [originalColor, colorType] of Object.entries(colorMap)) {
      const targetColor = colorType === 'primary' ? primary : secondary;
      
      // Create regex that escapes special characters in hex colors
      const escapedColor = originalColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Count replacements for debugging
      let count = 0;
      
      // Replace in CSS style blocks (both with and without semicolon)
      svgContent = svgContent.replace(
        new RegExp(`fill:\\s*${escapedColor}(;|})`, 'gi'),
        (match) => {
          count++;
          return `fill: ${targetColor}${match.slice(-1)}`;
        }
      );
      
      // Also replace just the color value (for inline styles and CSS)
      svgContent = svgContent.replace(
        new RegExp(escapedColor, 'gi'),
        (match) => {
          count++;
          return targetColor as string;
        }
      );
      
      // Replace in fill attributes
      svgContent = svgContent.replace(
        new RegExp(`fill="${escapedColor}"`, 'gi'),
        (match) => {
          count++;
          return `fill="${targetColor}"`;
        }
      );
      
      if (count > 0) {
        console.log(`Replaced ${originalColor} -> ${targetColor}: ${count} times`);
        replacementCount += count;
      }
    }
    
    console.log(`Total color replacements: ${replacementCount}`);
    
    // TODO: Future feature - compose items
    if (items && typeof items === 'string') {
      // Will implement SVG composition for items later
      // const itemIds = items.split(',');
      // svgContent = await composeItems(svgContent, itemIds);
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    // CORS is handled by the main middleware, but for images we need crossorigin attribute
    
    // Send the processed SVG
    res.send(svgContent);
    
  } catch (error) {
    console.error('Error processing avatar:', error);
    res.status(500).json({ error: 'Failed to process avatar' });
  }
});

/**
 * GET /api/avatar/:animalType/preview
 * Returns avatar metadata for debugging
 */
router.get('/:animalType/preview', async (req, res) => {
  const { animalType } = req.params;
  const { primary = '#D4A574', secondary = '#FFFDD0' } = req.query;
  
  res.json({
    animalType,
    colors: { primary, secondary },
    url: `/api/avatar/${animalType}?primary=${encodeURIComponent(primary as string)}&secondary=${encodeURIComponent(secondary as string)}`,
    note: 'Use the url field as the src for an img tag'
  });
});

export { router as avatarProcessor };