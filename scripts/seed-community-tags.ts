import { db } from '../server/db/index.js';
import { tags } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

interface TagSeed {
  name: string;
  category: 'grade' | 'animal_mix' | 'challenge_type' | 'energy_level' | 'class_dynamic' | 'time_of_year';
  slug: string;
}

const tagSeeds: TagSeed[] = [
  // Grade level tags
  { name: 'K-2nd Grade', category: 'grade', slug: 'k-2' },
  { name: '3rd-5th Grade', category: 'grade', slug: '3-5' },
  { name: '6th-8th Grade', category: 'grade', slug: '6-8' },
  { name: '9th-12th Grade', category: 'grade', slug: '9-12' },
  
  // Animal mix tags
  { name: 'Otter & Beaver Mix', category: 'animal_mix', slug: 'otter-beaver' },
  { name: 'Meerkat & Elephant Mix', category: 'animal_mix', slug: 'meerkat-elephant' },
  { name: 'Owl & Panda Mix', category: 'animal_mix', slug: 'owl-panda' },
  { name: 'Parrot & Collie Mix', category: 'animal_mix', slug: 'parrot-collie' },
  { name: 'All Animal Mix', category: 'animal_mix', slug: 'all-animals' },
  { name: 'High Energy Animals', category: 'animal_mix', slug: 'high-energy' },
  { name: 'Introverted Animals', category: 'animal_mix', slug: 'introverted' },
  { name: 'Extroverted Animals', category: 'animal_mix', slug: 'extroverted' },
  
  // Challenge type tags
  { name: 'Classroom Management', category: 'challenge_type', slug: 'classroom-management' },
  { name: 'Student Engagement', category: 'challenge_type', slug: 'engagement' },
  { name: 'Motivation Issues', category: 'challenge_type', slug: 'motivation' },
  { name: 'Group Dynamics', category: 'challenge_type', slug: 'group-dynamics' },
  { name: 'Behavioral Challenges', category: 'challenge_type', slug: 'behavior' },
  { name: 'Communication Issues', category: 'challenge_type', slug: 'communication' },
  { name: 'Learning Differences', category: 'challenge_type', slug: 'learning-differences' },
  { name: 'Time Management', category: 'challenge_type', slug: 'time-management' },
  { name: 'Parent Communication', category: 'challenge_type', slug: 'parent-communication' },
  { name: 'Conflict Resolution', category: 'challenge_type', slug: 'conflict-resolution' },
  
  // Energy level tags
  { name: 'Low Energy Required', category: 'energy_level', slug: 'low-energy' },
  { name: 'Medium Energy Required', category: 'energy_level', slug: 'medium-energy' },
  { name: 'High Energy Required', category: 'energy_level', slug: 'high-energy' },
  { name: 'Quick Win', category: 'energy_level', slug: 'quick-win' },
  { name: 'Long-term Strategy', category: 'energy_level', slug: 'long-term' },
  
  // Class dynamic tags
  { name: 'Small Class (< 15)', category: 'class_dynamic', slug: 'small-class' },
  { name: 'Medium Class (15-25)', category: 'class_dynamic', slug: 'medium-class' },
  { name: 'Large Class (25+)', category: 'class_dynamic', slug: 'large-class' },
  { name: 'Mixed Age Groups', category: 'class_dynamic', slug: 'mixed-age' },
  { name: 'New Class Setup', category: 'class_dynamic', slug: 'new-class' },
  { name: 'Established Class', category: 'class_dynamic', slug: 'established-class' },
  { name: 'Remote Learning', category: 'class_dynamic', slug: 'remote-learning' },
  { name: 'Hybrid Learning', category: 'class_dynamic', slug: 'hybrid-learning' },
  
  // Time of year tags
  { name: 'Beginning of Year', category: 'time_of_year', slug: 'beginning-year' },
  { name: 'Mid-Year', category: 'time_of_year', slug: 'mid-year' },
  { name: 'End of Year', category: 'time_of_year', slug: 'end-year' },
  { name: 'Holiday Season', category: 'time_of_year', slug: 'holiday-season' },
  { name: 'Testing Season', category: 'time_of_year', slug: 'testing-season' },
  { name: 'Summer School', category: 'time_of_year', slug: 'summer-school' },
];

async function seedTags() {
  console.log('🌱 Seeding Community Hub tags...');
  
  try {
    // Insert tags using onConflictDoNothing to avoid duplicates
    for (const tag of tagSeeds) {
      await db.insert(tags)
        .values({
          name: tag.name,
          category: tag.category,
          slug: tag.slug,
          usageCount: 0,
        })
        .onConflictDoNothing();
    }
    
    // Get counts by category
    const counts = await db.select({
      category: tags.category,
      count: sql<number>`count(*)::int`,
    })
    .from(tags)
    .groupBy(tags.category);
    
    console.log('\n✅ Tags seeded successfully!');
    console.log('\nTag counts by category:');
    counts.forEach(({ category, count }) => {
      console.log(`  ${category}: ${count} tags`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding tags:', error);
    process.exit(1);
  }
}

// Run the seed function
seedTags().then(() => {
  console.log('\n🎉 Community Hub tag seeding complete!');
  process.exit(0);
});