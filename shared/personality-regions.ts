// Define personality regions for the Live Discovery Board
export interface PersonalityRegion {
  name: string;
  color: string;
  animals: string[];
  position: {
    x: number; // percentage from left
    y: number; // percentage from top
  };
  description: string;
}

export const ANIMAL_REGIONS: PersonalityRegion[] = [
  {
    name: "The Guardians",
    color: "#4CAF50",
    animals: ["Elephant", "Bear", "Beaver"],
    position: { x: 25, y: 25 },
    description: "Loyal, reliable, and protective personalities"
  },
  {
    name: "The Artisans", 
    color: "#FF9800",
    animals: ["Fox", "Cat", "Dolphin"],
    position: { x: 75, y: 25 },
    description: "Creative, adaptable, and spontaneous personalities"
  },
  {
    name: "The Idealists",
    color: "#9C27B0", 
    animals: ["Wolf", "Horse", "Butterfly"],
    position: { x: 25, y: 75 },
    description: "Intuitive, empathetic, and values-driven personalities"
  },
  {
    name: "The Rationals",
    color: "#2196F3",
    animals: ["Eagle", "Owl", "Tiger"],
    position: { x: 75, y: 75 },
    description: "Strategic, independent, and competency-focused personalities"
  }
];

// Helper function to get animal emoji
export function getAnimalEmoji(animalType: string): string {
  const animalEmojis: Record<string, string> = {
    "Elephant": "🐘",
    "Bear": "🐻", 
    "Beaver": "🦫",
    "Fox": "🦊",
    "Cat": "🐱",
    "Dolphin": "🐬",
    "Wolf": "🐺",
    "Horse": "🐴",
    "Butterfly": "🦋",
    "Eagle": "🦅",
    "Owl": "🦉",
    "Tiger": "🐯"
  };
  
  return animalEmojis[animalType] || "🦁"; // Default to lion if not found
}

// Interface for live submission data
export interface LiveSubmission {
  studentName: string;
  animalType: string;
  timestamp: string;
  mbtiType?: string;
  learningStyle?: string;
}