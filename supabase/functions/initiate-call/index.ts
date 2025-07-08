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

    // Get Twilio credentials from environment variables
    const twilioSid = Deno.env.get("TWILIO_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER") || "+18152485651";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    await log('INFO', '🔐 Environment variables check', {
      hasTwilioSid: !!twilioSid,
      hasTwilioAuthToken: !!twilioAuthToken,
      twilioPhoneNumber,
      hasSupabaseUrl: !!supabaseUrl,
      twilioSidPrefix: twilioSid ? twilioSid.substring(0, 8) + '...' : 'missing'
    });

    if (!twilioSid || !twilioAuthToken || !twilioPhoneNumber || !supabaseUrl) {
      await log('ERROR', '❌ Missing required environment variables', {
        twilioSid: !!twilioSid,
        twilioAuthToken: !!twilioAuthToken,
        twilioPhoneNumber: !!twilioPhoneNumber,
        supabaseUrl: !!supabaseUrl
      });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create the webhook URLs
    const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/call-status`;

    await log('INFO', '🔗 Webhook URLs configured', {
      webhookUrl,
      statusCallbackUrl
    });

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", phoneNumber);
    formData.append("From", twilioPhoneNumber);
    formData.append("Url", webhookUrl);
    formData.append("Method", "POST");
    formData.append("StatusCallback", statusCallbackUrl);
    formData.append("StatusCallbackMethod", "POST");
    formData.append("StatusCallbackEvent", "initiated,ringing,answered,completed,busy,no-answer,failed,canceled");
    formData.append("Timeout", "30");
    formData.append("Record", "false"); // We're using streaming instead

    await log('INFO', '📤 Making call request to Twilio', {
      to: phoneNumber,
      from: twilioPhoneNumber,
      url: twilioUrl
    });

    // Make the call to Twilio API
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await twilioResponse.text();

    await log('INFO', '📊 Twilio API response', {
      status: twilioResponse.status,
      statusText: twilioResponse.statusText,
      headers: Object.fromEntries(twilioResponse.headers.entries())
    });

    if (!twilioResponse.ok) {
      await log('ERROR', '❌ Twilio API error', {
        status: twilioResponse.status,
        statusText: twilioResponse.statusText,
        responseBody: responseText
      });

      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        await log('ERROR', '📋 Twilio error details', {
          code: errorData.code,
          message: errorData.message,
          moreInfo: errorData.more_info,
          status: errorData.status
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

    const callData = JSON.parse(responseText);

    await log('INFO', '✅ Call initiated successfully', {
      callSid: callData.sid,
      status: callData.status,
      direction: callData.direction,
      from: callData.from,
      to: callData.to,
      dateCreated: callData.date_created
    });

    // Create call record in database
    const { data: callRecord, error: dbError } = await supabase
      .from('calls')
      .insert([{
        call_sid: callData.sid,
        phone_number: phoneNumber,
        emergency_contact: emergencyContactNumber || '+919178379226',
        status: callData.status,
        direction: callData.direction || 'outbound',
        started_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (dbError) {
      await log('ERROR', '❌ Failed to create call record in database', {
        error: dbError.message,
        callSid: callData.sid
      });
    } else {
      await log('INFO', '💾 Call record created in database', {
        callId: callRecord.id,
        callSid: callData.sid
      }, callRecord.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        callSid: callData.sid,
        callId: callRecord?.id,
        status: callData.status,
        phoneNumber: phoneNumber,
        emergencyContact: emergencyContactNumber,
        message: "Call initiated successfully",
        webhookUrl,
        statusCallbackUrl,
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