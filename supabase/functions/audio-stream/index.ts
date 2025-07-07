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
    let emergencyContact: string = '+919178379226';

    socket.onopen = () => {
      console.log('🔗 Twilio WebSocket connected');
      connectToAssemblyAI();
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.event) {
          case 'connected':
            console.log('📞 Twilio stream connected');
            break;
            
          case 'start':
            callSid = message.start?.callSid;
            console.log('🎬 Call started:', callSid);
            break;
            
          case 'media':
            // Forward audio data to AssemblyAI
            if (assemblyAISocket && assemblyAISocket.readyState === WebSocket.OPEN) {
              const audioData = {
                audio_data: message.media.payload
              };
              assemblyAISocket.send(JSON.stringify(audioData));
            }
            break;
            
          case 'stop':
            console.log('🛑 Call stopped');
            break;
        }
      } catch (error) {
        console.error('❌ Error processing Twilio message:', error);
      }
    };

    socket.onclose = () => {
      console.log('📴 Twilio WebSocket disconnected');
      if (assemblyAISocket) {
        assemblyAISocket.close();
      }
    };

    socket.onerror = (error) => {
      console.error('❌ Twilio WebSocket error:', error);
    };

    function connectToAssemblyAI() {
      const assemblyAIKey = Deno.env.get('ASSEMBLY_AI_API_KEY') || '34f52f7f50354e17821f52e80f366877';
      
      // AssemblyAI real-time transcription WebSocket URL
      // Using 8000 Hz sample rate for Twilio compatibility
      const assemblyAIUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${assemblyAIKey}`;
      
      console.log('🔗 Connecting to AssemblyAI...');
      assemblyAISocket = new WebSocket(assemblyAIUrl);
      
      assemblyAISocket.onopen = () => {
        console.log('✅ Connected to AssemblyAI real-time transcription');
      };
      
      assemblyAISocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.message_type === 'FinalTranscript' && data.text) {
            const transcript = data.text.trim();
            console.log('📝 Final transcript:', transcript);
            
            // Check for trigger words in the final transcript
            const detectedKeywords = triggerWords.filter(word => 
              transcript.toLowerCase().includes(word.toLowerCase())
            );
            
            if (detectedKeywords.length > 0) {
              console.log('🚨 TRIGGER WORDS DETECTED:', detectedKeywords);
              console.log('📱 Sending emergency SMS...');
              
              const smsResult = await sendEmergencyAlert(transcript, detectedKeywords, emergencyContact, callSid);
              
              if (smsResult) {
                console.log('✅ Emergency SMS sent successfully!');
              } else {
                console.log('❌ Failed to send emergency SMS');
              }
            }
          } else if (data.message_type === 'PartialTranscript' && data.text) {
            // Log partial transcripts for debugging
            console.log('🔄 Partial:', data.text);
          } else if (data.message_type === 'SessionBegins') {
            console.log('🎯 AssemblyAI session started:', data.session_id);
          }
        } catch (error) {
          console.error('❌ Error processing AssemblyAI message:', error);
        }
      };
      
      assemblyAISocket.onerror = (error) => {
        console.error('❌ AssemblyAI WebSocket error:', error);
      };
      
      assemblyAISocket.onclose = (event) => {
        console.log('📴 AssemblyAI WebSocket disconnected:', event.code, event.reason);
      };
    }

    return response;
  }

  return new Response('WebSocket endpoint for audio streaming', { headers: corsHeaders });
});

async function sendEmergencyAlert(transcript: string, keywords: string[], emergencyContact: string, callSid: string | null) {
  try {
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!twilioSid || !twilioAuthToken) {
      console.error('❌ Missing Twilio credentials for SMS');
      return false;
    }

    const message = `🚨 EMERGENCY ALERT 🚨

USER NEEDS HELP!

Keywords detected: ${keywords.join(', ')}
Call ID: ${callSid || 'Unknown'}
Transcript: "${transcript}"

Time: ${new Date().toLocaleString()}

Please respond immediately!`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', '+18152485651');
    formData.append('To', emergencyContact);
    formData.append('Body', message);

    console.log('📤 Sending SMS to:', emergencyContact);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Emergency SMS sent successfully! Message SID:', result.sid);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send emergency SMS:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending emergency SMS:', error);
    return false;
  }
}