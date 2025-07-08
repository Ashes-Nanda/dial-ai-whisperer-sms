import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ELEVEN LABS AGENT CONFIGURATION ===');

    const elevenLabsApiKey = Deno.env.get("ELEVEN_LABS_API");
    const agentId = "agent_01jyy3hts1fpsszcfrdgcfv2vn";
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!elevenLabsApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Eleven Labs API key' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Webhook URL for Eleven Labs to call
    const webhookUrl = `${supabaseUrl}/functions/v1/eleven-labs-webhook`;

    console.log('🔧 Configuring agent with webhook URL:', webhookUrl);

    // Get current agent configuration
    const getAgentUrl = `https://api.elevenlabs.io/v1/convai/agents/${agentId}`;
    
    const getResponse = await fetch(getAgentUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('❌ Failed to get agent configuration:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get agent configuration',
          details: errorText 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const currentConfig = await getResponse.json();
    console.log('📋 Current agent configuration:', JSON.stringify(currentConfig, null, 2));

    // Update agent configuration with webhook
    const updateConfig = {
      ...currentConfig,
      webhook_url: webhookUrl,
      webhook_events: [
        'conversation_started',
        'user_message',
        'agent_response', 
        'conversation_ended',
        'transcript'
      ]
    };

    console.log('🔄 Updating agent with new configuration...');

    const updateResponse = await fetch(getAgentUrl, {
      method: 'PATCH',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateConfig),
    });

    const updateResponseText = await updateResponse.text();

    if (updateResponse.ok) {
      const updatedConfig = JSON.parse(updateResponseText);
      console.log('✅ Agent configuration updated successfully!');
      console.log('📋 Updated configuration:', JSON.stringify(updatedConfig, null, 2));

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Agent configured with webhook successfully',
          webhook_url: webhookUrl,
          agent_id: agentId,
          webhook_events: updateConfig.webhook_events,
          configuration: updatedConfig
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Failed to update agent configuration:', updateResponseText);
      
      // Try to parse error details
      let errorDetails;
      try {
        errorDetails = JSON.parse(updateResponseText);
      } catch {
        errorDetails = { raw_response: updateResponseText };
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update agent configuration',
          details: errorDetails,
          webhook_url: webhookUrl,
          agent_id: agentId
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ Error configuring Eleven Labs agent:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});