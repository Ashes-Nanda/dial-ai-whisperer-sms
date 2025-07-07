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
    const { transcript, emergencyContact } = await req.json();
    
    console.log('=== TESTING TRIGGER DETECTION ===');
    console.log('📝 Transcript:', transcript);
    console.log('📱 Emergency Contact:', emergencyContact);

    if (!transcript) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Transcript is required for testing' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check for trigger words
    const detectedKeywords = triggerWords.filter(word => 
      transcript.toLowerCase().includes(word.toLowerCase())
    );

    console.log('🔍 Available trigger words:', triggerWords);
    console.log('🎯 Detected keywords:', detectedKeywords);

    if (detectedKeywords.length > 0) {
      console.log('🚨 TRIGGER WORDS DETECTED - Sending test SMS...');
      
      const smsResult = await sendTestEmergencyAlert(
        transcript, 
        detectedKeywords, 
        emergencyContact || '+919178379226'
      );
      
      return new Response(
        JSON.stringify({ 
          success: true,
          alert_sent: true,
          keywords_detected: detectedKeywords,
          sms_sent: smsResult,
          message: smsResult ? 'Test SMS sent successfully!' : 'SMS sending failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true,
          alert_sent: false,
          keywords_detected: [],
          message: 'No trigger words detected in test transcript',
          available_triggers: triggerWords,
          tip: 'Try including words like "help", "emergency", or "support" in your test transcript'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Error in test trigger detection:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendTestEmergencyAlert(transcript: string, keywords: string[], emergencyContact: string) {
  try {
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    console.log('🔐 Checking Twilio credentials...');
    console.log('- SID available:', !!twilioSid);
    console.log('- Auth Token available:', !!twilioAuthToken);

    if (!twilioSid || !twilioAuthToken) {
      console.error('❌ Missing Twilio credentials in environment variables');
      return false;
    }

    const message = `🧪 TEST EMERGENCY ALERT 🧪

USER NEEDS HELP! (TEST)

Keywords detected: ${keywords.join(', ')}
Test transcript: "${transcript}"

Time: ${new Date().toLocaleString()}

This is a TEST alert from your AI call monitoring system!`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651');
    formData.append('To', emergencyContact);
    formData.append('Body', message);

    console.log('📤 Sending test SMS...');
    console.log('📞 From: +18152485651');
    console.log('📱 To:', emergencyContact);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();
    console.log('📊 Twilio response status:', response.status);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Test SMS sent successfully!');
      console.log('📧 Message SID:', result.sid);
      return true;
    } else {
      console.error('❌ Failed to send test SMS');
      console.error('📄 Response:', responseText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending test SMS:', error);
    return false;
  }
}