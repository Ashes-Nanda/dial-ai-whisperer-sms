import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced logging utility with database storage
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [DB-LOGGER] [${level}] ${message}`;
  
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
    log('INFO', '📊 Database logger endpoint called');

    const { 
      call_id, 
      level, 
      component, 
      message, 
      metadata 
    } = await req.json();

    log('INFO', '📝 Logging to database', {
      call_id,
      level,
      component,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      hasMetadata: !!metadata
    });

    // Store log in database
    const { data: logEntry, error } = await supabase
      .from('system_logs')
      .insert([{
        call_id,
        level: level || 'INFO',
        component: component || 'unknown',
        message,
        metadata: metadata || {}
      }])
      .select()
      .single();

    if (error) {
      log('ERROR', '❌ Failed to store log in database', { error: error.message });
      throw error;
    }

    log('INFO', '✅ Log stored successfully', { logId: logEntry.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        log_id: logEntry.id,
        message: 'Log stored successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log('ERROR', '❌ Database logger error', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});