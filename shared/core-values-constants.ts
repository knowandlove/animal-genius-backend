/**
 * Core Values Constants
 * Defines the 4 clusters of values used throughout the Animal Genius application
 */

export interface CoreValue {
  code: string;
  displayName: string;
  description: string;
}

export interface CoreValueCluster {
  id: number;
  title: string;
  prompt: string;
  values: CoreValue[];
}

// Cluster 1: How We Treat Each Other
const cluster1: CoreValueCluster = {
  id: 1,
  title: "How We Treat Each Other",
  prompt: "How do you want to treat each other?",
  values: [
    { code: "kind", displayName: "Kind", description: "Being gentle and considerate" },
    { code: "respectful", displayName: "Respectful", description: "Honoring everyone's dignity" },
    { code: "inclusive", displayName: "Inclusive", description: "Making everyone feel welcome" },
    { code: "supportive", displayName: "Supportive", description: "Helping each other succeed" },
    { code: "encouraging", displayName: "Encouraging", description: "Lifting others up" },
    { code: "helpful", displayName: "Helpful", description: "Lending a hand when needed" },
    { code: "friendly", displayName: "Friendly", description: "Being warm and approachable" },
    { code: "caring", displayName: "Caring", description: "Showing genuine concern" },
    { code: "understanding", displayName: "Understanding", description: "Seeing things from other perspectives" },
    { code: "patient", displayName: "Patient", description: "Giving people time to grow" },
    { code: "fair", displayName: "Fair", description: "Treating everyone equally" },
    { code: "trustworthy", displayName: "Trustworthy", description: "Being reliable and honest" }
  ]
};

// Cluster 2: How We Handle Challenges
const cluster2: CoreValueCluster = {
  id: 2,
  title: "How We Handle Challenges",
  prompt: "How do you want to handle challenges?",
  values: [
    { code: "brave", displayName: "Brave", description: "Facing fears with courage" },
    { code: "resilient", displayName: "Resilient", description: "Bouncing back from setbacks" },
    { code: "problem-solving", displayName: "Problem-Solving", description: "Finding creative solutions" },
    { code: "persistent", displayName: "Persistent", description: "Never giving up" },
    { code: "flexible", displayName: "Flexible", description: "Adapting to change" },
    { code: "positive", displayName: "Positive", description: "Looking for the good" },
    { code: "calm", displayName: "Calm", description: "Staying peaceful under pressure" },
    { code: "determined", displayName: "Determined", description: "Staying focused on goals" },
    { code: "growth-minded", displayName: "Growth-Minded", description: "Believing we can improve" },
    { code: "resourceful", displayName: "Resourceful", description: "Making the most of what we have" },
    { code: "optimistic", displayName: "Optimistic", description: "Expecting good outcomes" },
    { code: "confident", displayName: "Confident", description: "Believing in ourselves" }
  ]
};

// Cluster 3: How We Learn Together
const cluster3: CoreValueCluster = {
  id: 3,
  title: "How We Learn Together",
  prompt: "How do you want to learn together?",
  values: [
    { code: "curious", displayName: "Curious", description: "Always asking questions" },
    { code: "creative", displayName: "Creative", description: "Thinking outside the box" },
    { code: "collaborative", displayName: "Collaborative", description: "Working better together" },
    { code: "open-minded", displayName: "Open-Minded", description: "Welcoming new ideas" },
    { code: "thoughtful", displayName: "Thoughtful", description: "Thinking before acting" },
    { code: "innovative", displayName: "Innovative", description: "Finding new ways" },
    { code: "focused", displayName: "Focused", description: "Staying on task" },
    { code: "engaged", displayName: "Engaged", description: "Being fully present" },
    { code: "reflective", displayName: "Reflective", description: "Learning from experiences" },
    { code: "inquisitive", displayName: "Inquisitive", description: "Exploring deeply" },
    { code: "analytical", displayName: "Analytical", description: "Breaking down complex ideas" },
    { code: "adventurous", displayName: "Adventurous", description: "Trying new things" }
  ]
};

