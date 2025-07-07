import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store active transcription sessions
const activeSessions = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const streamSid = formData.get('StreamSid')?.toString();
    
    console.log('Twilio webhook received:', { callSid, callStatus, streamSid });

    if (callStatus === 'in-progress' && !activeSessions.has(callSid)) {
      // Start AssemblyAI transcription for this call
      await startAssemblyAITranscription(callSid, streamSid);
      activeSessions.set(callSid, { streamSid, startTime: new Date() });
    } else if (callStatus === 'completed' || callStatus === 'failed') {
      // Clean up session
      if (activeSessions.has(callSid)) {
        await stopAssemblyAITranscription(callSid);
        activeSessions.delete(callSid);
      }
    }

    // TwiML response to start media streaming
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Start>
            <Stream url="wss://htegorovrqorrfydgadn.supabase.co/functions/v1/audio-stream" />
        </Start>
        <Say voice="alice">Hello! I'm an AI assistant. How can I help you today?</Say>
        <Pause length="30"/>
        <Say voice="alice">Thank you for calling. Goodbye!</Say>
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

async function startAssemblyAITranscription(callSid: string, streamSid: string) {
  try {
    console.log(`Starting AssemblyAI transcription for call: ${callSid}`);
    
    // Initialize AssemblyAI streaming transcription
    const assemblyAIKey = Deno.env.get('ASSEMBLY_AI_API_KEY') || '34f52f7f50354e17821f52e80f366877';
    
    // This would typically involve setting up a WebSocket connection to AssemblyAI
    // For now, we'll log that transcription has started
    console.log('AssemblyAI transcription session started for:', callSid);
    
  } catch (error) {
    console.error('Error starting AssemblyAI transcription:', error);
  }
}

async function stopAssemblyAITranscription(callSid: string) {
  try {
    console.log(`Stopping AssemblyAI transcription for call: ${callSid}`);
    // Clean up AssemblyAI session
  } catch (error) {
    console.error('Error stopping AssemblyAI transcription:', error);
  }
}