import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [STATUS] [${level}] ${message}`;
  
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
    log('INFO', '📊 Call status webhook called');

    const formData = await req.formData();
    const callSid = formData.get('CallSid')?.toString();
    const callStatus = formData.get('CallStatus')?.toString();
    const from = formData.get('From')?.toString();
    const to = formData.get('To')?.toString();
    const duration = formData.get('CallDuration')?.toString();
    const direction = formData.get('Direction')?.toString();
    const answeredBy = formData.get('AnsweredBy')?.toString();
    
    log('INFO', '📋 Call status update', {
      callSid,
      callStatus,
      from,
      to,
      duration: duration ? `${duration}s` : 'N/A',
      direction,
      answeredBy,
      timestamp: new Date().toISOString(),
      allParams: Object.fromEntries(formData.entries())
    });

    // Log different call statuses
    switch (callStatus) {
      case 'initiated':
        log('INFO', '🚀 Call initiated', { callSid, from, to });
        break;
      case 'ringing':
        log('INFO', '📞 Call ringing', { callSid, from, to });
        break;
      case 'in-progress':
        log('INFO', '🎙️ Call in progress', { callSid, from, to });
        break;
      case 'completed':
        log('INFO', '✅ Call completed', { 
          callSid, 
          from, 
          to, 
          duration: duration ? `${duration}s` : 'unknown',
          answeredBy 
        });
        break;
      case 'busy':
        log('WARN', '📵 Call busy', { callSid, from, to });
        break;
      case 'no-answer':
        log('WARN', '📴 Call not answered', { callSid, from, to });
        break;
      case 'failed':
        log('ERROR', '❌ Call failed', { callSid, from, to });
        break;
      case 'canceled':
        log('INFO', '🚫 Call canceled', { callSid, from, to });
        break;
      default:
        log('INFO', '❓ Unknown call status', { callStatus, callSid, from, to });
    }

    // Return success response
    return new Response('OK', {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/plain' 
      }
    });

  } catch (error) {
    log('ERROR', '❌ Error processing call status', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response('Error', {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/plain' 
      }
    });
  }
});