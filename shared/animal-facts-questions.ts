// Animal Facts Question Bank
// This file is kept for future use when game features are re-implemented on a different server

// Temporarily define GameQuestion type locally
interface GameQuestion {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  category: 'habitat' | 'diet' | 'behavior' | 'facts';
}

export const animalFactsQuestions: GameQuestion[] = [
  // Habitat Questions
  {
    id: 1,
    question: "Which animal lives in underground burrows in the African savanna?",
    options: {
      A: "Meerkat",
      B: "Panda",
      C: "Parrot",
      D: "Otter"
    },
    correctAnswer: "A",
    category: "habitat"
  },
  {
    id: 2,
    question: "Where do sea otters spend most of their time?",
    options: {
      A: "In trees",
      B: "Underground",
      C: "In the ocean",
      D: "In caves"
    },
    correctAnswer: "C",
    category: "habitat"
  },
  {
    id: 3,
    question: "Giant pandas are native to which country?",
    options: {
      A: "India",
      B: "China",
      C: "Japan",
      D: "Australia"
    },
    correctAnswer: "B",
    category: "habitat"
  },
  {
    id: 4,
    question: "Where do beavers build their homes?",
    options: {
      A: "In trees",
      B: "On mountain tops",
      C: "In rivers and streams",
      D: "In the desert"
    },
    correctAnswer: "C",
    category: "habitat"
  },

  // Diet Questions
  {
    id: 5,
    question: "What makes up 99% of a giant panda's diet?",
    options: {
      A: "Fish",
      B: "Bamboo",
      C: "Fruit",
      D: "Insects"
    },
    correctAnswer: "B",
    category: "diet"
  },
  {
    id: 6,
    question: "What is an owl's favorite food?",
    options: {
      A: "Seeds and nuts",
      B: "Leaves and grass",
      C: "Small mammals like mice",
      D: "Honey"
    },
    correctAnswer: "C",
    category: "diet"
  },
  {
    id: 7,
    question: "Sea otters love to eat which spiky ocean creature?",
    options: {
      A: "Sea urchins",
      B: "Jellyfish",
      C: "Starfish",
      D: "Coral"
    },
    correctAnswer: "A",
    category: "diet"
  },
  {
    id: 8,
    question: "What do elephants spend up to 16 hours a day doing?",
    options: {
      A: "Swimming",
      B: "Sleeping",
      C: "Playing",
      D: "Eating"
    },
    correctAnswer: "D",
    category: "diet"
  },

  // Behavior Questions
  {
    id: 9,
    question: "Meerkats take turns doing what important job?",
    options: {
      A: "Hunting for food",
      B: "Standing guard for predators",
      C: "Building burrows",
      D: "Teaching babies"
    },
    correctAnswer: "B",
    category: "behavior"
  },
  {
    id: 10,
    question: "How do parrots show they're happy?",
    options: {
      A: "They sleep more",
      B: "They stop eating",
      C: "They bob their heads and dance",
      D: "They become very quiet"
    },
    correctAnswer: "C",
    category: "behavior"
  },
  {
    id: 11,
    question: "Why do otters hold hands while sleeping?",
    options: {
      A: "To stay warm",
      B: "To not drift apart in the water",
      C: "To share food",
      D: "To communicate"
    },
    correctAnswer: "B",
    category: "behavior"
  },
  {
    id: 12,
    question: "Border Collies are famous for herding which animals?",
    options: {
      A: "Cats",
      B: "Chickens",
      C: "Sheep",
      D: "Fish"
    },
    correctAnswer: "C",
    category: "behavior"
  },

  // Fun Facts Questions
  {
    id: 13,
    question: "How many hours a day do pandas spend eating bamboo?",
    options: {
      A: "2-4 hours",
      B: "6-8 hours",
      C: "12-14 hours",
      D: "20-22 hours"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 14,
    question: "An owl can turn its head how many degrees?",
    options: {
      A: "90 degrees",
      B: "180 degrees",
      C: "270 degrees",
      D: "360 degrees"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 15,
    question: "How fast can a Border Collie run?",
    options: {
      A: "10 mph",
      B: "20 mph",
      C: "30 mph",
      D: "40 mph"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 16,
    question: "What's special about an elephant's memory?",
    options: {
      A: "They forget everything quickly",
      B: "They can remember things for many years",
      C: "They only remember food locations",
      D: "They have no memory"
    },
    correctAnswer: "B",
    category: "facts"
  },
  {
    id: 17,
    question: "How do beavers warn each other of danger?",
    options: {
      A: "By growling loudly",
      B: "By running in circles",
      C: "By slapping their tail on water",
      D: "By hiding"
    },
    correctAnswer: "C",
    category: "behavior"
  },
  {
    id: 18,
    question: "What color is a polar bear's skin under its white fur?",
    options: {
      A: "White",
      B: "Pink",
      C: "Black",
      D: "Brown"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 19,
    question: "Which bird is known for being able to mimic human speech?",
    options: {
      A: "Owl",
      B: "Eagle",
      C: "Parrot",
      D: "Penguin"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 20,
    question: "How long can elephants live in the wild?",
    options: {
      A: "10-20 years",
      B: "30-40 years",
      C: "60-70 years",
      D: "90-100 years"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 21,
    question: "What do meerkats eat?",
    options: {
      A: "Only plants",
      B: "Insects, small reptiles, and eggs",
      C: "Only fruit",
      D: "Fish"
    },
    correctAnswer: "B",
    category: "diet"
  },
  {
    id: 22,
    question: "How many bamboo plants can a giant panda eat in one day?",
    options: {
      A: "5-10 pounds",
      B: "20-40 pounds",
      C: "50-60 pounds",
      D: "80-100 pounds"
    },
    correctAnswer: "B",
    category: "diet"
  },
  {
    id: 23,
    question: "What tool do sea otters use to crack open shells?",
    options: {
      A: "Their teeth only",
      B: "Rocks",
      C: "Sticks",
      D: "Their claws"
    },
    correctAnswer: "B",
    category: "behavior"
  },
  {
    id: 24,
    question: "Which animal is known as nature's engineer?",
    options: {
      A: "Owl",
      B: "Parrot",
      C: "Beaver",
      D: "Meerkat"
    },
    correctAnswer: "C",
    category: "facts"
  },
  {
    id: 25,
    question: "How do owls fly so silently?",
    options: {
      A: "They fly very slowly",
      B: "Special soft feathers muffle sound",
      C: "They only fly during storms",
      D: "They don't flap their wings"
    },
    correctAnswer: "B",
    category: "facts"
  }
];

