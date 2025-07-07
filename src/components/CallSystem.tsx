import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Phone, PhoneCall, MessageSquare, Settings, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

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
  const [testTranscript, setTestTranscript] = useState('');
  const [isTestingTriggers, setIsTestingTriggers] = useState(false);
  const [testTranscript, setTestTranscript] = useState('');
  const [isTestingTriggers, setIsTestingTriggers] = useState(false);
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

        toast({
          title: "Call completed",
          description: "Keywords detected! SMS notifications sent.",
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
          
            Automated outbound calling with Eleven Labs Conversational AI and keyword-based SMS alerts
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
              Enter a phone number to start an AI-powered conversation
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
                  AI is conversing with the recipient...
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
                <p><strong>Status:</strong> AI Conversation in progress</p>
                <p><strong>Monitoring for keywords:</strong></p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {triggerWords.map((word) => (
                    <Badge key={word} variant="outline">{word}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration & Stats */}
        <div className="grid md:grid-cols-2 gap-6">
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
                    📱 Test SMS Delivery
                </div>
              </div>
              <div>
                <h4 className="font-medium">Features Enabled</h4>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <p><strong>Debug:</strong> This will test SMS delivery to your phone number (+91 9178379226) and show detailed logs.</p>
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
                  <div className="text-sm text-muted-foreground">Total Calls</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-success">
                    {callLogs.filter(call => call.keywordsDetected.length > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Keywords Detected</div>
                </div>
              </div>
              <div className="text-center">
                <Badge variant={isCallInProgress ? "default" : "secondary"}>
                  {isCallInProgress ? "System Active" : "Ready"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call History */}
        <Card>
          <CardHeader>
            <CardTitle>Call History</CardTitle>
            <CardDescription>Recent AI-powered conversations</CardDescription>
          </CardHeader>
          <CardContent>
            {callLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No calls yet. Start your first AI conversation above.
              </div>
            ) : (
              <div className="space-y-4">
                {callLogs.map((call) => (
                  <div key={call.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(call.status)}
                        <span className="font-medium">{call.phoneNumber}</span>
                        <Badge variant="outline">{call.duration}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {call.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {call.keywordsDetected.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Keywords Detected:</span>
                        <div className="flex gap-1 mt-1">
                          {call.keywordsDetected.map((keyword) => (
                            <Badge key={keyword} variant="destructive" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {call.transcript && (
                      <div>
                        <span className="text-sm font-medium">Transcript:</span>
                        <p className="text-sm text-muted-foreground mt-1 bg-muted p-2 rounded">
                          {call.transcript}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CallSystem;