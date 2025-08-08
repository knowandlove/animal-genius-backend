import { Router } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';

const router = Router();

/**
 * Process SVG by targeting specific elements with IDs
 * Only elements with IDs containing 'primary' or 'secondary' should be colored
 */
function processSvgColors(svgContent: string, primaryColor: string, secondaryColor: string): string {
  console.log('Processing SVG with colors:', { primaryColor, secondaryColor });
  
  // Create darker versions of the colors for primaryDark and secondaryDark
  const primaryDark = darkenColor(primaryColor, 0.2);
  const secondaryDark = darkenColor(secondaryColor, 0.2);
  
  let replacementCount = 0;
  
  // Strategy: Find elements by ID and add inline style to override class
  // Match both self-closing and regular tags with id attributes
  svgContent = svgContent.replace(
    /<(path|circle|ellipse|rect|polygon|g)(\s+[^>]*?id="([^"]*?)"[^>]*?)(\/?>)/g,
    (match, tagName, attributes, id, closingTag) => {
      // Check if this element's ID indicates it should be colored
      const idLower = id.toLowerCase();
      let newFill: string | null = null;
      
      if (idLower.includes('_primary') && !idLower.includes('dark')) {
        newFill = primaryColor;
      } else if (idLower.includes('_primarydark')) {
        newFill = primaryDark;
      } else if (idLower.includes('_secondary') && !idLower.includes('dark')) {
        newFill = secondaryColor;
      } else if (idLower.includes('_secondarydark')) {
        newFill = secondaryDark;
      }
      
      if (newFill) {
        replacementCount++;
        console.log(`Adding style for #${id} with ${newFill}`);
        
        // Check if there's already a style attribute
        if (attributes.includes('style="')) {
          // Update existing style attribute
          const updatedAttributes = attributes.replace(
            /style="([^"]*)"/g,
            (styleMatch, styleContent) => {
              // Remove any existing fill from style
              const cleanedStyle = styleContent.replace(/fill:\s*[^;]+;?/g, '').trim();
              // Add new fill at the beginning
              const separator = cleanedStyle ? '; ' : '';
              return `style="fill: ${newFill}${separator}${cleanedStyle}"`;
            }
          );
          return `<${tagName}${updatedAttributes}${closingTag}`;
        } else {
          // Add style attribute before the closing bracket
          // Insert the style attribute right before the closing tag
          return `<${tagName}${attributes} style="fill: ${newFill}"${closingTag}`;
        }
      }
      
      return match; // Return unchanged if not a target element
    }
  );
  
  console.log(`Total elements with colors updated: ${replacementCount}`);
  
  return svgContent;
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  // Remove # if present
  const color = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Darken each component
  const newR = Math.round(r * (1 - percent));
  const newG = Math.round(g * (1 - percent));
  const newB = Math.round(b * (1 - percent));
  
  // Convert back to hex
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

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
    
    // Path to SVG files - now stored in backend's public folder for production
    const svgPath = path.join(process.cwd(), 'public/avatars/animals', `${safeAnimalType}.svg`);
    
    // Check if file exists
    try {
      await fs.access(svgPath);
    } catch {
      console.error(`Avatar file not found: ${svgPath}`);
      return res.status(404).json({ error: 'Avatar not found' });
    }

    // Read the SVG file
    let svgContent = await fs.readFile(svgPath, 'utf-8');
    
    // Process the SVG to replace colors only on specific elements
    svgContent = processSvgColors(svgContent, primary as string, secondary as string);
    
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