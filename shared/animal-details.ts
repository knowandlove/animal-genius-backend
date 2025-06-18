export interface AnimalDetails {
  name: string;
  genius: string;
  strengths: string[];
  growthAreas: string[];
  teacherTips: string[];
  collaborationTips: string[];
}

export const animalDetails: Record<string, AnimalDetails> = {
  'Meerkat': {
    name: 'Meerkat',
    genius: 'Feeler',
    strengths: [
      'Creative and imaginative thinking',
      'Deep empathy and understanding',
      'Authentic self-expression',
      'Values-driven leadership',
      'Building meaningful connections'
    ],
    growthAreas: [
      'Speaking up in large groups',
      'Making quick decisions under pressure',
      'Accepting constructive criticism',
      'Setting boundaries with others',
      'Dealing with conflict directly'
    ],
    teacherTips: [
      'Provide creative outlets for self-expression',
      'Allow processing time before requiring responses',
      'Frame feedback gently and privately',
      'Encourage sharing ideas in small groups first',
      'Recognize their unique perspective and creativity'
    ],
    collaborationTips: [
      'Pairs well with more assertive personalities who can help them share ideas',
      'Benefits from partners who appreciate their creative insights',
      'May need encouragement to voice disagreements'
    ]
  },
  
  'Panda': {
    name: 'Panda',
    genius: 'Feeler',
    strengths: [
      'Strategic long-term thinking',
      'Deep insight and intuition',
      'Independent problem-solving',
      'Thoughtful planning and reflection',
      'Seeing the big picture'
    ],
    growthAreas: [
      'Sharing thoughts before fully formed',
      'Adapting to sudden changes',
      'Working in noisy environments',
      'Group brainstorming sessions',
      'Delegating tasks to others'
    ],
    teacherTips: [
      'Provide quiet spaces for deep thinking',
      'Allow time for reflection before discussions',
      'Value their strategic insights',
      'Minimize interruptions during focused work',
      'Encourage sharing work-in-progress ideas'
    ],
    collaborationTips: [
      'Works best with partners who respect their need for thinking time',
      'Excellent at developing long-term strategies for groups',
      'May prefer written communication for complex ideas'
    ]
  },
  
  'Owl': {
    name: 'Owl',
    genius: 'Thinker',
    strengths: [
      'Analytical problem-solving',
      'Logical and systematic thinking',
      'Independent learning',
      'Adaptability to new situations',
      'Objective decision-making'
    ],
    growthAreas: [
      'Considering others\' emotions in decisions',
      'Working in highly social environments',
      'Expressing enthusiasm outwardly',
      'Group projects with undefined roles',
      'Dealing with illogical situations'
    ],
    teacherTips: [
      'Provide logical explanations for rules and decisions',
      'Allow independent work time',
      'Challenge them with complex problems',
      'Respect their need for autonomy',
      'Use data and facts in discussions'
    ],
    collaborationTips: [
      'Excels when given specific problems to solve',
      'Pairs well with detail-oriented partners',
      'May need reminders about team dynamics and feelings'
    ]
  },
  
  'Beaver': {
    name: 'Beaver',
    genius: 'Doer',
    strengths: [
      'Exceptional organization skills',
      'Reliability and dependability',
      'Attention to detail',
      'Supporting team members',
      'Following through on commitments'
    ],
    growthAreas: [
      'Adapting to last-minute changes',
      'Taking risks or trying new approaches',
      'Speaking up about their own needs',
      'Working without clear guidelines',
      'Dealing with ambiguity'
    ],
    teacherTips: [
      'Provide clear expectations and structure',
      'Recognize their consistent efforts',
      'Give advance notice of changes when possible',
      'Value their organizational contributions',
      'Encourage calculated risk-taking in safe environments'
    ],
    collaborationTips: [
      'Natural team supporters who ensure nothing falls through cracks',
      'Works best with clear roles and responsibilities',
      'May need encouragement to share innovative ideas'
    ]
  },
  
  'Elephant': {
    name: 'Elephant',
    genius: 'Feeler',
    strengths: [
      'Building and maintaining relationships',
      'Creating harmony in groups',
      'Supporting and encouraging others',
      'Strong communication skills',
      'Natural leadership through caring'
    ],
    growthAreas: [
      'Making tough decisions that may upset others',
      'Prioritizing own needs',
      'Working alone for extended periods',
      'Dealing with interpersonal conflict',
      'Accepting that not everyone can be pleased'
    ],
    teacherTips: [
      'Provide opportunities for collaboration',
      'Recognize their contributions to team harmony',
      'Help them practice assertiveness skills',
      'Use their natural leadership in group settings',
      'Acknowledge their emotional intelligence'
    ],
    collaborationTips: [
      'Natural team builders who bring groups together',
      'Excel at mediating conflicts between others',
      'May take on too much to help everyone'
    ]
  },
  
  'Otter': {
    name: 'Otter',
    genius: 'Doer',
    strengths: [
      'High energy and enthusiasm',
      'Adaptability and flexibility',
      'Living in the moment',
      'Making activities fun and engaging',
      'Quick action and response'
    ],
    growthAreas: [
      'Sitting still for long periods',
      'Following detailed written instructions',
      'Long-term planning',
      'Working in quiet, structured environments',
      'Delaying gratification'
    ],
    teacherTips: [
      'Incorporate movement and hands-on activities',
      'Keep lessons dynamic and varied',
      'Provide breaks for physical activity',
      'Use their enthusiasm to energize the class',
      'Channel their energy into positive leadership'
    ],
    collaborationTips: [
      'Brings energy and fun to any group',
      'Great at getting teams unstuck through action',
      'May need partners who help with planning and details'
    ]
  },
  
  'Parrot': {
    name: 'Parrot',
    genius: 'Thinker',
    strengths: [
      'Creative and innovative thinking',
      'Excellent communication skills',
      'Seeing possibilities and connections',
      'Inspiring and motivating others',
      'Generating enthusiasm for ideas'
    ],
    growthAreas: [
      'Following through on all ideas',
      'Working in isolation',
      'Focusing on one task at a time',
      'Dealing with routine or repetitive work',
      'Listening without interrupting'
    ],
    teacherTips: [
      'Encourage their creative contributions',
      'Provide variety in activities and topics',
      'Let them share ideas with the class',
      'Channel their social energy productively',
      'Help them prioritize their many ideas'
    ],
    collaborationTips: [
      'Natural idea generators who inspire teams',
      'Excel at brainstorming and creative sessions',
      'May need help focusing on execution'
    ]
  },
  
  'Border Collie': {
    name: 'Border Collie',
    genius: 'Doer',
    strengths: [
      'Natural leadership abilities',
      'Goal-oriented and driven',
      'Excellent organizational skills',
      'Decisive decision-making',
      'Motivating others toward goals'
    ],
    growthAreas: [
      'Patience with slower-paced team members',
      'Accepting that others have different work styles',
      'Delegating without micromanaging',
      'Considering feelings in decisions',
      'Relaxing and having unstructured time'
    ],
    teacherTips: [
      'Give them leadership opportunities',
      'Set challenging but achievable goals',
      'Recognize their achievements publicly',
      'Help them develop patience and empathy',
      'Teach them the value of different working styles'
    ],
    collaborationTips: [
      'Natural team leaders who drive results',
      'Excel at organizing and directing group efforts',
      'May need to practice inclusive leadership'
    ]
  }
};