# Store Items Storage Directory Structure

## Overview

All store item assets are stored in Supabase Storage using a standardized directory structure for organization and scalability.

## Directory Structure

```
store-items/                          # Main bucket for all store assets
├── avatar/                          # Avatar customization items
│   ├── hats/                       # Hat items
│   │   ├── baseball_cap.png
│   │   ├── wizard_hat.png
│   │   ├── crown.png
│   │   └── _thumbnails/            # Auto-generated 128x128 thumbnails
│   │       ├── baseball_cap_thumb.jpg
│   │       ├── wizard_hat_thumb.jpg
│   │       └── crown_thumb.jpg
│   ├── glasses/                    # Eyewear items
│   │   ├── sunglasses.png
│   │   ├── reading_glasses.png
│   │   ├── vr_headset.png
│   │   └── _thumbnails/
│   │       ├── sunglasses_thumb.jpg
│   │       └── ...
│   └── accessories/                # Other wearables
│       ├── bow_tie.png
│       ├── necklace.png
│       ├── cape.png
│       └── _thumbnails/
│           ├── bow_tie_thumb.jpg
│           └── ...
│
├── room/                           # Room customization items
│   ├── furniture/                  # Furniture items
│   │   ├── study_desk.png
│   │   ├── gaming_chair.png
│   │   ├── bookshelf.png
│   │   └── _thumbnails/
│   │       └── ...
│   ├── decorations/               # Decorative items
│   │   ├── potted_plant.png
│   │   ├── wall_clock.png
│   │   ├── lava_lamp.png
│   │   └── _thumbnails/
│   │       └── ...
│   ├── wallpapers/                # Wall patterns
│   │   ├── sky_blue.png
│   │   ├── space_theme.png
│   │   ├── galaxy_swirl.png
│   │   └── _thumbnails/
│   │       └── ...
│   └── flooring/                  # Floor patterns
│       ├── wooden_floor.png
│       ├── carpet.png
│       ├── checkerboard.png
│       └── _thumbnails/
│           └── ...
│
├── special/                        # Special items
│   ├── pets/                      # Pet items (like fish bowl)
│   ├── effects/                   # Special effects
│   └── _thumbnails/
│
└── _archive/                      # Archived/replaced items
    └── 2025-01/                  # Archive by date
        └── old_item.png
```

## Naming Conventions

### File Names
- Use lowercase with underscores: `wizard_hat.png`, not `WizardHat.png`
- Be descriptive but concise: `gaming_chair.png`, not `chair.png`
- Include variant in name if applicable: `sunglasses_red.png`

### Thumbnails
- Automatically generated with `_thumb.jpg` suffix
- Always JPEG format for consistency
- Fixed 128x128 size for catalog display
- Stored in `_thumbnails` subdirectory

## Upload Process

1. **Admin uploads image** via `/api/admin/upload-asset`
2. **System processes**:
   - Validates image (type, size, dimensions)
   - Optimizes main image (max 2048x2048)
   - Generates 128x128 thumbnail
3. **Storage paths**:
   - Main: `store-items/{category}/{subcategory}/{filename}`
   - Thumb: `store-items/{category}/{subcategory}/_thumbnails/{filename}_thumb.jpg`
4. **Database records** created in `assets` table

## Item Categories Mapping

| Item Type Code | Storage Path |
|---------------|--------------|
| avatar_hat | avatar/hats/ |
| avatar_glasses | avatar/glasses/ |
| avatar_accessory | avatar/accessories/ |
| room_furniture | room/furniture/ |
| room_decoration | room/decorations/ |
| room_wallpaper | room/wallpapers/ |
| room_flooring | room/flooring/ |

## Best Practices

1. **Image Requirements**:
   - Max dimensions: 4096x4096
   - Recommended: 512x512 for items, 1024x1024 for wallpapers
   - Formats: PNG (with transparency), JPEG, WebP
   - Avoid GIFs unless animated

2. **Organization**:
   - Keep related items together
   - Use consistent naming within categories
   - Archive old versions instead of deleting

3. **Performance**:
   - Thumbnails reduce catalog load time
   - Optimized images save bandwidth
   - CDN caching improves delivery

## Migration Notes

When migrating existing items:
1. Upload new optimized versions
2. Update database references
3. Move old files to `_archive` with date
4. Verify all references updated

## API Integration

The directory structure is enforced by:
- `StorageRouter.uploadFile()` - handles path construction
- `upload-asset.ts` - validates and processes uploads
- Item type determines folder automatically

Example upload:
```javascript
// Uploading a wizard hat
POST /api/admin/upload-asset
{
  type: "item",
  itemType: "avatar_hat",  // Maps to avatar/hats/
  name: "Wizard Hat",
  bucket: "store-items"
}
```

## Future Considerations

- Implement CDN for global distribution
- Add image versioning support
- Support for Rive animation files
- Bulk upload with ZIP extraction
- Automatic old file cleanup