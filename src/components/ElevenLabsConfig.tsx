import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Webhook, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const ElevenLabsConfig: React.FC = () => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configResult, setConfigResult] = useState<any>(null);
  const { toast } = useToast();

  const configureAgent = async () => {
    try {
      setIsConfiguring(true);
      setConfigResult(null);

      const { data, error } = await supabase.functions.invoke('eleven-labs-config');

      if (error) throw error;

      setConfigResult(data);

      if (data.success) {
        toast({
          title: "✅ Agent Configured Successfully!",
          description: "Eleven Labs agent is now configured with webhook for real-time speech processing.",
        });
      } else {
        toast({
          title: "❌ Configuration Failed",
          description: data.error || "Failed to configure agent",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error configuring agent:', error);
      toast({
        title: "Configuration Error",
        description: "Failed to configure Eleven Labs agent.",
        variant: "destructive",
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Eleven Labs Agent Configuration
        </CardTitle>
        <CardDescription>
          Configure the Eleven Labs agent to send webhooks for real-time speech processing and keyword detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Required Configuration</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Webhook URL: /functions/v1/eleven-labs-webhook</li>
            <li>• Events: conversation_started, user_message, agent_response, conversation_ended</li>
            <li>• Real-time transcript processing</li>
            <li>• Keyword detection and SMS alerts</li>
          </ul>
        </div>

        <Button 
          onClick={configureAgent}
          disabled={isConfiguring}
          className="w-full"
          variant="default"
        >
          {isConfiguring ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Configuring Agent...
            </>
          ) : (
            <>
              <Webhook className="mr-2 h-4 w-4" />
              Configure Agent Webhook
            </>
          )}
        </Button>

        {configResult && (
          <div className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              {configResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className="font-medium">
                {configResult.success ? 'Configuration Successful' : 'Configuration Failed'}
              </span>
            </div>

            {configResult.success && (
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Webhook URL:</span>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {configResult.webhook_url}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium">Agent ID:</span>
                  <p className="text-xs text-muted-foreground font-mono">
                    {configResult.agent_id}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium">Webhook Events:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {configResult.webhook_events?.map((event: string) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!configResult.success && configResult.error && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">{configResult.error}</p>
                {configResult.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600">
                      View error details
                    </summary>
                    <pre className="mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(configResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Note:</strong> This configuration enables:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Real-time speech-to-text processing</li>
            <li>Automatic keyword detection for emergency words</li>
            <li>Instant SMS alerts when trigger words are detected</li>
            <li>Complete conversation logging in the database</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ElevenLabsConfig;