export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      evm_attendance_records: {
        Row: {
          checked_in_at: string
          created_at: string
          event_id: string
          id: string
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          created_at?: string
          event_id: string
          id?: string
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          created_at?: string
          event_id?: string
          id?: string
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_attendance_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "evm_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "evm_attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_attendance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "evm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_attendance_sessions: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          event_id: string
          id: string
          qr_code_data: string | null
          qr_code_generated_at: string | null
          session_code: string
          started_at: string | null
          status: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          event_id: string
          id?: string
          qr_code_data?: string | null
          qr_code_generated_at?: string | null
          session_code: string
          started_at?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          event_id?: string
          id?: string
          qr_code_data?: string | null
          qr_code_generated_at?: string | null
          session_code?: string
          started_at?: string | null
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evm_attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "evm_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_attendance_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "evm_events"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_event_agenda: {
        Row: {
          created_at: string
          event_id: string
          id: string
          speaker_name: string | null
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          speaker_name?: string | null
          start_time?: string
          title: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          speaker_name?: string | null
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_event_agenda_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "evm_events"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_events: {
        Row: {
          average_rating: number
          banner_url: string | null
          created_at: string
          description: string | null
          end_time: string
          event_type: string
          id: string
          location_city: string | null
          max_participants: number | null
          organizer_id: string
          poster_url: string | null
          published_at: string | null
          registration_fee: number
          start_time: string
          status: string
          tagline: string | null
          title: string
          total_registrations: number
          venue: string
        }
        Insert: {
          average_rating?: number
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string
          id?: string
          location_city?: string | null
          max_participants?: number | null
          organizer_id: string
          poster_url?: string | null
          published_at?: string | null
          registration_fee?: number
          start_time?: string
          status?: string
          tagline?: string | null
          title: string
          total_registrations?: number
          venue?: string
        }
        Update: {
          average_rating?: number
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string
          id?: string
          location_city?: string | null
          max_participants?: number | null
          organizer_id?: string
          poster_url?: string | null
          published_at?: string | null
          registration_fee?: number
          start_time?: string
          status?: string
          tagline?: string | null
          title?: string
          total_registrations?: number
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "evm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "evm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_registrations: {
        Row: {
          checked_in: boolean
          created_at: string
          event_id: string
          id: string
          qr_code: string
          status: string
          user_id: string
        }
        Insert: {
          checked_in?: boolean
          created_at?: string
          event_id: string
          id?: string
          qr_code?: string
          status?: string
          user_id: string
        }
        Update: {
          checked_in?: boolean
          created_at?: string
          event_id?: string
          id?: string
          qr_code?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "evm_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "evm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_reviews: {
        Row: {
          comment: string | null
          created_at: string
          event_id: string
          id: string
          is_hidden: boolean
          organizer_rating: number
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          event_id: string
          id?: string
          is_hidden?: boolean
          organizer_rating?: number
          rating?: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          event_id?: string
          id?: string
          is_hidden?: boolean
          organizer_rating?: number
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evm_reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "evm_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evm_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "evm_users"
            referencedColumns: ["id"]
          },
        ]
      }
      evm_users: {
        Row: {
          avatar_url: string | null
          college_name: string | null
          created_at: string
          department: string | null
          email: string | null
          id: string
          interests: string[]
          name: string | null
          onboarding_complete: boolean
          role: string
          roll_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          college_name?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id: string
          interests?: string[]
          name?: string | null
          onboarding_complete?: boolean
          role?: string
          roll_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          college_name?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          interests?: string[]
          name?: string | null
          onboarding_complete?: boolean
          role?: string
          roll_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
