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
    const { phoneNumber } = await req.json();
    
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Get credentials from Supabase secrets
    const twilioSid = Deno.env.get('TWILLIO_SID');
    const twilioAuthToken = Deno.env.get('TWILLIO_AUTH_TOKEN');
    const elevenLabsApiKey = Deno.env.get('ELEVEN_LABS_API');

    if (!twilioSid || !twilioAuthToken || !elevenLabsApiKey) {
      throw new Error('Missing required API credentials');
    }

    // Twilio API call to initiate outbound call
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651'); // Your Twilio number
    formData.append('To', phoneNumber);
    formData.append('Url', `https://htegorovrqorrfydgadn.supabase.co/functions/v1/handle-call`);
    formData.append('Method', 'POST');

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!twilioResponse.ok) {
      const error = await twilioResponse.text();
      throw new Error(`Twilio API error: ${error}`);
    }

    const callData = await twilioResponse.json();

    console.log('Call initiated:', callData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        callSid: callData.sid,
        status: callData.status,
        to: callData.to,
        from: callData.from
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