// Cluster 4: How We Show Up Each Day
const cluster4: CoreValueCluster = {
  id: 4,
  title: "How We Show Up Each Day",
  prompt: "How do you want to show up each day?",
  values: [
    { code: "responsible", displayName: "Responsible", description: "Owning our actions" },
    { code: "honest", displayName: "Honest", description: "Speaking the truth" },
    { code: "hardworking", displayName: "Hardworking", description: "Putting in our best effort" },
    { code: "organized", displayName: "Organized", description: "Keeping things orderly" },
    { code: "prepared", displayName: "Prepared", description: "Ready to learn" },
    { code: "mindful", displayName: "Mindful", description: "Being aware and present" },
    { code: "grateful", displayName: "Grateful", description: "Appreciating what we have" },
    { code: "joyful", displayName: "Joyful", description: "Finding happiness daily" },
    { code: "enthusiastic", displayName: "Enthusiastic", description: "Bringing positive energy" },
    { code: "punctual", displayName: "Punctual", description: "Respecting everyone's time" },
    { code: "dedicated", displayName: "Dedicated", description: "Committed to excellence" },
    { code: "present", displayName: "Present", description: "Being here and now" }
  ]
};

// All clusters array
export const CORE_VALUE_CLUSTERS: CoreValueCluster[] = [
  cluster1,
  cluster2,
  cluster3,
  cluster4
];

// Create a map of all values for quick lookup
const ALL_VALUES_MAP = new Map<string, { value: CoreValue; clusterId: number }>();
CORE_VALUE_CLUSTERS.forEach(cluster => {
  cluster.values.forEach(value => {
    ALL_VALUES_MAP.set(value.code, { value, clusterId: cluster.id });
  });
});

/**
 * Get a cluster by its ID
 * @param clusterId - The ID of the cluster (1-4)
 * @returns The cluster or undefined if not found
 */
export function getClusterById(clusterId: number): CoreValueCluster | undefined {
  return CORE_VALUE_CLUSTERS.find(cluster => cluster.id === clusterId);
}

/**
 * Get all clusters
 * @returns Array of all core value clusters
 */
export function getAllClusters(): CoreValueCluster[] {
  return [...CORE_VALUE_CLUSTERS];
}

/**
 * Get a value by its code
 * @param code - The kebab-case code of the value
 * @returns Object containing the value and its cluster ID, or undefined if not found
 */
export function getValueByCode(code: string): { value: CoreValue; clusterId: number } | undefined {
  return ALL_VALUES_MAP.get(code);
}

/**
 * Validate if a value code exists
 * @param code - The kebab-case code to validate
 * @returns true if the code exists, false otherwise
 */
export function isValidValueCode(code: string): boolean {
  return ALL_VALUES_MAP.has(code);
}

/**
 * Validate an array of value codes
 * @param codes - Array of kebab-case codes to validate
 * @returns Object with valid flag and array of invalid codes
 */
export function validateValueCodes(codes: string[]): { valid: boolean; invalidCodes: string[] } {
  const invalidCodes = codes.filter(code => !isValidValueCode(code));
  return {
    valid: invalidCodes.length === 0,
    invalidCodes
  };
}

/**
 * Get all values across all clusters
 * @returns Array of all core values with their cluster IDs
 */
export function getAllValues(): Array<{ value: CoreValue; clusterId: number }> {
  return Array.from(ALL_VALUES_MAP.values());
}

/**
 * Get values for a specific cluster
 * @param clusterId - The ID of the cluster (1-4)
 * @returns Array of values for the cluster or empty array if cluster not found
 */
export function getValuesByClusterId(clusterId: number): CoreValue[] {
  const cluster = getClusterById(clusterId);
  return cluster ? [...cluster.values] : [];
}

// Export types for use in other files
// Note: Types already exported as interfaces above
