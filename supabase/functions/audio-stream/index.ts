import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced logging utility with database storage
async function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any, callId?: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [AUDIO-STREAM] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, JSON.stringify(data, null, 2));
  } else {
    console.log(logMessage);
  }

  // Store in database (fire and forget)
  try {
    await supabase.from('system_logs').insert([{
      call_id: callId,
      level,
      component: 'audio-stream',
      message,
      metadata: data || {}
    }]);
  } catch (error) {
    console.error('Failed to store log in database:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await log('INFO', '🎯 Audio stream endpoint called', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle WebSocket upgrade for audio streaming
  if (req.headers.get("upgrade") === "websocket") {
    await log('INFO', '🔄 WebSocket upgrade requested');
    
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    let assemblyAISocket: WebSocket | null = null;
    let callSid: string | null = null;
    let callId: string | null = null;
    let emergencyContact: string = '+919178379226';
    let isConnected = false;
    let transcriptBuffer: string[] = [];
    let lastTranscriptTime = Date.now();

    socket.onopen = async () => {
      await log('INFO', '🔗 Twilio WebSocket connection established');
      isConnected = true;
      connectToAssemblyAI();
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await log('DEBUG', '📨 Received Twilio message', { event: message.event }, callId);
        
        switch (message.event) {
          case 'connected':
            await log('INFO', '📞 Twilio stream connected', {
              protocol: message.protocol,
              version: message.version
            }, callId);
            break;
            
          case 'start':
            callSid = message.start?.callSid;
            const streamSid = message.start?.streamSid;
            
            await log('INFO', '🎬 Call started', {
              callSid,
              streamSid,
              accountSid: message.start?.accountSid,
              tracks: message.start?.tracks
            });

            // Find or create call record in database
            if (callSid) {
              const { data: existingCall } = await supabase
                .from('calls')
                .select('id')
                .eq('call_sid', callSid)
                .single();

              if (existingCall) {
                callId = existingCall.id;
                await log('INFO', '📋 Found existing call record', { callId, callSid });
              } else {
                await log('WARN', '⚠️ Call record not found in database', { callSid });
              }
            }
            
            // Log media format details
            if (message.start?.mediaFormat) {
              await log('INFO', '🎵 Media format details', {
                encoding: message.start.mediaFormat.encoding,
                sampleRate: message.start.mediaFormat.sampleRate,
                channels: message.start.mediaFormat.channels
              }, callId);
            }
            break;
            
          case 'media':
            // Log media packet details (but not the actual payload to avoid spam)
            if (message.media) {
              await log('DEBUG', '🎤 Audio data received', {
                timestamp: message.media.timestamp,
                track: message.media.track,
                chunk: message.media.chunk,
                payloadSize: message.media.payload?.length || 0
              }, callId);
              
              // Forward audio data to AssemblyAI
              if (assemblyAISocket && assemblyAISocket.readyState === WebSocket.OPEN) {
                const audioData = {
                  audio_data: message.media.payload
                };
                assemblyAISocket.send(JSON.stringify(audioData));
                await log('DEBUG', '➡️ Audio forwarded to AssemblyAI', {}, callId);
              } else {
                await log('WARN', '⚠️ AssemblyAI socket not ready, dropping audio packet', {}, callId);
              }
            }
            break;
            
          case 'stop':
            await log('INFO', '🛑 Call stopped', {
              callSid,
              accountSid: message.stop?.accountSid
            }, callId);

            // Update call status in database
            if (callSid) {
              await supabase
                .from('calls')
                .update({ 
                  status: 'completed',
                  ended_at: new Date().toISOString()
                })
                .eq('call_sid', callSid);
            }
            break;
            
          default:
            await log('WARN', '❓ Unknown Twilio event', { event: message.event, data: message }, callId);
        }
      } catch (error) {
        await log('ERROR', '❌ Error processing Twilio message', {
          error: error.message,
          stack: error.stack,
          rawData: event.data
        }, callId);
      }
    };

    socket.onclose = async (event) => {
      await log('INFO', '📴 Twilio WebSocket disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      }, callId);
      isConnected = false;
      
      if (assemblyAISocket) {
        assemblyAISocket.close();
        await log('INFO', '🔌 AssemblyAI connection closed', {}, callId);
      }
    };

    socket.onerror = async (error) => {
      await log('ERROR', '❌ Twilio WebSocket error', { error }, callId);
      isConnected = false;
    };

    function connectToAssemblyAI() {
      const assemblyAIKey = Deno.env.get('ASSEMBLY_AI_API_KEY') || '34f52f7f50354e17821f52e80f366877';
      
      log('INFO', '🔗 Connecting to AssemblyAI...', {
        hasApiKey: !!assemblyAIKey,
        keyPrefix: assemblyAIKey ? assemblyAIKey.substring(0, 8) + '...' : 'none'
      }, callId);
      
      // AssemblyAI real-time transcription WebSocket URL
      const assemblyAIUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${assemblyAIKey}`;
      
      assemblyAISocket = new WebSocket(assemblyAIUrl);
      
      assemblyAISocket.onopen = async () => {
        await log('INFO', '✅ Connected to AssemblyAI real-time transcription', {
          readyState: assemblyAISocket?.readyState,
          url: 'wss://api.assemblyai.com/v2/realtime/ws'
        }, callId);
      };
      
      assemblyAISocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await log('DEBUG', '📝 AssemblyAI message received', { 
            messageType: data.message_type,
            hasText: !!data.text 
          }, callId);
          
          if (data.message_type === 'FinalTranscript' && data.text) {
            const transcript = data.text.trim();
            const confidence = data.confidence || 0;
            
            await log('INFO', '📝 Final transcript received', {
              transcript,
              confidence,
              words: data.words?.length || 0,
              audioStart: data.audio_start,
              audioEnd: data.audio_end
            }, callId);

            // Store transcript in database
            if (callId) {
              const { data: transcriptRecord } = await supabase
                .from('transcripts')
                .insert([{
                  call_id: callId,
                  transcript_type: 'final',
                  text: transcript,
                  confidence: confidence,
                  audio_start: data.audio_start || 0,
                  audio_end: data.audio_end || 0,
                  speaker: 'caller'
                }])
                .select()
                .single();

              await log('INFO', '💾 Transcript stored in database', { 
                transcriptId: transcriptRecord?.id 
              }, callId);
            }
            
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
              await log('WARN', '🚨 TRIGGER WORDS DETECTED!', {
                keywords: detectedKeywords,
                transcript,
                confidence,
                callSid,
                emergencyContact
              }, callId);

              // Store keyword detection in database
              let keywordDetectionId = null;
              if (callId) {
                const { data: detection } = await supabase
                  .from('keyword_detections')
                  .insert([{
                    call_id: callId,
                    keywords: detectedKeywords,
                    context_transcript: transcript,
                    confidence: confidence,
                    alert_sent: false,
                    alert_status: 'pending'
                  }])
                  .select()
                  .single();

                keywordDetectionId = detection?.id;
                await log('INFO', '💾 Keyword detection stored', { 
                  detectionId: keywordDetectionId 
                }, callId);
              }
              
              await log('INFO', '📱 Initiating emergency SMS...');
              const smsResult = await sendEmergencyAlert(
                transcript, 
                detectedKeywords, 
                emergencyContact, 
                callSid,
                transcriptBuffer.slice(-5), // Include last 5 transcripts for context
                callId,
                keywordDetectionId
              );
              
              if (smsResult) {
                await log('INFO', '✅ Emergency SMS sent successfully!', {}, callId);
                
                // Update keyword detection status
                if (keywordDetectionId) {
                  await supabase
                    .from('keyword_detections')
                    .update({ 
                      alert_sent: true, 
                      alert_status: 'success' 
                    })
                    .eq('id', keywordDetectionId);
                }
              } else {
                await log('ERROR', '❌ Failed to send emergency SMS', {}, callId);
                
                // Update keyword detection status
                if (keywordDetectionId) {
                  await supabase
                    .from('keyword_detections')
                    .update({ 
                      alert_sent: false, 
                      alert_status: 'failed' 
                    })
                    .eq('id', keywordDetectionId);
                }
              }
            } else {
              await log('DEBUG', '✅ No trigger words detected', {
                transcript,
                availableTriggers: triggerWords
              }, callId);
            }
            
            lastTranscriptTime = Date.now();
            
          } else if (data.message_type === 'PartialTranscript' && data.text) {
            // Log partial transcripts for debugging (less verbose)
            await log('DEBUG', '🔄 Partial transcript', { 
              text: data.text.substring(0, 50) + (data.text.length > 50 ? '...' : ''),
              confidence: data.confidence 
            }, callId);

            // Store partial transcript in database (optional, for debugging)
            if (callId && data.text.length > 10) { // Only store substantial partial transcripts
              await supabase
                .from('transcripts')
                .insert([{
                  call_id: callId,
                  transcript_type: 'partial',
                  text: data.text,
                  confidence: data.confidence || 0,
                  speaker: 'caller'
                }]);
            }
            
          } else if (data.message_type === 'SessionBegins') {
            await log('INFO', '🎯 AssemblyAI session started', {
              sessionId: data.session_id,
              expiresAt: data.expires_at
            }, callId);
            
          } else if (data.message_type === 'SessionTerminated') {
            await log('INFO', '🔚 AssemblyAI session terminated', {
              sessionId: data.session_id
            }, callId);
            
          } else if (data.message_type === 'Error') {
            await log('ERROR', '❌ AssemblyAI error', {
              error: data.error,
              errorCode: data.error_code
            }, callId);
          }
        } catch (error) {
          await log('ERROR', '❌ Error processing AssemblyAI message', {
            error: error.message,
            stack: error.stack,
            rawData: event.data
          }, callId);
        }
      };
      
      assemblyAISocket.onerror = async (error) => {
        await log('ERROR', '❌ AssemblyAI WebSocket error', { error }, callId);
      };
      
      assemblyAISocket.onclose = async (event) => {
        await log('INFO', '📴 AssemblyAI WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        }, callId);
      };
    }

    return response;
  }

  // Non-WebSocket requests
  await log('INFO', '📄 Non-WebSocket request received');
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
  transcriptContext: string[] = [],
  callId: string | null = null,
  keywordDetectionId: string | null = null
) {
  try {
    await log('INFO', '📤 Preparing emergency SMS', {
      keywords,
      emergencyContact,
      callSid,
      transcriptLength: transcript.length,
      contextTranscripts: transcriptContext.length
    }, callId);

    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18152485651';

    await log('INFO', '🔐 Twilio credentials check', {
      hasSid: !!twilioSid,
      hasAuthToken: !!twilioAuthToken,
      phoneNumber: twilioPhoneNumber,
      sidPrefix: twilioSid ? twilioSid.substring(0, 8) + '...' : 'missing'
    }, callId);

    if (!twilioSid || !twilioAuthToken) {
      await log('ERROR', '❌ Missing Twilio credentials for SMS', {}, callId);
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

    await log('INFO', '📝 SMS message prepared', {
      messageLength: message.length,
      keywords: keywords.length,
      hasContext: transcriptContext.length > 0
    }, callId);

    // Store SMS alert in database before sending
    let smsAlertId = null;
    if (callId) {
      const { data: smsAlert } = await supabase
        .from('sms_alerts')
        .insert([{
          call_id: callId,
          keyword_detection_id: keywordDetectionId,
          recipient: emergencyContact,
          message: message,
          status: 'pending'
        }])
        .select()
        .single();

      smsAlertId = smsAlert?.id;
      await log('INFO', '💾 SMS alert record created', { smsAlertId }, callId);
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', twilioPhoneNumber);
    formData.append('To', emergencyContact);
    formData.append('Body', message);

    await log('INFO', '📤 Sending SMS to Twilio API', {
      from: twilioPhoneNumber,
      to: emergencyContact,
      url: twilioUrl
    }, callId);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await response.text();
    
    await log('INFO', '📊 Twilio API response', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    }, callId);

    if (response.ok) {
      const result = JSON.parse(responseText);
      await log('INFO', '✅ Emergency SMS sent successfully!', {
        messageSid: result.sid,
        status: result.status,
        direction: result.direction,
        from: result.from,
        to: result.to,
        dateCreated: result.date_created,
        price: result.price,
        priceUnit: result.price_unit
      }, callId);

      // Update SMS alert record with success
      if (smsAlertId) {
        await supabase
          .from('sms_alerts')
          .update({
            twilio_message_sid: result.sid,
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', smsAlertId);
      }

      return true;
    } else {
      await log('ERROR', '❌ Failed to send emergency SMS', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText
      }, callId);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        await log('ERROR', '📋 Twilio error details', {
          code: errorData.code,
          message: errorData.message,
          moreInfo: errorData.more_info,
          status: errorData.status
        }, callId);
      } catch (parseError) {
        await log('ERROR', '❌ Could not parse error response', { parseError: parseError.message }, callId);
      }

      // Update SMS alert record with failure
      if (smsAlertId) {
        await supabase
          .from('sms_alerts')
          .update({
            status: 'failed',
            error_message: responseText
          })
          .eq('id', smsAlertId);
      }
      
      return false;
    }
  } catch (error) {
    await log('ERROR', '❌ Error sending emergency SMS', {
      error: error.message,
      stack: error.stack,
      name: error.name
    }, callId);
    return false;
  }
}