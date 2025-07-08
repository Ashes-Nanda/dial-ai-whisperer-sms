import { supabase } from '@/integrations/supabase/client';

// Database types
export interface Call {
  id: string;
  call_sid: string;
  phone_number: string;
  emergency_contact: string;
  status: string;
  direction: string;
  duration: number;
  answered_by?: string;
  started_at: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  call_id: string;
  transcript_type: string;
  text: string;
  confidence: number;
  audio_start: number;
  audio_end: number;
  speaker: string;
  created_at: string;
}

export interface KeywordDetection {
  id: string;
  call_id: string;
  transcript_id?: string;
  keywords: string[];
  context_transcript: string;
  confidence: number;
  alert_sent: boolean;
  alert_status: string;
  created_at: string;
}

export interface SmsAlert {
  id: string;
  call_id: string;
  keyword_detection_id?: string;
  recipient: string;
  message: string;
  twilio_message_sid?: string;
  status: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
}

export interface SystemLog {
  id: string;
  call_id?: string;
  level: string;
  component: string;
  message: string;
  metadata: any;
  created_at: string;
}

// Database operations
export class DatabaseService {
  // Call operations
  static async createCall(data: {
    call_sid: string;
    phone_number: string;
    emergency_contact?: string;
    status?: string;
    direction?: string;
  }): Promise<Call | null> {
    try {
      const { data: call, error } = await supabase
        .from('calls')
        .insert([{
          call_sid: data.call_sid,
          phone_number: data.phone_number,
          emergency_contact: data.emergency_contact || '+919178379226',
          status: data.status || 'initiated',
          direction: data.direction || 'outbound'
        }])
        .select()
        .single();

      if (error) throw error;
      return call;
    } catch (error) {
      console.error('Error creating call:', error);
      return null;
    }
  }

  static async updateCall(callSid: string, updates: Partial<Call>): Promise<Call | null> {
    try {
      const { data: call, error } = await supabase
        .from('calls')
        .update(updates)
        .eq('call_sid', callSid)
        .select()
        .single();

      if (error) throw error;
      return call;
    } catch (error) {
      console.error('Error updating call:', error);
      return null;
    }
  }

  static async getCall(callSid: string): Promise<Call | null> {
    try {
      const { data: call, error } = await supabase
        .from('calls')
        .select('*')
        .eq('call_sid', callSid)
        .single();

      if (error) throw error;
      return call;
    } catch (error) {
      console.error('Error getting call:', error);
      return null;
    }
  }

  static async getRecentCalls(limit: number = 50): Promise<Call[]> {
    try {
      const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return calls || [];
    } catch (error) {
      console.error('Error getting recent calls:', error);
      return [];
    }
  }

  // Transcript operations
  static async createTranscript(data: {
    call_id: string;
    transcript_type: string;
    text: string;
    confidence?: number;
    audio_start?: number;
    audio_end?: number;
    speaker?: string;
  }): Promise<Transcript | null> {
    try {
      const { data: transcript, error } = await supabase
        .from('transcripts')
        .insert([{
          call_id: data.call_id,
          transcript_type: data.transcript_type,
          text: data.text,
          confidence: data.confidence || 0,
          audio_start: data.audio_start || 0,
          audio_end: data.audio_end || 0,
          speaker: data.speaker || 'caller'
        }])
        .select()
        .single();

      if (error) throw error;
      return transcript;
    } catch (error) {
      console.error('Error creating transcript:', error);
      return null;
    }
  }

  static async getCallTranscripts(callId: string): Promise<Transcript[]> {
    try {
      const { data: transcripts, error } = await supabase
        .from('transcripts')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return transcripts || [];
    } catch (error) {
      console.error('Error getting call transcripts:', error);
      return [];
    }
  }

