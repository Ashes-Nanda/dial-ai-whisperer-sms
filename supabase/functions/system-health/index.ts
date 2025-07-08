import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced logging utility
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [HEALTH] [${level}] ${message}`;
  
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
    log('INFO', '🏥 System health check requested');

    // Check environment variables
    const twilioSid = Deno.env.get('TWILIO_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const assemblyAIKey = Deno.env.get('ASSEMBLY_AI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    const envCheck = {
      twilio_sid: !!twilioSid,
      twilio_auth_token: !!twilioAuthToken,
      twilio_phone_number: !!twilioPhoneNumber,
      assembly_ai_key: !!assemblyAIKey,
      supabase_url: !!supabaseUrl
    };

    log('INFO', '🔐 Environment variables status', envCheck);

    // Test Twilio API connectivity
    let twilioStatus = 'unknown';
    let twilioError = null;
    
    if (twilioSid && twilioAuthToken) {
      try {
        const twilioTestUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`;
        const response = await fetch(twilioTestUrl, {
          headers: {
            'Authorization': `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`
          }
        });
        
        if (response.ok) {
          twilioStatus = 'connected';
          log('INFO', '✅ Twilio API connection successful');
        } else {
          twilioStatus = 'error';
          twilioError = `HTTP ${response.status}`;
          log('WARN', '⚠️ Twilio API connection failed', { status: response.status });
        }
      } catch (error) {
        twilioStatus = 'error';
        twilioError = error.message;
        log('ERROR', '❌ Twilio API test failed', { error: error.message });
      }
    } else {
      twilioStatus = 'missing_credentials';
      log('WARN', '⚠️ Twilio credentials missing');
    }

    // Test AssemblyAI connectivity
    let assemblyAIStatus = 'unknown';
    let assemblyAIError = null;
    
    if (assemblyAIKey) {
      try {
        const assemblyTestUrl = 'https://api.assemblyai.com/v2/transcript';
        const response = await fetch(assemblyTestUrl, {
          method: 'POST',
          headers: {
            'Authorization': assemblyAIKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio_url: 'https://example.com/test.wav' // This will fail but test auth
          })
        });
        
        // Even a 400 error means we can connect and auth is working
        if (response.status === 400 || response.status === 200) {
          assemblyAIStatus = 'connected';
          log('INFO', '✅ AssemblyAI API connection successful');
        } else if (response.status === 401) {
          assemblyAIStatus = 'auth_error';
          assemblyAIError = 'Invalid API key';
          log('WARN', '⚠️ AssemblyAI authentication failed');
        } else {
          assemblyAIStatus = 'error';
          assemblyAIError = `HTTP ${response.status}`;
          log('WARN', '⚠️ AssemblyAI API connection failed', { status: response.status });
        }
      } catch (error) {
        assemblyAIStatus = 'error';
        assemblyAIError = error.message;
        log('ERROR', '❌ AssemblyAI API test failed', { error: error.message });
      }
    } else {
      assemblyAIStatus = 'missing_credentials';
      log('WARN', '⚠️ AssemblyAI credentials missing');
    }

    // Overall system health
    const allSystemsGo = envCheck.twilio_sid && 
                        envCheck.twilio_auth_token && 
                        envCheck.assembly_ai_key && 
                        twilioStatus === 'connected' && 
                        assemblyAIStatus === 'connected';

    const healthReport = {
      timestamp: new Date().toISOString(),
      overall_status: allSystemsGo ? 'healthy' : 'degraded',
      environment_variables: envCheck,
      services: {
        twilio: {
          status: twilioStatus,
          error: twilioError,
          phone_number: twilioPhoneNumber || 'not_configured'
        },
        assembly_ai: {
          status: assemblyAIStatus,
          error: assemblyAIError
        }
      },
      endpoints: {
        audio_stream: `${supabaseUrl}/functions/v1/audio-stream`,
        twilio_webhook: `${supabaseUrl}/functions/v1/twilio-webhook`,
        process_speech: `${supabaseUrl}/functions/v1/process-speech`,
        initiate_call: `${supabaseUrl}/functions/v1/initiate-call`
      },
      recommendations: []
    };

    // Add recommendations based on status
    if (!envCheck.twilio_sid || !envCheck.twilio_auth_token) {
      healthReport.recommendations.push('Configure Twilio credentials in environment variables');
    }
    if (!envCheck.assembly_ai_key) {
      healthReport.recommendations.push('Configure AssemblyAI API key in environment variables');
    }
    if (twilioStatus === 'error') {
      healthReport.recommendations.push('Check Twilio account status and credentials');
    }
    if (assemblyAIStatus === 'error') {
      healthReport.recommendations.push('Check AssemblyAI account status and API key');
    }
    if (allSystemsGo) {
      healthReport.recommendations.push('All systems operational - ready for production use');
    }

    log('INFO', '📊 Health check completed', {
      overallStatus: healthReport.overall_status,
      twilioStatus,
      assemblyAIStatus
    });

    return new Response(
      JSON.stringify(healthReport, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    log('ERROR', '❌ Health check failed', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        timestamp: new Date().toISOString(),
        overall_status: 'error',
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});