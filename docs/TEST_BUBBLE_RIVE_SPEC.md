# Test Bubble Rive File Specification

## Purpose
Create a minimal Rive file to validate the core game interaction between Rive and React.

## File Structure

### Artboard: "BubbleGame"
- **Size**: 800x600px
- **Background**: Transparent

### Objects:
1. **Bubble Shape**
   - Simple circle (100x100px)
   - Blue fill (#4A90E2)
   - Center position (400, 300)
   - Name: "bubble1"

### State Machine: "BubbleGameSM"

#### States:
1. **Idle**
   - Default state
   - Bubble has slight floating animation (y position ±10px, 2s loop)
   - Scale: 1.0

2. **Popped**
   - Triggered by pointer down on bubble
   - Quick scale animation: 1.0 → 1.2 → 0 (0.3s)
   - Optional: particle burst effect

#### Listeners:
1. **Pointer Down**
   - Target: bubble1
   - Action: Transition to "Popped" state

#### Inputs:
1. **gameStart** (Trigger)
   - Resets bubble to idle state
   
2. **spawnBubble** (Number 0-1)
   - Controls x position of bubble (0 = left, 1 = right)

#### Events:
1. **On Enter "Popped" State**
   - Fire event: "bubble_popped:bubble1"
   - This will be captured by React

## Testing Flow:
1. Load Rive file in React component
2. Click/tap bubble
3. Bubble plays pop animation
4. React receives "bubble_popped" event
5. Score updates in React UI

## Success Criteria:
- ✅ Rive canvas renders in React
- ✅ Click detection works on Rive objects
- ✅ State transitions trigger correctly
- ✅ Events pass from Rive to React
- ✅ React can control Rive via inputs

## Next Steps:
Once this prototype validates the interaction model, we can:
1. Add multiple bubbles
2. Implement different bubble types
3. Add fish character
4. Create full game state machine