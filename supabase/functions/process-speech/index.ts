import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

// Enhanced logging utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [SPEECH] [${level}] ${message}`;
  
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
    log('INFO', '🎤 Speech processing endpoint called', {
      method: req.method,
      contentType: req.headers.get('content-type')
    });

    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString() || '';
    const confidence = formData.get('Confidence')?.toString() || '';
    const caller = formData.get('From')?.toString() || '';
    const callSid = formData.get('CallSid')?.toString() || '';
    
    log('INFO', '📝 Speech data received', {
      speechResult,
      confidence: parseFloat(confidence) || 0,
      caller,
      callSid,
      speechLength: speechResult.length,
      allParams: Object.fromEntries(formData.entries())
    });

    // Check for trigger words
    const detectedKeywords = triggerWords.filter(word => 
      speechResult.toLowerCase().includes(word.toLowerCase())
    );

    log('INFO', '🔍 Keyword analysis', {
      detectedKeywords,
      availableTriggers: triggerWords,
      hasKeywords: detectedKeywords.length > 0
    });

    // Send SMS if keywords detected
    if (detectedKeywords.length > 0) {
      log('WARN', '🚨 TRIGGER WORDS DETECTED in speech!', {
        keywords: detectedKeywords,
        speechResult,
        caller,
        callSid
      });
      
      const alertSent = await sendAlertSMS(speechResult, detectedKeywords, caller, callSid);
      log('INFO', `📱 Alert SMS ${alertSent ? 'sent successfully' : 'failed'}`, { alertSent });
    }

    // Generate AI response
    const aiResponse = await generateAIResponse(speechResult, detectedKeywords.length > 0);

    log('INFO', '🤖 AI response generated', {
      responseLength: aiResponse.length,
      hasKeywords: detectedKeywords.length > 0
    });

    // Enhanced TwiML response with better conversation flow
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice" rate="medium">${aiResponse}</Say>
        <Gather input="speech" action="https://htegorovrqorrfydgadn.supabase.co/functions/v1/process-speech" 
                method="POST" speechTimeout="auto" timeout="20">
            <Say voice="alice" rate="medium">
                Is there anything else I can help you with? Please continue speaking, or say goodbye to end the call.
            </Say>
        </Gather>
        <Say voice="alice" rate="medium">
            Thank you for calling. If you need immediate assistance in the future, please call back and clearly state that you need help. Goodbye!
        </Say>
    </Response>`;

    log('INFO', '📤 Sending TwiML response', {
      responseLength: twimlResponse.length,
      callSid
    });

    return new Response(twimlResponse, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });

  } catch (error) {
    log('ERROR', '❌ Error processing speech', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">I'm sorry, I couldn't understand that clearly. Please try speaking again, or if this is an emergency, please hang up and dial emergency services.</Say>
        <Gather input="speech" action="https://htegorovrqorrfydgadn.supabase.co/functions/v1/process-speech" 
                method="POST" speechTimeout="auto" timeout="10">
            <Say voice="alice">Please speak now.</Say>
        </Gather>
        <Say voice="alice">Thank you for calling. Goodbye!</Say>
    </Response>`;

    return new Response(errorTwiml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });
  }
});

async function sendAlertSMS(transcript: string, keywords: string[], caller: string, callSid: string) {
  try {
    log('INFO', '📤 Preparing alert SMS', {
      keywords,
      caller,
      callSid,
      transcriptLength: transcript.length
    });

    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const emergencyContact = '+919178379226';

    log('INFO', '🔐 SMS credentials check', {
      hasSid: !!twilioSid,
      hasAuthToken: !!twilioAuthToken,
      emergencyContact
    });

    if (!twilioSid || !twilioAuthToken) {
      log('ERROR', '❌ Missing Twilio credentials for SMS');
      return false;
    }

    const message = `🚨 KEYWORD ALERT 🚨

USER NEEDS HELP!

Keywords detected: ${keywords.join(', ')}
From: ${caller}
Call ID: ${callSid}
Transcript: "${transcript}"

Time: ${new Date().toLocaleString()}
System: AI Call Monitor

Please respond immediately!`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651');
    formData.append('To', emergencyContact);
    formData.append('Body', message);

    log('INFO', '📤 Sending SMS via Twilio API');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();

    if (response.ok) {
      const result = JSON.parse(responseText);
      log('INFO', '✅ Alert SMS sent successfully', {
        messageSid: result.sid,
        status: result.status,
        to: result.to
      });
      return true;
    } else {
      log('ERROR', '❌ Failed to send SMS', {
        status: response.status,
        response: responseText
      });
      return false;
    }
  } catch (error) {
    log('ERROR', '❌ Error sending SMS', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

async function generateAIResponse(userInput: string, hasKeywords: boolean): Promise<string> {
  try {
    log('INFO', '🤖 Generating AI response', {
      inputLength: userInput.length,
      hasKeywords,
      input: userInput.substring(0, 100) + (userInput.length > 100 ? '...' : '')
    });
    
    const lowerInput = userInput.toLowerCase();
    
    if (hasKeywords) {
      if (lowerInput.includes('help') || lowerInput.includes('support')) {
        return "I understand you need help. I've immediately notified our support team and they will contact you shortly. Please stay on the line and tell me more about what specific help you need.";
      } else if (lowerInput.includes('emergency')) {
        return "This is being treated as an emergency. I've alerted our emergency response team immediately. Please stay calm and on the line. Can you tell me more about your emergency situation?";
      } else if (lowerInput.includes('problem') || lowerInput.includes('issue')) {
        return "I understand you're experiencing a problem. I've logged this as urgent and notified the appropriate team. Please describe the problem in more detail so I can better assist you.";
      } else if (lowerInput.includes('urgent')) {
        return "I recognize this is urgent. I've escalated this to our priority response team. Please tell me what urgent matter you need assistance with.";
      }
    }
    
    // Non-keyword responses
    if (lowerInput.includes('thank') || lowerInput.includes('goodbye') || lowerInput.includes('bye')) {
      return "You're welcome! I'm glad I could help. If you need assistance in the future, don't hesitate to call back. Have a great day!";
    } else if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return "Hello! I'm here to help you with any questions or concerns you might have. What can I assist you with today?";
    } else {
      return "Thank you for sharing that information. I'm here to help you with any concerns. Is there anything specific you need assistance with, or any problems I can help resolve?";
    }
  } catch (error) {
    log('ERROR', '❌ Error generating AI response', {
      error: error.message,
      stack: error.stack
    });
    return "I'm here to help you. Please let me know what you need assistance with.";
  }
}