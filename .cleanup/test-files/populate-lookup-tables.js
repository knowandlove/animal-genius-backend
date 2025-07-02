import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

async function populateLookupTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Populating lookup tables...\n');

    // Start a transaction
    await pool.query('BEGIN');

    // 1. Populate animal_types
    console.log('🦁 Populating animal types...');
    const animalTypes = [
      { code: 'meerkat', name: 'Meerkat', personality_type: 'ENFP', genius_type: 'creative' },
      { code: 'panda', name: 'Panda', personality_type: 'INFJ', genius_type: 'strategic' },
      { code: 'owl', name: 'Owl', personality_type: 'INTP', genius_type: 'analytical' },
      { code: 'beaver', name: 'Beaver', personality_type: 'ISTJ', genius_type: 'practical' },
      { code: 'elephant', name: 'Elephant', personality_type: 'ESFJ', genius_type: 'social' },
      { code: 'otter', name: 'Otter', personality_type: 'ESFP', genius_type: 'playful' },
      { code: 'parrot', name: 'Parrot', personality_type: 'ENTP', genius_type: 'innovative' },
      { code: 'border-collie', name: 'Border Collie', personality_type: 'ENTJ', genius_type: 'leadership' }
    ];

    for (const animal of animalTypes) {
      await pool.query(`
        INSERT INTO animal_types (code, name, personality_type, genius_type) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (code) DO NOTHING
      `, [animal.code, animal.name, animal.personality_type, animal.genius_type]);
    }
    console.log(`   ✓ Added ${animalTypes.length} animal types`);

    // 2. Populate item_types
    console.log('🎩 Populating item types...');
    const itemTypes = [
      // Avatar items
      { code: 'avatar_hat', name: 'Avatar Hat', category: 'avatar_hat' },
      { code: 'avatar_glasses', name: 'Avatar Glasses', category: 'avatar_glasses' },
      { code: 'avatar_accessory', name: 'Avatar Accessory', category: 'avatar_accessory' },
      // Room items
      { code: 'room_furniture', name: 'Room Furniture', category: 'room_furniture' },
      { code: 'room_decoration', name: 'Room Decoration', category: 'room_decoration' },
      { code: 'room_wallpaper', name: 'Room Wallpaper', category: 'room_wallpaper' },
      { code: 'room_flooring', name: 'Room Flooring', category: 'room_flooring' }
    ];

    for (const item of itemTypes) {
      await pool.query(`
        INSERT INTO item_types (code, name, category) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (code) DO NOTHING
      `, [item.code, item.name, item.category]);
    }
    console.log(`   ✓ Added ${itemTypes.length} item types`);

    // 3. Populate genius_types
    console.log('🧠 Populating genius types...');
    const geniusTypes = [
      { code: 'creative', name: 'Creative Genius', description: 'Imaginative and artistic thinking' },
      { code: 'strategic', name: 'Strategic Genius', description: 'Long-term planning and vision' },
      { code: 'analytical', name: 'Analytical Genius', description: 'Logical and systematic thinking' },
      { code: 'practical', name: 'Practical Genius', description: 'Hands-on problem solving' },
      { code: 'social', name: 'Social Genius', description: 'Understanding and connecting with others' },
      { code: 'playful', name: 'Playful Genius', description: 'Fun and energetic approach' },
      { code: 'innovative', name: 'Innovative Genius', description: 'New ideas and inventions' },
      { code: 'leadership', name: 'Leadership Genius', description: 'Guiding and inspiring others' }
    ];

    for (const genius of geniusTypes) {
      await pool.query(`
        INSERT INTO genius_types (code, name, description) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (code) DO NOTHING
      `, [genius.code, genius.name, genius.description]);
    }
    console.log(`   ✓ Added ${geniusTypes.length} genius types`);

    // 4. Populate quiz_answer_types
    console.log('📝 Populating quiz answer types...');
    const answerTypes = [
      { code: 'strongly_disagree', label: 'Strongly Disagree' },
      { code: 'disagree', label: 'Disagree' },
      { code: 'neutral', label: 'Neutral' },
      { code: 'agree', label: 'Agree' },
      { code: 'strongly_agree', label: 'Strongly Agree' }
    ];

    for (const answer of answerTypes) {
      await pool.query(`
        INSERT INTO quiz_answer_types (code, label) 
        VALUES ($1, $2) 
        ON CONFLICT (code) DO NOTHING
      `, [answer.code, answer.label]);
    }
    console.log(`   ✓ Added ${answerTypes.length} quiz answer types`);

    // 5. Populate lessons
    console.log('📚 Populating lessons...');
    const lessons = [
      { code: 'lesson_1', title: 'Taking the Animal Genius Quiz®', duration: 60 },
      { code: 'lesson_2', title: 'Building Our Classroom Community', duration: 45 },
      { code: 'lesson_3', title: 'Understanding Your Animal Personality', duration: 45 },
      { code: 'lesson_4', title: 'Leadership and Teamwork', duration: 40 },
      { code: 'lesson_5', title: 'Discovering Your Genius Type', duration: 50 }
    ];

    for (const lesson of lessons) {
      await pool.query(`
        INSERT INTO lessons (code, title, duration_minutes) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (code) DO NOTHING
      `, [lesson.code, lesson.title, lesson.duration]);
    }
    console.log(`   ✓ Added ${lessons.length} lessons`);

    // Commit the transaction
    await pool.query('COMMIT');

    console.log('\n✅ Lookup tables populated successfully!');

  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('\n❌ Error populating lookup tables:', error.message);
    console.error('🔄 All changes have been rolled back.\n');
  } finally {
    await pool.end();
  }
}

// Run immediately
populateLookupTables();
