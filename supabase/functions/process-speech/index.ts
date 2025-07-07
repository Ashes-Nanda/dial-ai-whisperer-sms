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
    const formData = await req.formData();
    const speechResult = formData.get('SpeechResult')?.toString() || '';
    const caller = formData.get('From')?.toString() || '';
    
    console.log('Speech received:', speechResult);
    console.log('From caller:', caller);

    // Check for trigger words
    const detectedKeywords = triggerWords.filter(word => 
      speechResult.toLowerCase().includes(word.toLowerCase())
    );

    // Send SMS if keywords detected
    if (detectedKeywords.length > 0) {
      await sendAlertSMS(speechResult, detectedKeywords, caller);
    }

    // Generate AI response using Eleven Labs
    const aiResponse = await generateAIResponse(speechResult);

    // TwiML response with AI-generated text
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">${aiResponse}</Say>
        <Gather input="speech" action="https://htegorovrqorrfydgadn.supabase.co/functions/v1/process-speech" method="POST" speechTimeout="3" timeout="10">
            <Say voice="alice">Is there anything else I can help you with?</Say>
        </Gather>
        <Say voice="alice">Thank you for calling. Goodbye!</Say>
    </Response>`;

    return new Response(twimlResponse, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });

  } catch (error) {
    console.error('Error processing speech:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">I'm sorry, I couldn't understand that. Please try again.</Say>
        <Gather input="speech" action="https://htegorovrqorrfydgadn.supabase.co/functions/v1/process-speech" method="POST" speechTimeout="3" timeout="10">
            <Say voice="alice">Please speak now.</Say>
        </Gather>
    </Response>`;

    return new Response(errorTwiml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });
  }
});

async function sendAlertSMS(transcript: string, keywords: string[], caller: string) {
  try {
    const twilioSid = Deno.env.get('TWILLIO_SID');
    const twilioAuthToken = Deno.env.get('TWILLIO_AUTH_TOKEN');

    const message = `🚨 KEYWORD ALERT 🚨\n\nKeywords detected: ${keywords.join(', ')}\nFrom: ${caller}\nTranscript: "${transcript}"\n\nTime: ${new Date().toLocaleString()}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651');
    formData.append('To', '+919178379226'); // Your alert number
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
      console.log('Alert SMS sent successfully');
    } else {
      console.error('Failed to send SMS:', await response.text());
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

async function generateAIResponse(userInput: string): Promise<string> {
  try {
    const elevenLabsApiKey = Deno.env.get('ELEVEN_LABS_API');
    
    // Simple AI responses based on keywords
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('help') || lowerInput.includes('support')) {
      return "I understand you need help. I've notified the support team and someone will assist you shortly. Can you tell me more about what you need help with?";
    } else if (lowerInput.includes('emergency')) {
      return "This appears to be an emergency. I've immediately alerted the emergency response team. Please stay on the line and describe your situation.";
    } else if (lowerInput.includes('problem') || lowerInput.includes('issue')) {
      return "I hear you're experiencing a problem. I've logged this and notified the appropriate team. Can you provide more details about the issue?";
    } else if (lowerInput.includes('urgent')) {
      return "I understand this is urgent. I've escalated this to priority support. Please tell me what specific urgent matter you need assistance with.";
    } else {
      return "Thank you for sharing that information. I'm here to help you. Is there anything specific you need assistance with today?";
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I'm here to help you. Please let me know what you need assistance with.";
  }
}