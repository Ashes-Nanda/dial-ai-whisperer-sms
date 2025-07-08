import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseConnectionTest } from '@/lib/supabase-connection-test';
import { Database, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

const SupabaseConnectionStatus: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [tableStatus, setTableStatus] = useState<any>(null);
  const [functionStatus, setFunctionStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const testConnection = async () => {
    setIsLoading(true);
    try {
      // Test basic connection
      const connResult = await SupabaseConnectionTest.testConnection();
      setConnectionStatus(connResult);

      // Test database tables
      const tableResult = await SupabaseConnectionTest.testDatabaseTables();
      setTableStatus(tableResult);

      // Test edge functions
      const funcResult = await SupabaseConnectionTest.testEdgeFunctions();
      setFunctionStatus(funcResult);

      if (connResult.success) {
        toast({
          title: "✅ Supabase Connected",
          description: "Successfully connected to your Supabase project!",
        });
      } else {
        toast({
          title: "❌ Connection Failed",
          description: connResult.error || "Failed to connect to Supabase",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to test Supabase connection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge className={success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
        {success ? 'Connected' : 'Failed'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Supabase Connection Status
        </CardTitle>
        <CardDescription>
          Monitor your connection to the Supabase project and database
        </CardDescription>
        <Button 
          onClick={testConnection} 
          disabled={isLoading}
          variant="outline" 
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Test Connection
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Connection */}
        {connectionStatus && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(connectionStatus.success)}
                <span className="font-medium">Database Connection</span>
              </div>
              {getStatusBadge(connectionStatus.success)}
            </div>
            {!connectionStatus.success && connectionStatus.error && (
              <p className="text-sm text-red-600 ml-6">{connectionStatus.error}</p>
            )}
          </div>
        )}

        {/* Database Tables */}
        {tableStatus && (
          <div className="space-y-3">
            <h4 className="font-medium">Database Tables</h4>
            {Object.entries(tableStatus.tables || {}).map(([table, status]: [string, any]) => (
              <div key={table} className="flex items-center justify-between ml-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.accessible)}
                  <span className="text-sm">{table}</span>
                  {status.hasData && (
                    <Badge variant="outline" className="text-xs">
                      Has Data
                    </Badge>
                  )}
                </div>
                {getStatusBadge(status.accessible)}
              </div>
            ))}
          </div>
        )}

        {/* Edge Functions */}
        {functionStatus && (
          <div className="space-y-3">
            <h4 className="font-medium">Edge Functions</h4>
            {Object.entries(functionStatus.functions || {}).map(([func, status]: [string, any]) => (
              <div key={func} className="flex items-center justify-between ml-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.accessible)}
                  <span className="text-sm">{func}</span>
                </div>
                {getStatusBadge(status.accessible)}
              </div>
            ))}
          </div>
        )}

        {/* Project Info */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-medium">Project Information</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>URL:</strong> https://htegorovrqorrfydgadn.supabase.co</p>
            <p><strong>Project ID:</strong> htegorovrqorrfydgadn</p>
            <p><strong>Environment:</strong> Production</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-medium">Quick Actions</h4>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://supabase.com/dashboard/project/htegorovrqorrfydgadn', '_blank')}
            >
              Open Dashboard
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://supabase.com/dashboard/project/htegorovrqorrfydgadn/logs/edge-functions', '_blank')}
            >
              View Logs
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SupabaseConnectionStatus;