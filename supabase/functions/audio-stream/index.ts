import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

// Enhanced logging utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
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

  log('INFO', '🎯 Audio stream endpoint called', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle WebSocket upgrade for audio streaming
  if (req.headers.get("upgrade") === "websocket") {
    log('INFO', '🔄 WebSocket upgrade requested');
    
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let assemblyAISocket: WebSocket | null = null;
    let callSid: string | null = null;
    let emergencyContact: string = '+919178379226';
    let isConnected = false;
    let transcriptBuffer: string[] = [];
    let lastTranscriptTime = Date.now();

    socket.onopen = () => {
      log('INFO', '🔗 Twilio WebSocket connection established');
      isConnected = true;
      connectToAssemblyAI();
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        log('DEBUG', '📨 Received Twilio message', { event: message.event });
        
        switch (message.event) {
          case 'connected':
            log('INFO', '📞 Twilio stream connected', {
              protocol: message.protocol,
              version: message.version
            });
            break;
            
          case 'start':
            callSid = message.start?.callSid;
            const streamSid = message.start?.streamSid;
            log('INFO', '🎬 Call started', {
              callSid,
              streamSid,
              accountSid: message.start?.accountSid,
              tracks: message.start?.tracks
            });
            
            // Log media format details
            if (message.start?.mediaFormat) {
              log('INFO', '🎵 Media format details', {
                encoding: message.start.mediaFormat.encoding,
                sampleRate: message.start.mediaFormat.sampleRate,
                channels: message.start.mediaFormat.channels
              });
            }
            break;
            
          case 'media':
            // Log media packet details (but not the actual payload to avoid spam)
            if (message.media) {
              log('DEBUG', '🎤 Audio data received', {
                timestamp: message.media.timestamp,
                track: message.media.track,
                chunk: message.media.chunk,
                payloadSize: message.media.payload?.length || 0
              });
              
              // Forward audio data to AssemblyAI
              if (assemblyAISocket && assemblyAISocket.readyState === WebSocket.OPEN) {
                const audioData = {
                  audio_data: message.media.payload
                };
                assemblyAISocket.send(JSON.stringify(audioData));
                log('DEBUG', '➡️ Audio forwarded to AssemblyAI');
              } else {
                log('WARN', '⚠️ AssemblyAI socket not ready, dropping audio packet');
              }
            }
            break;
            
          case 'stop':
            log('INFO', '🛑 Call stopped', {
              callSid,
              accountSid: message.stop?.accountSid
            });
            break;
            
          default:
            log('WARN', '❓ Unknown Twilio event', { event: message.event, data: message });
        }
      } catch (error) {
        log('ERROR', '❌ Error processing Twilio message', {
          error: error.message,
          stack: error.stack,
          rawData: event.data
        });
      }
    };

    socket.onclose = (event) => {
      log('INFO', '📴 Twilio WebSocket disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      isConnected = false;
      
      if (assemblyAISocket) {
        assemblyAISocket.close();
        log('INFO', '🔌 AssemblyAI connection closed');
      }
    };

    socket.onerror = (error) => {
      log('ERROR', '❌ Twilio WebSocket error', { error });
      isConnected = false;
    };

    function connectToAssemblyAI() {
      const assemblyAIKey = Deno.env.get('ASSEMBLY_AI_API_KEY') || '34f52f7f50354e17821f52e80f366877';
      
      log('INFO', '🔗 Connecting to AssemblyAI...', {
        hasApiKey: !!assemblyAIKey,
        keyPrefix: assemblyAIKey ? assemblyAIKey.substring(0, 8) + '...' : 'none'
      });
      
      // AssemblyAI real-time transcription WebSocket URL
      // Using 8000 Hz sample rate for Twilio compatibility
      const assemblyAIUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${assemblyAIKey}`;
      
      assemblyAISocket = new WebSocket(assemblyAIUrl);
      
      assemblyAISocket.onopen = () => {
        log('INFO', '✅ Connected to AssemblyAI real-time transcription', {
          readyState: assemblyAISocket?.readyState,
          url: 'wss://api.assemblyai.com/v2/realtime/ws'
        });
      };
      
      assemblyAISocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          log('DEBUG', '📝 AssemblyAI message received', { 
            messageType: data.message_type,
            hasText: !!data.text 
          });
          
          if (data.message_type === 'FinalTranscript' && data.text) {
            const transcript = data.text.trim();
            const confidence = data.confidence || 0;
            
            log('INFO', '📝 Final transcript received', {
              transcript,
              confidence,
              words: data.words?.length || 0,
              audioStart: data.audio_start,
              audioEnd: data.audio_end
            });
            
            // Add to transcript buffer for context
            transcriptBuffer.push(transcript);
            if (transcriptBuffer.length > 10) {
              transcriptBuffer.shift(); // Keep only last 10 transcripts
            }
            
            // Check for trigger words in the final transcript
            const detectedKeywords = triggerWords.filter(word => 
              transcript.toLowerCase().includes(word.toLowerCase())
            );
            
            if (detectedKeywords.length > 0) {
              log('WARN', '🚨 TRIGGER WORDS DETECTED!', {
                keywords: detectedKeywords,
                transcript,
                confidence,
                callSid,
                emergencyContact
              });
              
              log('INFO', '📱 Initiating emergency SMS...');
              const smsResult = await sendEmergencyAlert(
                transcript, 
                detectedKeywords, 
                emergencyContact, 
                callSid,
                transcriptBuffer.slice(-5) // Include last 5 transcripts for context
              );
              
              if (smsResult) {
                log('INFO', '✅ Emergency SMS sent successfully!');
              } else {
                log('ERROR', '❌ Failed to send emergency SMS');
              }
            } else {
              log('DEBUG', '✅ No trigger words detected', {
                transcript,
                availableTriggers: triggerWords
              });
            }
            
            lastTranscriptTime = Date.now();
            
          } else if (data.message_type === 'PartialTranscript' && data.text) {
            // Log partial transcripts for debugging (less verbose)
            log('DEBUG', '🔄 Partial transcript', { 
              text: data.text.substring(0, 50) + (data.text.length > 50 ? '...' : ''),
              confidence: data.confidence 
            });
            
          } else if (data.message_type === 'SessionBegins') {
            log('INFO', '🎯 AssemblyAI session started', {
              sessionId: data.session_id,
              expiresAt: data.expires_at
            });
            
          } else if (data.message_type === 'SessionTerminated') {
            log('INFO', '🔚 AssemblyAI session terminated', {
              sessionId: data.session_id
            });
            
          } else if (data.message_type === 'Error') {
            log('ERROR', '❌ AssemblyAI error', {
              error: data.error,
              errorCode: data.error_code
            });
          }
        } catch (error) {
          log('ERROR', '❌ Error processing AssemblyAI message', {
            error: error.message,
            stack: error.stack,
            rawData: event.data
          });
        }
      };
      
      assemblyAISocket.onerror = (error) => {
        log('ERROR', '❌ AssemblyAI WebSocket error', { error });
      };
      
      assemblyAISocket.onclose = (event) => {
        log('INFO', '📴 AssemblyAI WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
      };
    }

    return response;
  }

  // Non-WebSocket requests
  log('INFO', '📄 Non-WebSocket request received');
  return new Response('WebSocket endpoint for audio streaming', { 
    headers: corsHeaders,
    status: 200 
  });
});

async function sendEmergencyAlert(
  transcript: string, 
  keywords: string[], 
  emergencyContact: string, 
  callSid: string | null,
  transcriptContext: string[] = []
) {
  try {
    log('INFO', '📤 Preparing emergency SMS', {
      keywords,
      emergencyContact,
      callSid,
      transcriptLength: transcript.length,
      contextTranscripts: transcriptContext.length
    });

    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18152485651';

    log('INFO', '🔐 Twilio credentials check', {
      hasSid: !!twilioSid,
      hasAuthToken: !!twilioAuthToken,
      phoneNumber: twilioPhoneNumber,
      sidPrefix: twilioSid ? twilioSid.substring(0, 8) + '...' : 'missing'
    });

    if (!twilioSid || !twilioAuthToken) {
      log('ERROR', '❌ Missing Twilio credentials for SMS');
      return false;
    }

    // Create comprehensive alert message
    const contextText = transcriptContext.length > 0 
      ? `\n\nRecent conversation:\n${transcriptContext.join('\n')}`
      : '';

    const message = `🚨 EMERGENCY ALERT 🚨

USER NEEDS HELP!

Keywords detected: ${keywords.join(', ')}
Call ID: ${callSid || 'Unknown'}
Current statement: "${transcript}"${contextText}

Time: ${new Date().toLocaleString()}
System: AI Call Monitor

Please respond immediately!`;

    log('INFO', '📝 SMS message prepared', {
      messageLength: message.length,
      keywords: keywords.length,
      hasContext: transcriptContext.length > 0
    });

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', twilioPhoneNumber);
    formData.append('To', emergencyContact);
    formData.append('Body', message);

    log('INFO', '📤 Sending SMS to Twilio API', {
      from: twilioPhoneNumber,
      to: emergencyContact,
      url: twilioUrl
    });

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();
    
    log('INFO', '📊 Twilio API response', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (response.ok) {
      const result = JSON.parse(responseText);
      log('INFO', '✅ Emergency SMS sent successfully!', {
        messageSid: result.sid,
        status: result.status,
        direction: result.direction,
        from: result.from,
        to: result.to,
        dateCreated: result.date_created,
        price: result.price,
        priceUnit: result.price_unit
      });
      return true;
    } else {
      log('ERROR', '❌ Failed to send emergency SMS', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText
      });
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        log('ERROR', '📋 Twilio error details', {
          code: errorData.code,
          message: errorData.message,
          moreInfo: errorData.more_info,
          status: errorData.status
        });
      } catch (parseError) {
        log('ERROR', '❌ Could not parse error response', { parseError: parseError.message });
      }
      
      return false;
    }
  } catch (error) {
    log('ERROR', '❌ Error sending emergency SMS', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    return false;
  }
}