# Bubble Pop Game - Rive Animation Specification

## Overview
This document specifies the Rive animations needed for the Bubble Pop mini-game.

## Current Implementation
We're using the existing `fish.riv` file from Supabase storage that includes:
- Fish swimming animations
- Direction changes (left/right)
- Happiness states

## State Machine: FishController

### Current Inputs (Already Implemented):
1. **happiness** (Number 0-100)
   - Controls fish expression/mood
   - 0-30: Sad fish
   - 30-70: Neutral fish
   - 70-100: Happy fish

2. **direction** (Number -1 to 1)
   - -1: Swimming left
   - 0: Idle/neutral
   - 1: Swimming right

### Additional Inputs Needed for Game:
1. **isMoving** (Boolean)
   - true: Swimming animation
   - false: Floating idle

2. **speed** (Number 0-1)
   - Controls animation speed
   - Could make fins move faster

## Animation States Needed:

### 1. Idle Float
- Gentle up/down bobbing
- Slight fin movement
- Occasional blink

### 2. Swimming
- Active fin propulsion
- Body tilt in movement direction
- Bubble particles trailing behind

### 3. Happy Reaction (when catching bubble)
- Quick spin or wiggle
- Eyes get bigger
- Maybe small hearts or stars

## Visual Requirements:
- Fish should be clearly visible at 60x60px
- Bright, friendly colors
- Clear directional facing
- Smooth transitions between states

## Bubble Animations (Future Enhancement)
For now, bubbles are CSS, but future Rive bubbles could include:
- Wobble while rising
- Pop animation with particles
- Different bubble types (colors/sizes)
- Shine/reflection effects

## Integration Notes:
- Fish position controlled by React (x/y coordinates)
- Rive handles all animations and visual states
- Collision detection remains in React
- State machine inputs driven by game logic