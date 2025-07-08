import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface CallRequest {
  phoneNumber: string;
  emergencyContactNumber: string;
}

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced logging utility with database storage
async function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any, callId?: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [INITIATE] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }

  // Store in database (fire and forget)
  try {
    await supabase.from('system_logs').insert([{
      call_id: callId,
      level,
      component: 'initiate-call',
      message,
      metadata: data || {}
    }]);
  } catch (error) {
    console.error('Failed to store log in database:', error);
  }
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    await log('INFO', '🚀 Call initiation request received', {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent')
    });

    if (req.method !== "POST") {
      await log('WARN', '❌ Invalid method', { method: req.method });
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { phoneNumber, emergencyContactNumber }: CallRequest = await req.json();

    await log('INFO', '📞 Call request details', {
      phoneNumber,
      emergencyContactNumber,
      timestamp: new Date().toISOString()
    });

    if (!phoneNumber) {
      await log('ERROR', '❌ Missing phone number');
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Eleven Labs API key from environment variables
    const elevenLabsApiKey = Deno.env.get("ELEVEN_LABS_API");
    const agentId = "agent_01jyy3hts1fpsszcfrdgcfv2vn";
    const agentPhoneNumberId = "phnum_01jzjz0m64e2ms2h05j8x96s53";

    await log('INFO', '🔐 Environment variables check', {
      hasElevenLabsApiKey: !!elevenLabsApiKey,
      agentId,
      agentPhoneNumberId,
      elevenLabsApiKeyPrefix: elevenLabsApiKey ? elevenLabsApiKey.substring(0, 8) + '...' : 'missing'
    });

    if (!elevenLabsApiKey) {
      await log('ERROR', '❌ Missing Eleven Labs API key');
      return new Response(
        JSON.stringify({ error: "Server configuration error - Missing Eleven Labs API key" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Make the call to Eleven Labs Outbound Call API
    const elevenLabsUrl = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";
    
    const callData = {
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: phoneNumber
    };

    await log('INFO', '📤 Making call request to Eleven Labs', {
      to: phoneNumber,
      elevenLabsUrl,
      agentId,
      agentPhoneNumberId
    });

    // Make the call to Eleven Labs API
    const elevenLabsResponse = await fetch(elevenLabsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callData),
    });

    const responseText = await elevenLabsResponse.text();

    await log('INFO', '📊 Eleven Labs API response', {
      status: elevenLabsResponse.status,
      statusText: elevenLabsResponse.statusText,
      headers: Object.fromEntries(elevenLabsResponse.headers.entries()),
      responseBodyPreview: responseText.substring(0, 500)
    });

    if (!elevenLabsResponse.ok) {
      await log('ERROR', '❌ Eleven Labs API error', {
        status: elevenLabsResponse.status,
        statusText: elevenLabsResponse.statusText,
        responseBody: responseText
      });

      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        await log('ERROR', '📋 Eleven Labs error details', {
          error: errorData
        });
      } catch (parseError) {
        await log('ERROR', '❌ Could not parse error response');
      }

      return new Response(
        JSON.stringify({ error: "Failed to initiate call", details: responseText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const callResponseData = JSON.parse(responseText);

    await log('INFO', '✅ Call initiated successfully via Eleven Labs', {
      success: callResponseData.success,
      message: callResponseData.message,
      conversationId: callResponseData.conversation_id,
      callSid: callResponseData.callSid
    });

    // Create call record in database
    const { data: callRecord, error: dbError } = await supabase
      .from('calls')
      .insert([{
        call_sid: callResponseData.callSid || `el_${Date.now()}`,
        phone_number: phoneNumber,
        emergency_contact: emergencyContactNumber || '+919178379226',
        status: 'initiated',
        direction: 'outbound',
        started_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (dbError) {
      await log('ERROR', '❌ Failed to create call record in database', {
        error: dbError.message,
        callSid: callResponseData.callSid
      });
    } else {
      await log('INFO', '💾 Call record created in database', {
        callId: callRecord.id,
        callSid: callResponseData.callSid
      }, callRecord.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        callSid: callResponseData.callSid,
        callId: callRecord?.id,
        conversationId: callResponseData.conversation_id,
        phoneNumber: phoneNumber,
        emergencyContact: emergencyContactNumber,
        message: callResponseData.message || "Call initiated successfully via Eleven Labs",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    await log('ERROR', '❌ Error in initiate-call function', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});