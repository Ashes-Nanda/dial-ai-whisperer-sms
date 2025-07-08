import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

// Initialize Supabase client for database operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced logging utility with database storage
async function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any, callId?: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [ELEVEN-LABS] [${level}] ${message}`;
  
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
      component: 'eleven-labs-webhook',
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

  try {
    await log('INFO', '🎯 Eleven Labs webhook called', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

    const body = await req.json();
    
    await log('INFO', '📨 Webhook payload received', {
      type: body.type,
      conversationId: body.conversation_id,
      hasUserMessage: !!body.user_message,
      hasTranscript: !!body.transcript
    });

    // Handle different webhook types from Eleven Labs
    switch (body.type) {
      case 'conversation_started':
        return await handleConversationStarted(body);
      
      case 'user_message':
        return await handleUserMessage(body);
      
      case 'agent_response':
        return await handleAgentResponse(body);
      
      case 'conversation_ended':
        return await handleConversationEnded(body);
      
      case 'transcript':
        return await handleTranscript(body);
      
      default:
        await log('WARN', '❓ Unknown webhook type', { type: body.type, body });
        return new Response(
          JSON.stringify({ success: true, message: 'Unknown webhook type processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    await log('ERROR', '❌ Error processing Eleven Labs webhook', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleConversationStarted(body: any) {
  const conversationId = body.conversation_id;
  const phoneNumber = body.phone_number || body.to_number;
  
  await log('INFO', '🎬 Conversation started', {
    conversationId,
    phoneNumber,
    agentId: body.agent_id
  });

  // Find or create call record
  let callRecord = null;
  if (conversationId) {
    const { data: existingCall } = await supabase
      .from('calls')
      .select('*')
      .eq('call_sid', conversationId)
      .single();

    if (existingCall) {
      callRecord = existingCall;
      await log('INFO', '📋 Found existing call record', { callId: callRecord.id });
    } else if (phoneNumber) {
      // Create new call record
      const { data: newCall } = await supabase
        .from('calls')
        .insert([{
          call_sid: conversationId,
          phone_number: phoneNumber,
          emergency_contact: '+919178379226',
          status: 'in-progress',
          direction: 'outbound',
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      callRecord = newCall;
      await log('INFO', '💾 Created new call record', { callId: callRecord?.id });
    }
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Conversation started' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUserMessage(body: any) {
  const conversationId = body.conversation_id;
  const userMessage = body.user_message || body.message || body.transcript;
  const confidence = body.confidence || 1.0;
  
  await log('INFO', '🎤 User message received', {
    conversationId,
    message: userMessage,
    confidence,
    messageLength: userMessage?.length || 0
  });

  if (!userMessage) {
    return new Response(
      JSON.stringify({ success: true, message: 'No user message to process' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Find call record
  const { data: callRecord } = await supabase
    .from('calls')
    .select('*')
    .eq('call_sid', conversationId)
    .single();

  let callId = callRecord?.id;

  // Store transcript
  if (callId) {
    const { data: transcript } = await supabase
      .from('transcripts')
      .insert([{
        call_id: callId,
        transcript_type: 'final',
        text: userMessage,
        confidence: confidence,
        speaker: 'caller'
      }])
      .select()
      .single();

    await log('INFO', '💾 Transcript stored', { 
      transcriptId: transcript?.id,
      callId 
    }, callId);
  }

  // Check for trigger words
  const detectedKeywords = triggerWords.filter(word => 
    userMessage.toLowerCase().includes(word.toLowerCase())
  );

  if (detectedKeywords.length > 0) {
    await log('WARN', '🚨 TRIGGER WORDS DETECTED!', {
      keywords: detectedKeywords,
      message: userMessage,
      conversationId
    }, callId);

    // Store keyword detection
    let keywordDetectionId = null;
    if (callId) {
      const { data: detection } = await supabase
        .from('keyword_detections')
        .insert([{
          call_id: callId,
          keywords: detectedKeywords,
          context_transcript: userMessage,
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

    // Send emergency SMS
    const smsResult = await sendEmergencyAlert(
      userMessage,
      detectedKeywords,
      '+919178379226',
      conversationId,
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
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      keywords_detected: detectedKeywords,
      alert_sent: detectedKeywords.length > 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleAgentResponse(body: any) {
  const conversationId = body.conversation_id;
  const agentMessage = body.agent_message || body.message;
  
  await log('INFO', '🤖 Agent response', {
    conversationId,
    message: agentMessage?.substring(0, 100) + (agentMessage?.length > 100 ? '...' : ''),
    messageLength: agentMessage?.length || 0
  });

  // Find call record and store agent response
  const { data: callRecord } = await supabase
    .from('calls')
    .select('*')
    .eq('call_sid', conversationId)
    .single();

  if (callRecord && agentMessage) {
    await supabase
      .from('transcripts')
      .insert([{
        call_id: callRecord.id,
        transcript_type: 'final',
        text: agentMessage,
        confidence: 1.0,
        speaker: 'agent'
      }]);

    await log('INFO', '💾 Agent response stored', { callId: callRecord.id }, callRecord.id);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Agent response processed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleConversationEnded(body: any) {
  const conversationId = body.conversation_id;
  const duration = body.duration || 0;
  
  await log('INFO', '🔚 Conversation ended', {
    conversationId,
    duration,
    reason: body.reason
  });

  // Update call record
  const { data: callRecord } = await supabase
    .from('calls')
    .update({
      status: 'completed',
      duration: duration,
      ended_at: new Date().toISOString()
    })
    .eq('call_sid', conversationId)
    .select()
    .single();

  if (callRecord) {
    await log('INFO', '💾 Call record updated', { callId: callRecord.id }, callRecord.id);
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Conversation ended' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTranscript(body: any) {
  const conversationId = body.conversation_id;
  const transcript = body.transcript;
  const speaker = body.speaker || 'caller';
  const confidence = body.confidence || 1.0;
  
  await log('INFO', '📝 Transcript received', {
    conversationId,
    speaker,
    transcript: transcript?.substring(0, 100) + (transcript?.length > 100 ? '...' : ''),
    confidence
  });

  // This is similar to handleUserMessage but for general transcripts
  if (speaker === 'user' || speaker === 'caller') {
    return await handleUserMessage({ ...body, user_message: transcript });
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Transcript processed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendEmergencyAlert(
  transcript: string,
  keywords: string[],
  emergencyContact: string,
  conversationId: string,
  callId: string | null = null,
  keywordDetectionId: string | null = null
) {
  try {
    await log('INFO', '📤 Preparing emergency SMS', {
      keywords,
      emergencyContact,
      conversationId,
      transcriptLength: transcript.length
    }, callId);

    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || '+18152485651';

    if (!twilioSid || !twilioAuthToken) {
      await log('ERROR', '❌ Missing Twilio credentials for SMS', {}, callId);
      return false;
    }

    const message = `🚨 EMERGENCY ALERT 🚨

USER NEEDS HELP!

Keywords detected: ${keywords.join(', ')}
Conversation ID: ${conversationId}
Current statement: "${transcript}"

Time: ${new Date().toLocaleString()}
System: AI Call Monitor (Eleven Labs)

Please respond immediately!`;

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
      await log('INFO', '✅ Emergency SMS sent successfully!', {
        messageSid: result.sid,
        status: result.status
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
        responseBody: responseText
      }, callId);

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
      stack: error.stack
    }, callId);
    return false;
  }
}