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
    console.log('=== DEBUG WEBHOOK CALLED ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));

    let body;
    const contentType = req.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      body = await req.json();
      console.log('JSON Body:', body);
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
      console.log('Form Data:', body);
    } else {
      body = await req.text();
      console.log('Text Body:', body);
    }

    // Test SMS sending
    if (body && (body.test_sms || body.transcript)) {
      console.log('Testing SMS sending...');
      await testSMSSending(body.transcript || 'Test message with help keyword');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Debug webhook received',
        timestamp: new Date().toISOString(),
        body: body
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Debug webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function testSMSSending(transcript: string) {
  try {
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    console.log('Twilio SID available:', !!twilioSid);
    console.log('Twilio Auth Token available:', !!twilioAuthToken);

    if (!twilioSid || !twilioAuthToken) {
      console.error('❌ Missing Twilio credentials');
      return false;
    }

    const message = `🧪 TEST ALERT 🧪\n\nTesting SMS functionality\nTranscript: "${transcript}"\nTime: ${new Date().toLocaleString()}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651');
    formData.append('To', '+919178379226');
    formData.append('Body', message);

    console.log('Sending SMS to Twilio...');
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();
    console.log('Twilio response status:', response.status);
    console.log('Twilio response:', responseText);

    if (response.ok) {
      console.log('✅ Test SMS sent successfully');
      return true;
    } else {
      console.error('❌ Failed to send test SMS:', responseText);
      return false;
    }
  } catch (error) {
    console.error('Error in test SMS sending:', error);
    return false;
  }
}