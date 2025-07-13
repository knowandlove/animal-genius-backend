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
    const { classCode, firstName, lastInitial, grade } = await req.json()

    // Validate inputs
    if (!classCode || !firstName || !lastInitial) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit by IP address
    const ipLimit = await rateLimiter.checkLimit(clientIp, RATE_LIMITS.eligibilityCheck.perIp)
    if (!ipLimit.allowed) {
      return rateLimitErrorResponse(ipLimit, 'Too many eligibility checks. Please wait a minute.')
    }

    // Debug: Check environment variables
    const serviceKeyPreview = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 50)
    console.log('Service key preview:', serviceKeyPreview)
    console.log('Key starts with correct header?:', serviceKeyPreview?.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'))
    
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing environment variables',
          hasUrl: !!url,
          hasServiceKey: !!serviceKey
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Initialize Supabase client with service role (should bypass RLS)
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // First, let's try a simple query to see if we can access the table at all
    const { data: testData, error: testError } = await supabaseAdmin
      .from('classes')
      .select('class_code')
      .limit(1)
    
    console.log('Test query - can we read classes table?', { testData, testError })

    // Check class exists and is active
    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('id, name, seat_limit, teacher_id, class_code, is_active, expires_at')
      .eq('class_code', classCode.toUpperCase())
      .single()

    // Add rate limit headers to all responses
    const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
    setRateLimitHeaders(headers, ipLimit)

    // Debug logging
    console.log('Looking for class:', classCode.toUpperCase())
    console.log('Class query error:', classError)
    console.log('Class data found:', classData)

    if (classError || !classData) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'INVALID_CLASS',
          message: 'This class code is not valid or has expired.',
          debug: { classError, searchedFor: classCode.toUpperCase() }
        }),
        { status: 200, headers }
      )
    }

    // Check if class is active and not expired
    if (!classData.is_active) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'CLASS_INACTIVE',
          message: 'This class is not currently accepting new students.'
        }),
        { status: 200, headers }
      )
    }

    if (classData.expires_at && new Date(classData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'CLASS_EXPIRED',
          message: 'This class has expired.'
        }),
        { status: 200, headers }
      )
    }

    // Check if class is full
    const { count } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classData.id)

    if (classData.seat_limit && count >= classData.seat_limit) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'CLASS_FULL',
          message: `This class has reached its capacity of ${classData.seat_limit} students.`,
          suggestion: 'Please contact your teacher.'
        }),
        { status: 200, headers }
      )
    }

    // Check for name collision
    const studentName = `${firstName} ${lastInitial}`
    const { data: existingStudent } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('class_id', classData.id)
      .eq('student_name', studentName)
      .single()

    if (existingStudent) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'NAME_TAKEN',
          message: 'A student with this name already exists in the class.',
          suggestion: 'Try adding your middle initial.'
        }),
        { status: 200, headers }
      )
    }

    // All checks passed!
    return new Response(
      JSON.stringify({
        eligible: true,
        warnings: [],
        classInfo: {
          name: classData.name,
          currentStudents: count || 0,
          maxStudents: classData.seat_limit || 'Unlimited'
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