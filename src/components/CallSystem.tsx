import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Phone, PhoneCall, MessageSquare, Settings, Loader2, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import CallHistory from './CallHistory';
import ElevenLabsConfig from './ElevenLabsConfig';
import SupabaseConnectionStatus from './SupabaseConnectionStatus';

interface CallLog {
  id: string;
  phoneNumber: string;
  status: 'completed' | 'in-progress' | 'failed';
  duration: string;
  keywordsDetected: string[];
  transcript: string;
  timestamp: Date;
}

const CallSystem = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('+919178379226');
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callProgress, setCallProgress] = useState(0);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [currentCall, setCurrentCall] = useState<CallLog | null>(null);
  const [testTranscript, setTestTranscript] = useState('');
  const [isTestingTriggers, setIsTestingTriggers] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();

  const triggerWords = ['help', 'emergency', 'support', 'urgent', 'problem', 'assistance'];

  const testTriggerWords = async () => {
    if (!testTranscript.trim()) {
      toast({
        title: "Test transcript required",
        description: "Please enter some text to test trigger word detection.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingTriggers(true);

    try {
      const { data, error } = await supabase.functions.invoke('test-trigger-detection', {
        body: { 
          transcript: testTranscript,
          emergencyContact: emergencyContactNumber 
        }
      });

      if (error) throw error;

      toast({
        title: data.alert_sent ? "🚨 Trigger Words Detected!" : "✅ No Trigger Words",
        description: data.alert_sent 
          ? `Keywords found: ${data.keywords_detected.join(', ')}. Emergency SMS sent!`
          : "No trigger words detected in the test transcript.",
        variant: data.alert_sent ? "destructive" : "default",
      });

    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Test failed",
        description: "Failed to test trigger word detection.",
        variant: "destructive",
      });
    } finally {
      setIsTestingTriggers(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter a valid phone number to initiate the call.",
        variant: "destructive",
      });
      return;
    }

    setIsCallInProgress(true);
    setCallProgress(0);

    const newCall: CallLog = {
      id: `call-${Date.now()}`,
      phoneNumber,
      status: 'in-progress',
      duration: '00:00',
      keywordsDetected: [],
      transcript: '',
      timestamp: new Date(),
    };

    setCurrentCall(newCall);

    try {
      // Call the Supabase edge function to initiate the call
      const { data, error } = await supabase.functions.invoke('initiate-call', {
        body: { phoneNumber, emergencyContactNumber }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Call initiated",
        description: `Connecting to ${phoneNumber} with AI system...`,
      });

      // Simulate progress tracking
      const progressInterval = setInterval(() => {
        setCallProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 500);

      // Simulate call completion after 5 seconds
      setTimeout(() => {
        const completedCall: CallLog = {
          ...newCall,
          status: 'completed',
          duration: '02:34',
          keywordsDetected: ['help', 'support'],
          transcript: "Hello, I need some help with my account. Can you provide support for my billing issue?",
        };

        setCallLogs(prev => [completedCall, ...prev]);
        setCurrentCall(null);
        setIsCallInProgress(false);
        setCallProgress(0);
        setPhoneNumber('');

        // Refresh the call history
        setRefreshTrigger(prev => prev + 1);

        toast({
          title: "Call completed",
          description: "Call completed successfully. Check the database for full details.",
          variant: "default",
        });
      }, 5000);

    } catch (error) {
      console.error('Call initiation failed:', error);
      setIsCallInProgress(false);
      setCurrentCall(null);
      setCallProgress(0);
      
      toast({
        title: "Call failed",
        description: "Failed to initiate the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'in-progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Phone className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              AI Call System
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            <div className="space-y-2">
              <Label htmlFor="emergency">Emergency Contact Number</Label>
              <Input
                id="emergency"
                type="tel"
                placeholder="+91 9178379226"
                value={emergencyContactNumber}
                onChange={(e) => setEmergencyContactNumber(e.target.value)}
                disabled={isCallInProgress}
              />
            </div>
            
            Automated outbound calling with real-time transcription and keyword-based SMS alerts
          </p>
        </div>

        {/* Call Initiation Card */}
        <Card className="shadow-elegant border-0 bg-gradient-to-r from-card to-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-primary" />
              Initiate Call
            </CardTitle>
            <CardDescription>
              Enter a phone number to start an AI-powered conversation with real-time monitoring
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isCallInProgress}
              />
            </div>
            
            <Button 
              variant="call" 
              size="lg" 
              onClick={handleInitiateCall}
              disabled={isCallInProgress}
              className="w-full"
            >
              {isCallInProgress ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Call in Progress...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Start AI Call
                </>
              )}
            </Button>

            {isCallInProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Call Progress</span>
                  <span>{callProgress}%</span>
                </div>
                <Progress value={callProgress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  AI is conversing with the recipient and monitoring for keywords...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Call Status */}
        {currentCall && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary-glow/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                Active Call
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Number:</strong> {currentCall.phoneNumber}</p>
                <p><strong>Status:</strong> AI Conversation in progress with real-time transcription</p>
                <p><strong>Monitoring for keywords:</strong></p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {triggerWords.map((word) => (
                    <Badge key={word} variant="outline">{word}</Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  All conversation data is being stored in the database for analysis.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration & Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Debug Testing Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🧪 Debug & Testing
              </CardTitle>
              <CardDescription>
                Test the trigger word detection system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testTranscript">Test Transcript</Label>
                <Input
                  id="testTranscript"
                  placeholder="Type a message with 'help' or 'emergency'..."
                  value={testTranscript}
                  onChange={(e) => setTestTranscript(e.target.value)}
                />
              </div>
              
              <Button 
                variant="warning" 
                onClick={testTriggerWords}
                disabled={isTestingTriggers}
                className="w-full"
              >
                {isTestingTriggers ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    🧪 Test Trigger Detection
                  </>
                )}
              </Button>
              
              <div className="text-xs text-muted-foreground">
                <p><strong>Tip:</strong> Try phrases like:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>"I need help with something"</li>
                  <li>"This is an emergency"</li>
                  <li>"Can you provide support?"</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Trigger Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {triggerWords.map((word) => (
                    <Badge key={word} variant="secondary">{word}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium">Features Enabled</h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• AssemblyAI Real-time STT</li>
                  <li>• Twilio Voice Streaming</li>
                  <li>• Keyword Detection</li>
                  <li>• Automatic SMS Alerts</li>
                  <li>• Database Logging</li>
                  <li>• Call Transcription Storage</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Database Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">Data Storage</h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Complete call records</li>
                  <li>• Real-time transcripts</li>
                  <li>• Keyword detections</li>
                  <li>• SMS alert tracking</li>
                  <li>• System logs</li>
                  <li>• Performance analytics</li>
                </ul>
              </div>
              <div className="text-center">
                <Badge variant="default">
                  Phase 2 Complete
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{callLogs.length}</div>
                  <div className="text-sm text-muted-foreground">UI Calls</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-success">
                    {callLogs.filter(call => call.keywordsDetected.length > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">UI Keywords</div>
                </div>
              </div>
              <div className="text-center">
                <Badge variant={isCallInProgress ? "default" : "secondary"}>
                  {isCallInProgress ? "System Active" : "Ready"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Real database stats shown in Call History tab
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call History Component */}
        <CallHistory refreshTrigger={refreshTrigger} />

        {/* Supabase Connection Status */}
        <SupabaseConnectionStatus />

        {/* Eleven Labs Configuration */}
        <ElevenLabsConfig />
      </div>
    </div>
  );
};

export default CallSystem;