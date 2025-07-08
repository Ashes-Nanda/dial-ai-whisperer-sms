/*
  # Call Monitoring Database Schema

  1. New Tables
    - `calls`
      - `id` (uuid, primary key)
      - `call_sid` (text, unique, Twilio call identifier)
      - `phone_number` (text, caller's phone number)
      - `emergency_contact` (text, emergency contact number)
      - `status` (text, call status: initiated, ringing, answered, completed, failed, etc.)
      - `direction` (text, inbound/outbound)
      - `duration` (integer, call duration in seconds)
      - `answered_by` (text, human/machine detection)
      - `started_at` (timestamptz, call start time)
      - `ended_at` (timestamptz, call end time)
      - `created_at` (timestamptz, record creation time)
      - `updated_at` (timestamptz, last update time)

    - `transcripts`
      - `id` (uuid, primary key)
      - `call_id` (uuid, foreign key to calls)
      - `transcript_type` (text, partial/final)
      - `text` (text, transcript content)
      - `confidence` (decimal, confidence score 0-1)
      - `audio_start` (integer, start time in milliseconds)
      - `audio_end` (integer, end time in milliseconds)
      - `speaker` (text, caller/system)
      - `created_at` (timestamptz)

    - `keyword_detections`
      - `id` (uuid, primary key)
      - `call_id` (uuid, foreign key to calls)
      - `transcript_id` (uuid, foreign key to transcripts)
      - `keywords` (text[], array of detected keywords)
      - `context_transcript` (text, full transcript context)
      - `confidence` (decimal, detection confidence)
      - `alert_sent` (boolean, whether SMS was sent)
      - `alert_status` (text, success/failed/pending)
      - `created_at` (timestamptz)

    - `sms_alerts`
      - `id` (uuid, primary key)
      - `call_id` (uuid, foreign key to calls)
      - `keyword_detection_id` (uuid, foreign key to keyword_detections)
      - `recipient` (text, SMS recipient number)
      - `message` (text, SMS content)
      - `twilio_message_sid` (text, Twilio message identifier)
      - `status` (text, sent/delivered/failed/undelivered)
      - `error_message` (text, error details if failed)
      - `sent_at` (timestamptz)
      - `delivered_at` (timestamptz)
      - `created_at` (timestamptz)

    - `system_logs`
      - `id` (uuid, primary key)
      - `call_id` (uuid, foreign key to calls, nullable)
      - `level` (text, INFO/WARN/ERROR/DEBUG)
      - `component` (text, audio-stream/webhook/speech-processing)
      - `message` (text, log message)
      - `metadata` (jsonb, additional log data)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Add indexes for performance

  3. Functions
    - Auto-update timestamps
    - Call status tracking
    - Alert aggregation views
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Calls table - main call records
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  phone_number text NOT NULL,
  emergency_contact text DEFAULT '+919178379226',
  status text NOT NULL DEFAULT 'initiated',
  direction text DEFAULT 'outbound',
  duration integer DEFAULT 0,
  answered_by text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transcripts table - all speech-to-text results
CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  transcript_type text NOT NULL DEFAULT 'final',
  text text NOT NULL,
  confidence decimal(4,3) DEFAULT 0.0,
  audio_start integer DEFAULT 0,
  audio_end integer DEFAULT 0,
  speaker text DEFAULT 'caller',
  created_at timestamptz DEFAULT now()
);

-- Keyword detections table - trigger word alerts
CREATE TABLE IF NOT EXISTS keyword_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  transcript_id uuid REFERENCES transcripts(id) ON DELETE SET NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  context_transcript text NOT NULL,
  confidence decimal(4,3) DEFAULT 1.0,
  alert_sent boolean DEFAULT false,
  alert_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- SMS alerts table - emergency notifications
CREATE TABLE IF NOT EXISTS sms_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  keyword_detection_id uuid REFERENCES keyword_detections(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  twilio_message_sid text,
  status text DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- System logs table - comprehensive logging
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'INFO',
  component text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all operations for now - can be restricted later)
CREATE POLICY "Allow all operations on calls"
  ON calls
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on transcripts"
  ON transcripts
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on keyword_detections"
  ON keyword_detections
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on sms_alerts"
  ON sms_alerts
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on system_logs"
  ON system_logs
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_type ON transcripts(transcript_type);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_keyword_detections_call_id ON keyword_detections(call_id);
CREATE INDEX IF NOT EXISTS idx_keyword_detections_alert_sent ON keyword_detections(alert_sent);
CREATE INDEX IF NOT EXISTS idx_keyword_detections_created_at ON keyword_detections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_alerts_call_id ON sms_alerts(call_id);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_status ON sms_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_recipient ON sms_alerts(recipient);
CREATE INDEX IF NOT EXISTS idx_sms_alerts_created_at ON sms_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_logs_call_id ON system_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on calls table
DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Views for analytics and reporting
CREATE OR REPLACE VIEW call_summary AS
SELECT 
  c.id,
  c.call_sid,
  c.phone_number,
  c.status,
  c.duration,
  c.started_at,
  c.ended_at,
  COUNT(t.id) as transcript_count,
  COUNT(kd.id) as keyword_detection_count,
  COUNT(sa.id) as sms_alert_count,
  ARRAY_AGG(DISTINCT unnest(kd.keywords)) FILTER (WHERE kd.keywords IS NOT NULL) as all_keywords_detected
FROM calls c
LEFT JOIN transcripts t ON c.id = t.call_id
LEFT JOIN keyword_detections kd ON c.id = kd.call_id
LEFT JOIN sms_alerts sa ON c.id = sa.call_id
GROUP BY c.id, c.call_sid, c.phone_number, c.status, c.duration, c.started_at, c.ended_at;

-- View for recent alerts
CREATE OR REPLACE VIEW recent_alerts AS
SELECT 
  kd.id,
  kd.call_id,
  c.call_sid,
  c.phone_number,
  kd.keywords,
  kd.context_transcript,
  kd.alert_sent,
  kd.alert_status,
  kd.created_at,
  sa.recipient as sms_recipient,
  sa.status as sms_status,
  sa.sent_at as sms_sent_at
FROM keyword_detections kd
JOIN calls c ON kd.call_id = c.id
LEFT JOIN sms_alerts sa ON kd.id = sa.keyword_detection_id
ORDER BY kd.created_at DESC;

-- View for system health monitoring
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  level,
  component,
  COUNT(*) as log_count
FROM system_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), level, component
ORDER BY hour DESC, level, component;