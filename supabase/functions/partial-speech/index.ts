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
  const logMessage = `[${timestamp}] [PARTIAL] [${level}] ${message}`;
  
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
    log('INFO', '🔄 Partial speech endpoint called');

    const formData = await req.formData();
    const partialResult = formData.get('UnstableSpeechResult')?.toString() || '';
    const stability = formData.get('Stability')?.toString() || '';
    const caller = formData.get('From')?.toString() || '';
    const callSid = formData.get('CallSid')?.toString() || '';
    
    log('DEBUG', '🔄 Partial speech data', {
      partialResult: partialResult.substring(0, 50) + (partialResult.length > 50 ? '...' : ''),
      stability: parseFloat(stability) || 0,
      caller,
      callSid,
      resultLength: partialResult.length
    });

    // Check for trigger words in partial results for early detection
    const detectedKeywords = triggerWords.filter(word => 
      partialResult.toLowerCase().includes(word.toLowerCase())
    );

    if (detectedKeywords.length > 0) {
      log('WARN', '⚡ Early trigger word detection in partial result!', {
        keywords: detectedKeywords,
        partialResult,
        stability: parseFloat(stability) || 0
      });
    }

    // Return empty response to continue gathering
    return new Response('', {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });

  } catch (error) {
    log('ERROR', '❌ Error processing partial speech', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response('', {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/xml' 
      }
    });
  }
});