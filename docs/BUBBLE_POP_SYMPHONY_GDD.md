# 🫧 Bubble Pop Symphony - Game Design Document

## Overview
**Game Title**: Bubble Pop Symphony  
**Platform**: Web (React + Rive)  
**Target Audience**: K-12 Students  
**Game Duration**: 60-90 seconds per session  
**Core Loop**: Move fish → Pop bubbles → Create music → Earn happiness points  

## Game Concept
A musical arcade game where players control their pet fish to pop bubbles, creating melodies while earning points. Each bubble produces a musical note, encouraging players to create harmonious combinations while improving their pet's happiness.

## Core Mechanics

### 1. Movement System
- **Control Method**: 
  - Desktop: Arrow keys or WASD
  - Mobile: Touch and drag or virtual joystick
- **Movement Style**: Smooth, physics-based swimming
- **Speed**: Base speed with slight acceleration
- **Boundaries**: Soft boundaries that gently push fish back

### 2. Bubble System
- **Spawn Pattern**: Bubbles rise from bottom at varying speeds
- **Bubble Types**:
  - 🔵 **Blue Bubbles** - C note (1 point)
  - 🟢 **Green Bubbles** - E note (2 points)
  - 🟡 **Yellow Bubbles** - G note (3 points)
  - 🔴 **Red Bubbles** - B note (4 points)
  - 🌈 **Rainbow Bubbles** - Chord (10 points + bonus mode)
  - ⚫ **Black Bubbles** - Dissonant note (-2 points, avoid!)

### 3. Scoring System
- **Base Points**: As listed above per bubble type
- **Combo Multiplier**: 
  - 3 bubbles in 2 seconds = 2x multiplier
  - 5 bubbles in 3 seconds = 3x multiplier
  - 10 bubbles in 5 seconds = 5x multiplier
- **Musical Bonus**: Pop bubbles in harmonic sequence for +20% score
- **Perfect Pop**: Hit bubble at maximum size for +50% points

### 4. Musical System
- **Note Mapping**: Each bubble color plays a pentatonic scale note
- **Harmony Detection**: System recognizes chord progressions
- **Background Track**: Ambient ocean sounds with adaptive tempo
- **Sound Effects**: 
  - Bubble pop (pitched to note)
  - Combo achievement chime
  - Miss/hit wrong bubble sound

## Game Flow

### Start Screen
1. Fish swimming idle in background
2. "Tap to Start" with bubble animation
3. Best score display
4. Quick tutorial option

### Gameplay States
1. **Ready** (3-second countdown)
2. **Playing** (60-90 seconds)
3. **Bonus Rush** (10 seconds, triggered by rainbow bubble)
4. **Game Over** (Score summary and rewards)

### Difficulty Progression
- **0-20 seconds**: Slow bubbles, basic patterns
- **20-40 seconds**: Medium speed, more bubbles
- **40-60 seconds**: Fast bubbles, complex patterns
- **60+ seconds**: Chaos mode with bubble streams

## Visual Design

### Environment
- **Background**: Underwater scene with parallax layers
  - Far: Deep blue gradient
  - Mid: Seaweed swaying
  - Near: Coral decorations
- **Lighting**: Caustic water effects from above
- **Particles**: Small plankton floating for depth

### Fish Animation States (Rive)
1. **Idle**: Gentle fin movement, occasional blink
2. **Swimming**: Dynamic fin propulsion
3. **Turning**: Body tilt and fin adjustment
4. **Popping**: Mouth opens, eyes widen
5. **Happy**: Spin animation on combo
6. **Worried**: When near black bubble

### Bubble Animations (Rive)
1. **Rising**: Gentle wobble with size variation
2. **Pre-pop**: Slight expansion when touched
3. **Pop**: Burst into smaller bubbles
4. **Chain reaction**: Nearby bubbles wiggle

## UI/UX Design

