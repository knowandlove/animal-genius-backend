import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadFishRive() {
  try {
    // Path to your fish.riv file - update this to wherever you export it
    const filePath = path.join(process.cwd(), 'fish.riv');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      console.log('Please place your fish.riv file in the backend directory and run again');
      return;
    }

    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Upload to Supabase Storage
    const fileName = 'pets/fish.riv';
    const { data, error } = await supabase.storage
      .from('store-items')
      .upload(fileName, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: true // Replace if exists
      });

    if (error) {
      console.error('Upload error:', error);
      return;
    }

    console.log('✅ Fish.riv uploaded successfully!');
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('store-items')
      .getPublicUrl(fileName);
    
    console.log('📦 Public URL:', publicUrl);
    
    // Update the pet in the database to use this URL
    console.log('\n🐠 Updating fish pet in database...');
    
    // First, let's find the fish pet
    const { data: pets, error: fetchError } = await supabase
      .from('pets')
      .select('*')
      .ilike('species', '%fish%');
    
    if (fetchError) {
      console.error('Error fetching pets:', fetchError);
      return;
    }
    
    if (pets && pets.length > 0) {
      // Update each fish pet with the new asset URL
      for (const pet of pets) {
        const { error: updateError } = await supabase
          .from('pets')
          .update({ 
            asset_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', pet.id);
        
        if (updateError) {
          console.error(`Error updating pet ${pet.name}:`, updateError);
        } else {
          console.log(`✅ Updated ${pet.name} with new Rive animation`);
        }
      }
    } else {
      console.log('⚠️  No fish pets found in database. You may need to add them first.');
    }
    
    console.log('\n🎉 Done! Your fish Rive animation is now on the cloud.');
    console.log('URL to use in your app:', publicUrl);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

uploadFishRive();
