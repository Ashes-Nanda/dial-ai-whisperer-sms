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
    const { phoneNumber, emergencyContactNumber } = await req.json();
    
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    if (!emergencyContactNumber) {
      throw new Error('Emergency contact number is required');
    }

    // Get credentials from Supabase secrets
    const elevenLabsApiKey = Deno.env.get('ELEVEN_LABS_API');

    if (!elevenLabsApiKey) {
      throw new Error('Missing Eleven Labs API key');
    }

    // Use Eleven Labs Conversational AI outbound call API
    const elevenLabsUrl = 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call';
    
    const callData = {
      agent_id: 'agent_01jyy3hts1fpsszcfrdgcfv2vn',
      agent_phone_number_id: 'phnum_01jzjz0m64e2ms2h05j8x96s53',
      to_number: phoneNumber,
      webhook_url: `https://htegorovrqorrfydgadn.supabase.co/functions/v1/twilio-webhook`,
      conversation_initiation_client_data: {
        trigger_words: ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'],
        alert_number: emergencyContactNumber,
      }
    };

    const elevenLabsResponse = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callData),
    });

    if (!elevenLabsResponse.ok) {
      const error = await elevenLabsResponse.text();
      throw new Error(`Eleven Labs API error: ${error}`);
    }

    const result = await elevenLabsResponse.json();

    console.log('Call initiated via Eleven Labs:', result);
    console.log('Calling number:', phoneNumber);
    console.log('From number: +18152485651');
    console.log('Agent ID: agent_01jyy3hts1fpsszcfrdgcfv2vn');

    return new Response(
      JSON.stringify({ 
        success: true, 
        callSid: result.callSid,
        conversationId: result.conversation_id,
        message: result.message,
        to: phoneNumber,
        from: '+18152485651'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error initiating call:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});