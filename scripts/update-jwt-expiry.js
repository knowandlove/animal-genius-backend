// Script to update JWT expiry using Supabase Management API
// Run this script to set JWT expiry to 8 hours (28800 seconds)

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // Get from: https://supabase.com/dashboard/account/tokens
const PROJECT_REF = 'zqyvfnbwpagguutzdvpy';

async function updateJWTExpiry() {
  if (!SUPABASE_ACCESS_TOKEN) {
    console.error('Please set SUPABASE_ACCESS_TOKEN environment variable');
    console.error('Get it from: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jwt_exp: 28800, // 8 hours in seconds
          refresh_token_rotation_enabled: true,
          security_captcha_enabled: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update JWT settings: ${error}`);
    }

    const result = await response.json();
    console.log('✅ JWT expiry updated successfully!');
    console.log('New settings:', {
      jwt_exp: result.jwt_exp,
      refresh_token_rotation_enabled: result.refresh_token_rotation_enabled,
    });
  } catch (error) {
    console.error('❌ Error updating JWT settings:', error);
  }
}

updateJWTExpiry();