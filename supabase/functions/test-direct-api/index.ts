import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('=== ENV VARS DEBUG ===')
    console.log('All env vars:', Object.keys(Deno.env.toObject()))
    console.log('URL:', url)
    console.log('Service key first 50 chars:', serviceKey?.substring(0, 50))
    
    // Test direct REST API call
    const directUrl = `${url}/rest/v1/classes?select=id,class_code&limit=1`
    console.log('Calling:', directUrl)
    
    const directResponse = await fetch(directUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Accept': 'application/json'
      }
    })

    const responseText = await directResponse.text()
    
    return new Response(JSON.stringify({
      success: directResponse.ok,
      status: directResponse.status,
      headers: Object.fromEntries(directResponse.headers.entries()),
      body: responseText,
      debug: {
        urlUsed: url,
        keyExists: !!serviceKey,
        keyLength: serviceKey?.length
      }
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
