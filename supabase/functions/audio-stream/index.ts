import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle WebSocket upgrade for audio streaming
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let assemblyAISocket: WebSocket | null = null;
    let callSid: string | null = null;
    let emergencyContact: string = '+919178379226'; // Default emergency contact

    socket.onopen = () => {
      console.log('Twilio WebSocket connected');
      
      // Connect to AssemblyAI
      connectToAssemblyAI();
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.event === 'start') {
          callSid = message.start?.callSid;
          console.log('Call started:', callSid);
        } else if (message.event === 'media') {
          // Forward audio data to AssemblyAI
          if (assemblyAISocket && assemblyAISocket.readyState === WebSocket.OPEN) {
            const audioData = {
              audio_data: message.media.payload
            };
            assemblyAISocket.send(JSON.stringify(audioData));
          }
        }
      } catch (error) {
        console.error('Error processing Twilio message:', error);
      }
    };

    socket.onclose = () => {
      console.log('Twilio WebSocket disconnected');
      if (assemblyAISocket) {
        assemblyAISocket.close();
      }
    };

    function connectToAssemblyAI() {
      const assemblyAIKey = Deno.env.get('ASSEMBLY_AI_API_KEY') || '34f52f7f50354e17821f52e80f366877';
      const assemblyAIUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${assemblyAIKey}`;
      
      assemblyAISocket = new WebSocket(assemblyAIUrl);
      
      assemblyAISocket.onopen = () => {
        console.log('Connected to AssemblyAI');
      };
      
      assemblyAISocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.message_type === 'FinalTranscript') {
            const transcript = data.text;
            console.log('Final transcript:', transcript);
            
            // Check for trigger words
            const detectedKeywords = triggerWords.filter(word => 
              transcript.toLowerCase().includes(word.toLowerCase())
            );
            
            if (detectedKeywords.length > 0) {
              console.log('🚨 TRIGGER WORDS DETECTED:', detectedKeywords);
              await sendEmergencyAlert(transcript, detectedKeywords, emergencyContact, callSid);
            }
          } else if (data.message_type === 'PartialTranscript') {
            console.log('Partial transcript:', data.text);
          }
        } catch (error) {
          console.error('Error processing AssemblyAI message:', error);
        }
      };
      
      assemblyAISocket.onerror = (error) => {
        console.error('AssemblyAI WebSocket error:', error);
      };
      
      assemblyAISocket.onclose = () => {
        console.log('AssemblyAI WebSocket disconnected');
      };
    }

    return response;
  }

  return new Response('WebSocket endpoint', { headers: corsHeaders });
});

async function sendEmergencyAlert(transcript: string, keywords: string[], emergencyContact: string, callSid: string | null) {
  try {
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!twilioSid || !twilioAuthToken) {
      console.error('Missing Twilio credentials');
      return false;
    }

    const message = `🚨 EMERGENCY ALERT 🚨\n\nUSER NEEDS HELP!\n\nKeywords detected: ${keywords.join(', ')}\nCall ID: ${callSid || 'Unknown'}\nTranscript: "${transcript}"\n\nTime: ${new Date().toLocaleString()}\n\nPlease respond immediately!`;

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
      console.log('✅ Emergency SMS sent successfully to:', emergencyContact);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send emergency SMS:', errorText);
      return false;
    }
  } catch (error) {
    console.error('Error sending emergency SMS:', error);
    return false;
  }
}