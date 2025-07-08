export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      calls: {
        Row: {
          answered_by: string | null
          call_sid: string
          created_at: string | null
          direction: string | null
          duration: number | null
          emergency_contact: string | null
          ended_at: string | null
          id: string
          phone_number: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          answered_by?: string | null
          call_sid: string
          created_at?: string | null
          direction?: string | null
          duration?: number | null
          emergency_contact?: string | null
          ended_at?: string | null
          id?: string
          phone_number: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          answered_by?: string | null
          call_sid?: string
          created_at?: string | null
          direction?: string | null
          duration?: number | null
          emergency_contact?: string | null
          ended_at?: string | null
          id?: string
          phone_number?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      keyword_detections: {
        Row: {
          alert_sent: boolean | null
          alert_status: string | null
          call_id: string
          confidence: number | null
          context_transcript: string
          created_at: string | null
          id: string
          keywords: string[]
          transcript_id: string | null
        }
        Insert: {
          alert_sent?: boolean | null
          alert_status?: string | null
          call_id: string
          confidence?: number | null
          context_transcript: string
          created_at?: string | null
          id?: string
          keywords?: string[]
          transcript_id?: string | null
        }
        Update: {
          alert_sent?: boolean | null
          alert_status?: string | null
          call_id?: string
          confidence?: number | null
          context_transcript?: string
          created_at?: string | null
          id?: string
          keywords?: string[]
          transcript_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_detections_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_detections_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_detections_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_alerts: {
        Row: {
          call_id: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          keyword_detection_id: string | null
          message: string
          recipient: string
          sent_at: string | null
          status: string | null
          twilio_message_sid: string | null
        }
        Insert: {
          call_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          keyword_detection_id?: string | null
          message: string
          recipient: string
          sent_at?: string | null
          status?: string | null
          twilio_message_sid?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          keyword_detection_id?: string | null
          message?: string
          recipient?: string
          sent_at?: string | null
          status?: string | null
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_alerts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_alerts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_alerts_keyword_detection_id_fkey"
            columns: ["keyword_detection_id"]
            isOneToOne: false
            referencedRelation: "keyword_detections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_alerts_keyword_detection_id_fkey"
            columns: ["keyword_detection_id"]
            isOneToOne: false
            referencedRelation: "recent_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          call_id: string | null
          component: string
          created_at: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          call_id?: string | null
          component: string
          created_at?: string | null
          id?: string
          level?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          call_id?: string | null
          component?: string
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          audio_end: number | null
          audio_start: number | null
          call_id: string
          confidence: number | null
          created_at: string | null
          id: string
          speaker: string | null
          text: string
          transcript_type: string
        }
        Insert: {
          audio_end?: number | null
          audio_start?: number | null
          call_id: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          speaker?: string | null
          text: string
          transcript_type?: string
        }
        Update: {
          audio_end?: number | null
          audio_start?: number | null
          call_id?: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          speaker?: string | null
          text?: string
          transcript_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      call_summary: {
        Row: {
          all_keywords_detected: string[] | null
          call_sid: string | null
          duration: number | null
          ended_at: string | null
          id: string | null
          keyword_detection_count: number | null
          phone_number: string | null
          sms_alert_count: number | null
          started_at: string | null
          status: string | null
          transcript_count: number | null
        }
        Relationships: []
      }
      recent_alerts: {
        Row: {
          alert_sent: boolean | null
          alert_status: string | null
          call_id: string | null
          call_sid: string | null
          context_transcript: string | null
          created_at: string | null
          id: string | null
          keywords: string[] | null
          phone_number: string | null
          sms_recipient: string | null
          sms_sent_at: string | null
          sms_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_detections_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_detections_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_summary: {
        Row: {
          component: string | null
          hour: string | null
          level: string | null
          log_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