  // Keyword detection operations
  static async createKeywordDetection(data: {
    call_id: string;
    transcript_id?: string;
    keywords: string[];
    context_transcript: string;
    confidence?: number;
    alert_sent?: boolean;
    alert_status?: string;
  }): Promise<KeywordDetection | null> {
    try {
      const { data: detection, error } = await supabase
        .from('keyword_detections')
        .insert([{
          call_id: data.call_id,
          transcript_id: data.transcript_id,
          keywords: data.keywords,
          context_transcript: data.context_transcript,
          confidence: data.confidence || 1.0,
          alert_sent: data.alert_sent || false,
          alert_status: data.alert_status || 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      return detection;
    } catch (error) {
      console.error('Error creating keyword detection:', error);
      return null;
    }
  }

  static async updateKeywordDetection(id: string, updates: Partial<KeywordDetection>): Promise<KeywordDetection | null> {
    try {
      const { data: detection, error } = await supabase
        .from('keyword_detections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return detection;
    } catch (error) {
      console.error('Error updating keyword detection:', error);
      return null;
    }
  }

  static async getRecentAlerts(limit: number = 20): Promise<any[]> {
    try {
      const { data: alerts, error } = await supabase
        .from('recent_alerts')
        .select('*')
        .limit(limit);

      if (error) throw error;
      return alerts || [];
    } catch (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }
  }

  // SMS alert operations
  static async createSmsAlert(data: {
    call_id: string;
    keyword_detection_id?: string;
    recipient: string;
    message: string;
    twilio_message_sid?: string;
    status?: string;
  }): Promise<SmsAlert | null> {
    try {
      const { data: alert, error } = await supabase
        .from('sms_alerts')
        .insert([{
          call_id: data.call_id,
          keyword_detection_id: data.keyword_detection_id,
          recipient: data.recipient,
          message: data.message,
          twilio_message_sid: data.twilio_message_sid,
          status: data.status || 'pending',
          sent_at: data.twilio_message_sid ? new Date().toISOString() : null
        }])
        .select()
        .single();

      if (error) throw error;
      return alert;
    } catch (error) {
      console.error('Error creating SMS alert:', error);
      return null;
    }
  }

  static async updateSmsAlert(id: string, updates: Partial<SmsAlert>): Promise<SmsAlert | null> {
    try {
      const { data: alert, error } = await supabase
        .from('sms_alerts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return alert;
    } catch (error) {
      console.error('Error updating SMS alert:', error);
      return null;
    }
  }

  // System logging
  static async createSystemLog(data: {
    call_id?: string;
    level: string;
    component: string;
    message: string;
    metadata?: any;
  }): Promise<SystemLog | null> {
    try {
      const { data: log, error } = await supabase
        .from('system_logs')
        .insert([{
          call_id: data.call_id,
          level: data.level,
          component: data.component,
          message: data.message,
          metadata: data.metadata || {}
        }])
        .select()
        .single();

      if (error) throw error;
      return log;
    } catch (error) {
      console.error('Error creating system log:', error);
      return null;
    }
  }

  static async getSystemLogs(filters?: {
    level?: string;
    component?: string;
    call_id?: string;
    limit?: number;
  }): Promise<SystemLog[]> {
    try {
      let query = supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.level) {
        query = query.eq('level', filters.level);
      }
      if (filters?.component) {
        query = query.eq('component', filters.component);
      }
      if (filters?.call_id) {
        query = query.eq('call_id', filters.call_id);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data: logs, error } = await query;

      if (error) throw error;
      return logs || [];
    } catch (error) {
      console.error('Error getting system logs:', error);
      return [];
    }
  }

  // Analytics and reporting
  static async getCallSummary(limit: number = 50): Promise<any[]> {
    try {
      const { data: summary, error } = await supabase
        .from('call_summary')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return summary || [];
    } catch (error) {
      console.error('Error getting call summary:', error);
      return [];
    }
  }

  static async getSystemHealthSummary(): Promise<any[]> {
    try {
      const { data: health, error } = await supabase
        .from('system_health_summary')
        .select('*');

      if (error) throw error;
      return health || [];
    } catch (error) {
      console.error('Error getting system health summary:', error);
      return [];
    }
  }
}