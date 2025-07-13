import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { RateLimiter, RATE_LIMITS, setRateLimitHeaders, rateLimitErrorResponse } from '../_shared/rate-limit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rateLimiter = new RateLimiter()
  const clientIp = RateLimiter.getClientIp(req)

  try {
    const { passportCode } = await req.json()

    // Validate passport code format
    if (!passportCode || !/^[A-Z]{3}-[A-Z0-9]{3}$/.test(passportCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid passport code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit checks
    const ipLimit = await rateLimiter.checkLimit(clientIp, RATE_LIMITS.studentLogin.perIp)
    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit, 'Too many login attempts. Please wait a minute.')
    }

    const passportLimit = await rateLimiter.checkLimit(
      passportCode.toUpperCase(), 
      RATE_LIMITS.studentLogin.perPassport
    )
    if (!passportLimit.allowed) {
      return rateLimitErrorResponse(
        passportLimit, 
        'This passport code has been tried too many times. Please check your code or contact your teacher.'
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Validate passport code and get student info
    const { data: studentData, error: lookupError } = await supabaseAdmin
      .rpc('validate_student_login', { p_passport_code: passportCode })
      .single()

    if (lookupError || !studentData) {
      console.error('Student lookup error:', lookupError)
      
      const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
      setRateLimitHeaders(headers, ipLimit)
      
      return new Response(
        JSON.stringify({ error: 'Invalid passport code' }),
        { status: 401, headers }
      )
    }

    // Check if user_id exists
    if (!studentData.user_id) {
      const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
      setRateLimitHeaders(headers, ipLimit)
      
      return new Response(
        JSON.stringify({ 
          error: 'Legacy account detected. Please ask your teacher to update your account.' 
        }),
        { status: 400, headers }
      )
    }

    // Get additional student data
    const { data: fullStudentData } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        animal_types!inner(code, name),
        genius_types!inner(code, name)
      `)
      .eq('id', studentData.student_id)
      .single()

    // For anonymous authentication, we'll return a simplified response
    // The frontend should use the passport code as the authentication method
    // and include it in API requests
    
    const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
    setRateLimitHeaders(headers, ipLimit)

    // Return success with student data
    return new Response(
      JSON.stringify({
        success: true,
        authenticated: true,
        student: {
          id: studentData.student_id,
          name: studentData.student_name,
          classId: studentData.class_id,
          schoolYear: studentData.school_year,
          animalType: fullStudentData?.animal_types?.code || 'unknown',
          geniusType: fullStudentData?.genius_types?.code || 'unknown',
          passportCode: passportCode
        },
        // For API access, the frontend should use the passport code
        // Include instructions for the frontend
        authentication: {
          method: 'passport',
          passportCode: passportCode,
          instructions: 'Include passport code in X-Passport-Code header for API requests'
        }
      }),
      { status: 200, headers }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
