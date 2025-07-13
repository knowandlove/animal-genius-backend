# Bubble Pop Technical Approach - Fish Control Version

## Architecture Decision

Based on Gemini's analysis and Rive performance research, here's our approach:

### Core Principle: "React as Engine, Rive as Renderer"

**React handles:**
- Game state (fish position, bubble positions, score)
- Input handling (arrow keys)
- Game loop (requestAnimationFrame)
- **Collision detection** (distance calculations)
- Physics updates

**Rive handles:**
- Visual rendering
- Animations (fish swimming, bubble floating, pop effects)
- Visual states (happy fish, popped bubbles)

## Implementation Approach

### Option 1: Single Artboard with All Elements (Recommended for MVP)
Instead of dynamic nested artboards (which have limitations), use one Rive file with:

```
game.riv
├── Background layer
├── Fish (controlled by x/y inputs)
└── Bubble Pool (10-15 pre-made bubbles)
    ├── Bubble1 (controlled by active, x, y inputs)
    ├── Bubble2 (controlled by active, x, y inputs)
    └── ... up to Bubble15
```

**Pros:**
- Simpler to implement
- Better performance (no dynamic instantiation)
- Full control over all elements

**Cons:**
- Limited number of simultaneous bubbles
- Larger Rive file

### Option 2: React-Rendered Bubbles + Rive Fish (Alternative)
- Fish is rendered in Rive canvas
- Bubbles are React components (divs with CSS)
- Collision detection still in React

**Pros:**
- Unlimited bubbles
- Simpler Rive file
- Easy bubble variety

**Cons:**
- Mixed rendering (Rive + DOM)
- Potential layering issues

## Collision Detection Implementation

```typescript
// Simple circle-to-circle collision
function checkCollision(fish: Circle, bubble: Circle): boolean {
  const dx = fish.x - bubble.x;
  const dy = fish.y - bubble.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < fish.radius + bubble.radius;
}

// In game loop
gameState.bubbles.forEach((bubble, index) => {
  if (bubble.active && checkCollision(gameState.fish, bubble)) {
    // Collision detected!
    dispatch({ type: 'POP_BUBBLE', bubbleId: index });
    
    // Tell Rive to play pop animation
    bubblePopInputs[index]?.fire();
  }
});
```

## Fish Movement System

```typescript
// Velocity-based movement
const velocity = { x: 0, y: 0 };
const SPEED = 5;

// Input handling
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    switch(e.key) {
      case 'ArrowLeft': velocity.x = -SPEED; break;
      case 'ArrowRight': velocity.x = SPEED; break;
      case 'ArrowUp': velocity.y = -SPEED; break;
      case 'ArrowDown': velocity.y = SPEED; break;
    }
  };
  
  const handleKeyUp = (e: KeyboardEvent) => {
    switch(e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': velocity.x = 0; break;
      case 'ArrowUp':
      case 'ArrowDown': velocity.y = 0; break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);

// In game loop
fishPosition.x += velocity.x;
fishPosition.y += velocity.y;

// Update Rive
fishXInput?.value = fishPosition.x;
fishYInput?.value = fishPosition.y;
```

## Prototype Spike Plan

1. **Create simple Rive file with:**
   - Fish with x/y position inputs
   - 5 bubbles with active/x/y inputs
   - Pop animations for each bubble

2. **React component with:**
   - Arrow key input handling
   - Game loop (requestAnimationFrame)
   - Collision detection
   - Score tracking

3. **Test:**
   - Smooth fish movement
   - Collision accuracy
   - Performance with 5 bubbles
   - Animation triggering

## Complexity Assessment

**Medium Complexity** - More complex than click-to-pop but manageable:
- ✅ Arrow key input is straightforward
- ✅ Collision detection is simple math
- ✅ Rive position control is well-documented
- ⚠️ Smooth movement requires game loop
- ⚠️ Managing multiple bubble states
- ⚠️ Synchronizing React state with Rive visuals

## Next Steps

1. Build the spike prototype
2. Validate performance
3. Choose between Option 1 or 2
4. Expand to full game