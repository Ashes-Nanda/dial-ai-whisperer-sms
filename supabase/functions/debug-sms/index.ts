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
    console.log('=== SMS DEBUG FUNCTION ===');
    
    // Check environment variables
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log('Environment Variables Check:');
    console.log('- TWILIO_SID:', twilioSid ? `${twilioSid.substring(0, 10)}...` : 'MISSING');
    console.log('- TWILIO_AUTH_TOKEN:', twilioAuthToken ? `${twilioAuthToken.substring(0, 10)}...` : 'MISSING');
    console.log('- TWILIO_PHONE_NUMBER:', twilioPhoneNumber || 'MISSING');

    if (!twilioSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing Twilio credentials',
          details: {
            sid_present: !!twilioSid,
            token_present: !!twilioAuthToken,
            phone_present: !!twilioPhoneNumber
          }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Test SMS sending with detailed logging
    const testResult = await sendDetailedTestSMS(twilioSid, twilioAuthToken, twilioPhoneNumber);

    return new Response(
      JSON.stringify(testResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Debug function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendDetailedTestSMS(twilioSid: string, twilioAuthToken: string, fromNumber: string | null) {
  try {
    const targetNumber = '+919178379226';
    const fromPhone = fromNumber || '+18152485651';
    
    console.log('📤 Attempting to send SMS...');
    console.log('📞 From:', fromPhone);
    console.log('📱 To:', targetNumber);

    const message = `🧪 SMS DEBUG TEST 🧪

This is a test message to verify SMS delivery.

Time: ${new Date().toLocaleString()}
Function: debug-sms
Status: Testing SMS delivery

If you receive this, SMS is working correctly!`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', fromPhone);
    formData.append('To', targetNumber);
    formData.append('Body', message);

    console.log('🌐 Making request to Twilio API...');
    console.log('🔗 URL:', twilioUrl);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();
    console.log('📊 Response Status:', response.status);
    console.log('📄 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('📝 Response Body:', responseText);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ SMS sent successfully!');
      console.log('📧 Message SID:', result.sid);
      console.log('📊 Message Status:', result.status);
      console.log('💰 Price:', result.price);
      console.log('🏷️ Price Unit:', result.price_unit);

      return {
        success: true,
        message: 'SMS sent successfully',
        details: {
          sid: result.sid,
          status: result.status,
          from: result.from,
          to: result.to,
          price: result.price,
          price_unit: result.price_unit,
          date_created: result.date_created,
          date_sent: result.date_sent
        }
      };
    } else {
      console.error('❌ SMS sending failed');
      
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = { raw_response: responseText };
      }

      return {
        success: false,
        error: 'SMS sending failed',
        status: response.status,
        details: errorDetails
      };
    }
  } catch (error) {
    console.error('❌ Error in sendDetailedTestSMS:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}