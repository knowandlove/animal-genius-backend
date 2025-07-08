import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkPatterns() {
  const { data, error } = await supabase
    .from('patterns')
    .select(`
      id,
      code,
      name,
      pattern_type,
      pattern_value,
      surface_type
    `)
    .in('code', ['wallpaper_stripes_01', 'tile_checkered_01', 'carpet_cozy_01']);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Patterns in database:');
  data.forEach(pattern => {
    console.log(`\n${pattern.name} (${pattern.code}):`);
    console.log(`  Type: ${pattern.pattern_type}`);
    console.log(`  Value: ${pattern.pattern_value}`);
    console.log(`  Surface: ${pattern.surface_type}`);
  });
}

checkPatterns();