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
    // TwiML response to handle the call
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">Hello! I'm an AI assistant. How can I help you today?</Say>
        <Gather input="speech" action="https://htegorovrqorrfydgadn.supabase.co/functions/v1/process-speech" method="POST" speechTimeout="3" timeout="10">
            <Say voice="alice">Please speak now.</Say>
        </Gather>
        <Say voice="alice">I didn't hear anything. Goodbye!</Say>
    </Response>`;

    return new Response(twimlResponse, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });

  } catch (error) {
    console.error('Error handling call:', error);
    
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