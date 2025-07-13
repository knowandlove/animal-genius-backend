# 🫧 Bubble Pop Challenge - Game Design Document

## Overview
**Game Title**: Bubble Pop Challenge  
**Platform**: Web (React + Rive)  
**Target Audience**: K-12 Students  
**Game Duration**: 60-90 seconds per session  
**Core Loop**: Move fish → Pop good bubbles → Avoid bad bubbles → Earn happiness points  
**Sound**: Minimal (classroom-friendly)

## Game Concept
A simple, engaging arcade game where players control their pet fish to pop bubbles for points. Different bubble types provide variety and challenge, encouraging strategic movement while improving their pet's happiness. Designed to be quiet and non-disruptive for classroom environments.

## Core Mechanics

### 1. Movement System
- **Control Method**: 
  - Desktop: Arrow keys or WASD
  - Mobile: Touch and drag or virtual joystick
- **Movement Style**: Smooth, responsive swimming
- **Speed**: Consistent with slight momentum
- **Boundaries**: Screen edges act as walls

### 2. Bubble System

#### Bubble Types & Properties
| Bubble Type | Size | Speed | Points | Visual |
|-------------|------|-------|--------|---------|
| **Small Blue** | 20px | Fast (3px/s) | +1 | Light blue, transparent |
| **Medium Green** | 35px | Medium (2px/s) | +3 | Green with shimmer |
| **Large Gold** | 50px | Slow (1px/s) | +5 | Gold with glow effect |
| **Tiny Silver** | 15px | Very Fast (4px/s) | +10 | Silver, hard to catch |
| **Red Danger** | 40px | Medium (2px/s) | -5 | Red with warning pulse |
| **Black Void** | 30px | Varies | -10 | Black with dark aura |
| **Rainbow Bonus** | 45px | Slow (1px/s) | +20 | Color shifting |

#### Spawn Patterns
- **Wave 1 (0-20s)**: Mostly blue and green, rare gold
- **Wave 2 (20-40s)**: Mix of all positive types, introduce red
- **Wave 3 (40-60s)**: Faster spawning, more danger bubbles
- **Wave 4 (60s+)**: Chaos mode - all types, maximum speed

### 3. Scoring System
- **Base Points**: As listed in bubble table
- **Streak Bonus**: 
  - 5 bubbles without missing = +10 bonus
  - 10 bubbles = +25 bonus
  - 20 bubbles = +50 bonus
- **Perfect Timing**: Pop bubble at maximum size = 1.5x points
- **Near Miss Penalty**: Let good bubble escape top = -1 point

### 4. Special Mechanics
- **Bubble Clusters**: Sometimes 3-5 small bubbles spawn together
- **Bubble Trails**: Silver bubbles leave a point trail when popped
- **Danger Zones**: Red bubbles create temporary danger areas
- **Size Change**: Some bubbles grow/shrink while rising

## Game Flow

### Start Screen
1. Fish swimming idle with bubbles floating by
2. "Tap to Start" button
3. Best score and today's attempts
4. Visual tutorial showing good/bad bubbles

### Gameplay States
1. **Ready** (3-2-1 countdown)
2. **Playing** (60-90 seconds)
3. **Warning** (screen edge flash when near danger)
4. **Game Over** (Score display and rewards)

### End Game Summary
- Total score
- Bubbles popped (by type)
- Longest streak
- Happiness earned
- New best score celebration

## Visual Design

### Environment
- **Background**: Simple underwater gradient
  - Top: Light blue (surface)
  - Bottom: Darker blue (depth)
- **Ambient Elements**: 
  - Gentle light rays from above
  - Occasional background fish (decorative)
  - Subtle water caustics

### Fish Animations (Rive States)
1. **Idle Float**: Gentle hovering with fin movement
2. **Swim Left/Right**: Directional fin strokes
3. **Swim Up/Down**: Vertical movement animations
4. **Quick Dash**: Fast movement burst
5. **Pop Success**: Happy wiggle
6. **Hit Danger**: Startled shake
7. **Streak Mode**: Glowing effect

