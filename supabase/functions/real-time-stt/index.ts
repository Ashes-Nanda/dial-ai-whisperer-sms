import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, callSid, emergencyContact } = await req.json();
    
    console.log('Real-time transcript received:', transcript);
    console.log('Call SID:', callSid);
    console.log('Emergency contact:', emergencyContact);

    if (!transcript) {
      return new Response(
        JSON.stringify({ success: false, message: 'No transcript provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for trigger words in real-time
    const detectedKeywords = triggerWords.filter(word => 
      transcript.toLowerCase().includes(word.toLowerCase())
    );

    // Send immediate SMS alert if keywords detected
    if (detectedKeywords.length > 0) {
      console.log('Trigger words detected:', detectedKeywords);
      await sendEmergencyAlert(transcript, detectedKeywords, emergencyContact, callSid);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          alert_sent: true,
          keywords_detected: detectedKeywords,
          message: 'Emergency alert sent successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        alert_sent: false,
        message: 'Transcript processed, no trigger words detected'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing real-time transcript:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendEmergencyAlert(transcript: string, keywords: string[], emergencyContact: string, callSid: string) {
  try {
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!twilioSid || !twilioAuthToken) {
      throw new Error('Missing Twilio credentials');
    }

    const message = `🚨 EMERGENCY ALERT 🚨\n\nUSER NEEDS HELP!\n\nKeywords detected: ${keywords.join(', ')}\nCall ID: ${callSid}\nTranscript: "${transcript}"\n\nTime: ${new Date().toLocaleString()}\n\nPlease respond immediately!`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651');
    formData.append('To', emergencyContact);
    formData.append('Body', message);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (response.ok) {
      console.log('Emergency SMS sent successfully to:', emergencyContact);
      return true;
    } else {
      const errorText = await response.text();
      console.error('Failed to send emergency SMS:', errorText);
      return false;
    }
  } catch (error) {
    console.error('Error sending emergency SMS:', error);
    return false;
  }
}