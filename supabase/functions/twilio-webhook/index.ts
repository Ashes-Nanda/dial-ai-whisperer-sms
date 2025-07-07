import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid')?.toString();
    const from = formData.get('From')?.toString();
    
    console.log('Twilio webhook called:', { callSid, from });

    // Get the ngrok URL for the WebSocket endpoint
    const baseUrl = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const wsUrl = `wss://${baseUrl}/functions/v1/audio-stream`;

    // TwiML response to start media streaming and connect to our WebSocket
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">Hello! I'm an AI assistant monitoring your call for assistance requests. How can I help you today?</Say>
        <Start>
            <Stream url="${wsUrl}" />
        </Start>
        <Pause length="30"/>
        <Say voice="alice">Thank you for calling. If you need help, just say the word help. Goodbye!</Say>
    </Response>`;

    return new Response(twimlResponse, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });

  } catch (error) {
    console.error('Error in Twilio webhook:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">Sorry, there was an error. Goodbye!</Say>
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