### Bubble Animations (Rive States)
1. **Spawn**: Fade in with small grow
2. **Rising**: Gentle wobble while ascending
3. **Pop Good**: Burst into sparkles
4. **Pop Bad**: Dark implosion effect
5. **Escape**: Fade out at top
6. **Pulse**: Size oscillation for special bubbles

## UI/UX Design

### HUD Elements (Minimal)
- **Score**: Top center, large clear numbers
- **Streak Counter**: Small indicator below score
- **Timer**: Progress bar or countdown (top)
- **Pause Button**: Top right corner

### Visual Feedback
- **Good Pop**: 
  - Point value floats up (+3, +5, etc.)
  - Subtle sparkle effect
  - Fish happy animation
- **Bad Pop**: 
  - Red flash on fish
  - Screen edge warning pulse
  - Point loss indicator (-5, -10)
- **Streak Achievement**: 
  - Golden outline on fish
  - Streak number display

### Sound Design (Minimal)
- **Master Volume**: Off by default
- **Essential Sounds** (if enabled):
  - Soft pop (different pitch per bubble type)
  - Danger warning (subtle)
  - Game over chime
- **No Background Music**

## Rewards System

### Happiness Points
- **Base Rewards**:
  - 0-50 points: +5 happiness
  - 51-100 points: +10 happiness
  - 101-200 points: +15 happiness
  - 200+ points: +20 happiness
- **Bonuses**:
  - First game of day: +5 extra
  - Beat personal best: +10 extra
  - Perfect game (no bad bubbles): +15 extra

### Milestones
- **Bubble Popper**: Pop 50 bubbles in one game
- **Streak Master**: Achieve a 20-bubble streak
- **Careful Swimmer**: Complete game with no red/black bubbles
- **Speed Demon**: Pop 10 bubbles in 5 seconds
- **High Scorer**: Reach 300 points

## Technical Specifications

### Performance Requirements
- Target 60 FPS on all devices
- Maximum 30MB memory usage
- Load time < 2 seconds
- Works offline after initial load

### Difficulty Balancing
```javascript
// Spawn rate increases over time
spawnRate = baseRate * (1 + (timeElapsed / 60));

// Bubble speed variance
bubbleSpeed = baseSpeed * (0.8 + Math.random() * 0.4);

// Danger bubble probability
dangerChance = Math.min(0.3, timeElapsed / 200);
```

### Data Storage
- High score (localStorage)
- Daily play count
- Total bubbles popped
- Achievement progress
- Settings (sound on/off)

## Accessibility Features
- **Colorblind Mode**: Shapes on bubbles
- **Reduced Motion**: Less wobble/effects
- **High Contrast**: Darker backgrounds
- **Larger Bubbles**: Easy mode option

## Implementation Phases

### Phase 1: Core Prototype (3-4 days)
- Basic fish movement
- Bubble spawning system
- Collision detection
- Score tracking

### Phase 2: Rive Integration (3-4 days)
- Import fish animations
- Create bubble animations
- Add particle effects
- Polish transitions

### Phase 3: Game Feel (2-3 days)
- Difficulty curve tuning
- Streak system
- Visual feedback
- Performance optimization

### Phase 4: Integration (2-3 days)
- Connect to pet happiness
- Save system
- Analytics
- Testing

## Future Enhancements
1. **Challenge Modes**: 
   - Survival (how long can you last?)
   - Target Score (reach X points in time)
   - Precision (only specific bubble types)

2. **Power-ups** (Optional):
   - Bubble Magnet (attracts good bubbles)
   - Shield (one bad bubble protection)
   - Slow Time (bubbles move slower)

3. **Competitive Features**:
   - Class leaderboards
   - Daily challenges
   - Ghost mode (see friend's best run)

4. **Pet Variety**:
   - Different fish have different abilities
   - Special animations per fish type
   - Unique bubble interactions

## Success Metrics
- Average session > 2 games
- 70% of players return next day
- Low bounce rate (< 20%)
- Positive happiness impact
- No classroom disruption reports