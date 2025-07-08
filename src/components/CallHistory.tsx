import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatabaseService } from '@/lib/database';
import { Phone, MessageSquare, AlertTriangle, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CallHistoryProps {
  refreshTrigger?: number;
}

const CallHistory: React.FC<CallHistoryProps> = ({ refreshTrigger }) => {
  const [calls, setCalls] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load call summary
      const callSummary = await DatabaseService.getCallSummary(20);
      setCalls(callSummary);

      // Load recent alerts
      const recentAlerts = await DatabaseService.getRecentAlerts(10);
      setAlerts(recentAlerts);

      // Load system logs
      const systemLogs = await DatabaseService.getSystemLogs({ limit: 50 });
      setLogs(systemLogs);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load call history and logs.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'busy':
      case 'no-answer':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in-progress':
      case 'ringing':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'busy':
      case 'no-answer':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
      case 'ringing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      case 'WARN':
        return 'bg-yellow-100 text-yellow-800';
      case 'INFO':
        return 'bg-blue-100 text-blue-800';
      case 'DEBUG':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Call History & System Logs
        </CardTitle>
        <CardDescription>
          Real-time monitoring of calls, alerts, and system activity
        </CardDescription>
        <Button onClick={loadData} variant="outline" size="sm">
          Refresh Data
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calls" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calls">
              Calls ({calls.length})
            </TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="logs">
              System Logs ({logs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calls" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {calls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No calls found. Start your first call above.
                </div>
              ) : (
                <div className="space-y-3">
                  {calls.map((call) => (
                    <div key={call.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(call.status)}
                          <span className="font-medium">{call.phone_number}</span>
                          <Badge className={getStatusColor(call.status)}>
                            {call.status}
                          </Badge>
                          {call.duration > 0 && (
                            <Badge variant="outline">
                              {formatDuration(call.duration)}
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(call.started_at).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Call SID:</span>
                          <br />
                          <span className="text-muted-foreground font-mono text-xs">
                            {call.call_sid}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Transcripts:</span>
                          <br />
                          <span className="text-muted-foreground">
                            {call.transcript_count || 0}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Keywords:</span>
                          <br />
                          <span className="text-muted-foreground">
                            {call.keyword_detection_count || 0}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">SMS Alerts:</span>
                          <br />
                          <span className="text-muted-foreground">
                            {call.sms_alert_count || 0}
                          </span>
                        </div>
                      </div>

                      {call.all_keywords_detected && call.all_keywords_detected.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Keywords Detected:</span>
                          <div className="flex gap-1 mt-1">
                            {call.all_keywords_detected.map((keyword: string, index: number) => (
                              <Badge key={index} variant="destructive" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No alerts found. Alerts will appear when trigger words are detected.
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-4 border rounded-lg space-y-2 border-red-200 bg-red-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="font-medium">Emergency Alert</span>
                          <Badge variant="destructive">
                            {alert.keywords?.join(', ') || 'Unknown'}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm font-medium">Phone:</span>
                          <span className="ml-2 text-sm">{alert.phone_number}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium">Transcript:</span>
                          <p className="text-sm text-muted-foreground mt-1 bg-white p-2 rounded border">
                            "{alert.context_transcript}"
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-sm font-medium">Alert Status:</span>
                            <Badge 
                              className={`ml-2 ${alert.alert_sent ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                            >
                              {alert.alert_sent ? 'Sent' : 'Failed'}
                            </Badge>
                          </div>
                          {alert.sms_recipient && (
                            <div>
                              <span className="text-sm font-medium">SMS to:</span>
                              <span className="ml-2 text-sm font-mono">{alert.sms_recipient}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <ScrollArea className="h-[400px]">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No system logs found.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 border rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge className={getLogLevelColor(log.level)}>
                            {log.level}
                          </Badge>
                          <span className="font-medium">{log.component}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{log.message}</p>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-blue-600">
                            View metadata
                          </summary>
                          <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CallHistory;