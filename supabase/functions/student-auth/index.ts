import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { passportCode } = await req.json()
    
    // Validate format (XXX-XXX)
    if (!passportCode?.match(/^[A-Z]{3}-[A-Z0-9]{3}$/)) {
      return new Response(
        JSON.stringify({ error: 'Invalid passport code format' }), 
        { status: 400 }
      )
    }

    // Get student info via service role (use RPC for full data)
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    
    const { data: student, error } = await supabase
      .rpc('validate_student_login', { p_passport_code: passportCode })
      .single()

    if (error || !student) {
      console.log(`Failed login attempt: ${passportCode}`)
      return new Response(
        JSON.stringify({ error: 'Invalid passport code' }), 
        { status: 401 }
      )
    }

    // Return student data (no JWT needed - system uses passport headers)
    return new Response(JSON.stringify({ 
      success: true,
      student: {
        id: student.student_id,
        name: student.student_name,
        classId: student.class_id,
        animalType: student.animal_type_code,
        geniusType: student.genius_type_code,
        schoolYear: student.school_year
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})