import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [WEBHOOK] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('INFO', '📞 Twilio webhook called', {
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      contentType: req.headers.get('content-type')
    });

    const formData = await req.formData();
    const callSid = formData.get('CallSid')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const direction = formData.get('Direction')?.toString();

    log('INFO', '📋 Call details received', {
      callSid,
      from,
      to,
      callStatus,
      direction,
      allParams: Object.fromEntries(formData.entries())
    });

    // Get the current host and protocol for WebSocket URL
    const host = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const wsUrl = `wss://${host}/functions/v1/audio-stream`;

    log('INFO', '🔗 WebSocket URL generated', {
      host,
      protocol,
      wsUrl
    });

    // Enhanced TwiML response with better conversation flow
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice" rate="medium">
            Hello! You've reached our AI monitoring system. I'm here to assist you and will be listening for any requests for help. 
            Please speak naturally - if you need assistance, just say the word help, emergency, or support.
        </Say>
        <Start>
            <Stream url="${wsUrl}" track="inbound_track" />
        </Start>
        <Gather input="speech" action="${protocol}://${host}/functions/v1/process-speech" method="POST" 
                speechTimeout="auto" timeout="30" partialResultCallback="${protocol}://${host}/functions/v1/partial-speech">
            <Say voice="alice" rate="medium">
                I'm listening. Please go ahead and speak. If you need help with anything, just let me know.
            </Say>
        </Gather>
        <Say voice="alice" rate="medium">
            Thank you for calling. If you need immediate assistance, please call back and clearly state that you need help. Goodbye!
        </Say>
    </Response>`;

    log('INFO', '📤 Sending TwiML response', {
      responseLength: twimlResponse.length,
      wsUrl,
      callSid
    });

    return new Response(twimlResponse, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });

  } catch (error) {
    log('ERROR', '❌ Error in Twilio webhook', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">Sorry, there was a technical error. Please try calling again. If this is an emergency, please hang up and dial emergency services. Goodbye!</Say>
        <Hangup/>
    </Response>`;

    return new Response(errorTwiml, {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });
  }
});