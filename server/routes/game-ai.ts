import { Router, Request, Response } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODEL_CONFIG, RESPONSE_TEMPLATES } from '../config/kal-personality'

const router = Router()

// Initialize Gemini - will use GOOGLE_API_KEY from env
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

// Track recent commands for cooldown
const recentDramaticChanges = new Map<string, number>()

interface GameAIRequest {
  message: string
  gameState?: {
    score: number
    time: number
  }
}

interface GameAIResponse {
  message: string
  commands?: string[]
}

router.post('/game-assistant', async (req: Request<{}, {}, GameAIRequest>, res: Response<GameAIResponse>) => {
  try {
    const { message: userMessage, gameState } = req.body

    // Check if API key is configured
    if (!process.env.GOOGLE_API_KEY) {
      // Fallback to a helpful message
      res.json({
        message: "I'd love to help customize your game! To enable AI features, ask your teacher to set up a Google API key. For now, try commands like 'color blue' or 'jump 500'!",
        commands: []
      })
      return
    }

    // Parse simple direct commands first
    const lowerMessage = userMessage.toLowerCase()
    let directCommand: string | null = null
    
    // Check for simple color requests
    const colorMatch = lowerMessage.match(/make me (\w+)|color me (\w+)|turn me (\w+)|change.*to (\w+)|i want to be (\w+)|can i be (\w+)/)
    if (colorMatch) {
      const requestedColor = colorMatch[1] || colorMatch[2] || colorMatch[3] || colorMatch[4] || colorMatch[5] || colorMatch[6]
      const validColors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'pink', 'cyan']
      if (validColors.includes(requestedColor)) {
        directCommand = `color ${requestedColor}`
      }
    }
    
    // Check for simple gravity/jump/speed requests
    const numberMatch = lowerMessage.match(/(gravity|jump|speed)\s*(\d+)/)
    if (numberMatch && !directCommand) {
      directCommand = `${numberMatch[1]} ${numberMatch[2]}`
    }
    
    // Check for slang/abbreviated commands only if no direct command found
    if (!directCommand) {
      for (const [slang, response] of Object.entries(RESPONSE_TEMPLATES.slangMappings)) {
        if (lowerMessage.includes(slang)) {
          userMessage = response + " " + userMessage
          break
        }
      }
    }

    // Check for intent-based commands
    let suggestedCommands: string[] = []
    for (const [intent, commands] of Object.entries(RESPONSE_TEMPLATES.intentMappings)) {
      if (lowerMessage.includes(intent)) {
        if (Array.isArray(commands)) {
          suggestedCommands = commands
        }
        break
      }
    }

    // Create model with safety settings and system instruction
    const model = genAI.getGenerativeModel({
      model: MODEL_CONFIG.model,
      generationConfig: MODEL_CONFIG.generationConfig,
      safetySettings: MODEL_CONFIG.safetySettings,
      systemInstruction: MODEL_CONFIG.systemInstruction
    })

    // Simplified prompt since system instruction handles most of the personality
    const prompt = `
Current game state: Score ${gameState?.score || 0}, Time ${Math.floor(gameState?.time || 0)}s

User message: "${userMessage}"

${directCommand ? `IMPORTANT: The user requested this specific command: "${directCommand}". You MUST execute this exact command.` : ''}
${suggestedCommands.length > 0 && !directCommand ? `Consider these commands: ${suggestedCommands.join(', ')}` : ''}

Include any game commands in [COMMANDS] blocks.
${Math.random() < 0.3 ? `Maybe include this fun fact: ${RESPONSE_TEMPLATES.funFacts[Math.floor(Math.random() * RESPONSE_TEMPLATES.funFacts.length)]}` : ''}
`

    const result = await model.generateContent(prompt)
    const aiResponse = result.response.text()
    
    // Extract commands from response
    const commands: string[] = []
    const commandMatch = aiResponse.match(/\[COMMANDS\]([\s\S]*?)\[\/COMMANDS\]/)
    if (commandMatch) {
      const commandText = commandMatch[1].trim()
      const rawCommands = commandText.split('\n').filter(cmd => cmd.trim())
      
      // Validate and limit commands (max 3 to prevent chaos)
      for (const cmd of rawCommands.slice(0, 3)) {
        const validatedCmd = validateCommand(cmd)
        if (validatedCmd) {
          commands.push(validatedCmd)
        }
      }
    }

    // Remove command block from message
    let cleanMessage = aiResponse.replace(/\[COMMANDS\][\s\S]*?\[\/COMMANDS\]/, '').trim()
    
    // Add warnings for extreme values
    const warnings = getCommandWarnings(commands)
    if (warnings.length > 0) {
      cleanMessage += "\n\n⚠️ " + warnings.join(" ")
    }

    res.json({ message: cleanMessage, commands })
  } catch (error) {
    console.error('Game AI error:', error)
    
    // Helpful fallback that doesn't expose the error
    res.json({ 
      message: "Hmm, I'm having trouble thinking right now. Try simple commands like 'color red' or 'jump 400', or type 'help' to see what I can do!",
      commands: []
    })
  }
})

// Validate commands to ensure they're safe
function validateCommand(command: string): string | null {
  const parts = command.toLowerCase().trim().split(' ')
  const action = parts[0]
  const value = parts.slice(1).join(' ')

  // Define simple, safe limits
  const limits = {
    gravity: { min: 0, max: 2000 },
    jump: { min: 100, max: 600 },
    speed: { min: 50, max: 400 }
  }

  switch (action) {
    case 'gravity':
    case 'jump':
    case 'speed':
      const num = parseInt(value)
      if (!isNaN(num) && limits[action]) {
        const { min, max } = limits[action]
        const clamped = Math.max(min, Math.min(max, num))
        return `${action} ${clamped}`
      }
      break
      
    case 'color':
    case 'shape':
    case 'platform':
    case 'restart':
      return command.toLowerCase()
  }
  
  return null
}

// Get warnings for extreme commands
function getCommandWarnings(commands: string[]): string[] {
  const warnings: string[] = []
  
  // Simple warnings for extreme values
  const extremeWarnings: { [key: string]: string } = {
    "gravity 0": "Zero gravity! You'll float like in space! 🚀",
    "gravity 2000": "Super heavy gravity! Jumping will be tough! 💪",
    "speed 400": "Maximum speed! Hold on tight! 🏃‍♂️",
    "jump 600": "Super jump activated! You might fly really high! 🦘"
  }
  
  for (const cmd of commands) {
    if (extremeWarnings[cmd]) {
      warnings.push(extremeWarnings[cmd])
    }
  }
  
  return warnings
}

export default router