### HUD Elements
- **Score**: Top center, large friendly font
- **Combo Meter**: Left side, filling bar
- **Timer**: Top right, countdown display
- **Happiness Preview**: Small meter showing potential gain

### Visual Feedback
- **Screen shake**: On black bubble hit
- **Color flash**: On combo achievement
- **Trail effect**: Behind fish during bonus mode
- **Particle burst**: On perfect pops

## Rewards System

### Happiness Points
- **Participation**: +5 happiness for playing
- **Score Tiers**:
  - 0-50 points: +5 happiness
  - 51-100 points: +10 happiness
  - 101-200 points: +15 happiness
  - 200+ points: +20 happiness
- **First Game Bonus**: 2x happiness (once per day)

### Achievements
- **Bubble Maestro**: Pop 100 bubbles in one game
- **Harmony Master**: Create 5 chord progressions
- **Perfect Swimmer**: No black bubbles hit
- **Speed Demon**: Pop 20 bubbles in 10 seconds

## Rive State Machine Design

### Fish State Machine
```
States:
- Idle
  - Transitions to: Swimming (on input)
- Swimming
  - Transitions to: Turning (on direction change)
  - Transitions to: Popping (on bubble collision)
- Turning
  - Transitions to: Swimming (on completion)
- Popping
  - Transitions to: Happy (on combo)
  - Transitions to: Swimming (on completion)
- Happy
  - Transitions to: Swimming (after 1 second)

Inputs:
- horizontalSpeed (-1 to 1)
- verticalSpeed (-1 to 1)
- isPoping (boolean)
- comboLevel (0-5)
```

### Bubble State Machine
```
States:
- Spawning
  - Transitions to: Rising (immediately)
- Rising
  - Transitions to: Popping (on collision)
  - Transitions to: Despawning (at top)
- Popping
  - Transitions to: Destroyed (on completion)

Inputs:
- riseSpeed (0.5 to 2)
- bubbleType (0-5)
- isPerfectPop (boolean)
```

## Technical Specifications

### Performance Targets
- 60 FPS on modern devices
- 30 FPS minimum on older devices
- < 50MB memory usage
- < 2 second load time

### Asset Requirements
- Fish sprite: 512x512 (or vector in Rive)
- Bubble sprites: 128x128 each
- Background: 1920x1080 (scaled)
- Audio files: .mp3 or .ogg, < 100KB each

### Data Tracking
- High score (local storage)
- Total bubbles popped (for achievements)
- Average combo level
- Play frequency (for daily bonus)

## Educational Integration

### Optional Math Mode
- Bubbles show numbers
- Pop bubbles that sum to target number
- Multiplication/division variants for older students

### Pattern Recognition
- Sequence challenges between rounds
- Memory game elements with bubble colors
- Rhythm training with timed pops

## Implementation Phases

### Phase 1: Core Prototype (Week 1)
- Basic fish movement
- Bubble spawning and collision
- Score tracking
- Simple sound effects

### Phase 2: Rive Integration (Week 2)
- Fish animations
- Bubble animations
- Water effects
- Particle systems

### Phase 3: Polish & Features (Week 3)
- Musical system
- Combo mechanics
- Achievements
- UI polish

### Phase 4: Integration (Week 4)
- Connect to pet happiness system
- Leaderboards
- Analytics
- Testing and balancing

## Monetization & Economy
- **No direct monetization** - Game is free
- **Coin rewards**: Not implemented initially
- **Energy system**: No limits on play
- **Focus**: Pure engagement and happiness generation

## Success Metrics
- Average session length > 2 minutes
- Daily active players > 50% of pet owners
- Happiness points generated per session
- Player retention after 7 days

## Future Enhancements
1. **Multiplayer Mode**: Competitive bubble popping
2. **Level System**: Themed stages (coral reef, deep sea, etc.)
3. **Power-ups**: Bubble magnet, slow time, multi-pop
4. **Fish Customization**: Unlock colors/patterns through play
5. **Musical Creation Mode**: Record and share compositions