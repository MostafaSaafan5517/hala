export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor: string;
          actor_user_id: string | null;
          business_id: string;
          changed_columns: string[];
          created_at: string;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string;
          table_name: string;
        };
        Insert: {
          action: string;
          actor: string;
          actor_user_id?: string | null;
          business_id: string;
          changed_columns?: string[];
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: string;
          actor?: string;
          actor_user_id?: string | null;
          business_id?: string;
          changed_columns?: string[];
          created_at?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          blocked_until: string;
          business_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          ends_at: string;
          id: string;
          notes: string | null;
          price: number;
          reference: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        };
        Insert: {
          blocked_until: string;
          business_id: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency: string;
          customer_id: string;
          ends_at: string;
          id?: string;
          notes?: string | null;
          price: number;
          reference?: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
        };
        Update: {
          blocked_until?: string;
          business_id?: string;
          cancelled_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          ends_at?: string;
          id?: string;
          notes?: string | null;
          price?: number;
          reference?: string;
          service_id?: string;
          staff_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
        };
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_customer_id_business_id_fkey";
            columns: ["customer_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "bookings_service_id_business_id_fkey";
            columns: ["service_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "bookings_staff_id_business_id_fkey";
            columns: ["staff_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      business_members: {
        Row: {
          business_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          booking_horizon_days: number;
          booking_notice_minutes: number;
          cancellation_notice_hours: number;
          created_at: string;
          default_language: Database["public"]["Enums"]["language"];
          id: string;
          name: string;
          slot_interval_minutes: number;
          slug: string;
          timezone: string;
          widget_enabled: boolean;
          widget_origins: string[];
        };
        Insert: {
          booking_horizon_days?: number;
          booking_notice_minutes?: number;
          cancellation_notice_hours?: number;
          created_at?: string;
          default_language?: Database["public"]["Enums"]["language"];
          id?: string;
          name: string;
          slot_interval_minutes?: number;
          slug: string;
          timezone: string;
          widget_enabled?: boolean;
          widget_origins?: string[];
        };
        Update: {
          booking_horizon_days?: number;
          booking_notice_minutes?: number;
          cancellation_notice_hours?: number;
          created_at?: string;
          default_language?: Database["public"]["Enums"]["language"];
          id?: string;
          name?: string;
          slot_interval_minutes?: number;
          slug?: string;
          timezone?: string;
          widget_enabled?: boolean;
          widget_origins?: string[];
        };
        Relationships: [];
      };
      closures: {
        Row: {
          business_id: string;
          created_at: string;
          ends_on: string;
          id: string;
          reason: string | null;
          starts_on: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          ends_on: string;
          id?: string;
          reason?: string | null;
          starts_on: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          ends_on?: string;
          id?: string;
          reason?: string | null;
          starts_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "closures_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_messages: {
        Row: {
          business_id: string;
          conversation_id: string;
          created_at: string;
          id: string;
          message: NonNullable<Json>;
          position: number;
          role: string;
          sent_by: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          conversation_id: string;
          created_at?: string;
          id: string;
          message: NonNullable<Json>;
          position: number;
          role: string;
          sent_by?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          message?: NonNullable<Json>;
          position?: number;
          role?: string;
          sent_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_business_id_fkey";
            columns: ["conversation_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "conversation_messages_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          business_id: string;
          channel: string;
          created_at: string;
          customer_id: string | null;
          id: string;
          started_by: string | null;
          status: Database["public"]["Enums"]["conversation_status"];
          taken_over_by: string | null;
          updated_at: string;
          verification_failures: number;
          visitor_hash: string | null;
          visitor_token_hash: string | null;
        };
        Insert: {
          business_id: string;
          channel: string;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["conversation_status"];
          taken_over_by?: string | null;
          updated_at?: string;
          verification_failures?: number;
          visitor_hash?: string | null;
          visitor_token_hash?: string | null;
        };
        Update: {
          business_id?: string;
          channel?: string;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["conversation_status"];
          taken_over_by?: string | null;
          updated_at?: string;
          verification_failures?: number;
          visitor_hash?: string | null;
          visitor_token_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_customer_id_business_id_fkey";
            columns: ["customer_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "conversations_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_taken_over_by_fkey";
            columns: ["taken_over_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          business_id: string;
          created_at: string;
          email: string | null;
          id: string;
          language: Database["public"]["Enums"]["language"];
          name: string;
          phone: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          language: Database["public"]["Enums"]["language"];
          name: string;
          phone: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["language"];
          name?: string;
          phone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          business_id: string;
          content: string;
          content_hash: string;
          document_id: string;
          embedding: string;
          embedding_model: string;
          id: string;
          position: number;
          words: string[] | null;
        };
        Insert: {
          business_id: string;
          content: string;
          content_hash: string;
          document_id: string;
          embedding: string;
          embedding_model: string;
          id?: string;
          position: number;
          words?: never;
        };
        Update: {
          business_id?: string;
          content?: string;
          content_hash?: string;
          document_id?: string;
          embedding?: string;
          embedding_model?: string;
          id?: string;
          position?: number;
          words?: never;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_business_id_fkey";
            columns: ["document_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_documents";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      knowledge_documents: {
        Row: {
          active: boolean;
          body: string;
          business_id: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["knowledge_kind"];
          language: Database["public"]["Enums"]["language"];
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          business_id: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["knowledge_kind"];
          language: Database["public"]["Enums"]["language"];
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          business_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["knowledge_kind"];
          language?: Database["public"]["Enums"]["language"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      member_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          business_id: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          business_id: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          business_id?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_invites_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_invites_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      model_calls: {
        Row: {
          business_id: string;
          conversation_id: string | null;
          cost_usd: number;
          created_at: string;
          error: string | null;
          id: number;
          input_tokens: number;
          latency_ms: number;
          model: string;
          output_tokens: number;
          purpose: string;
        };
        Insert: {
          business_id: string;
          conversation_id?: string | null;
          cost_usd: number;
          created_at?: string;
          error?: string | null;
          id?: never;
          input_tokens: number;
          latency_ms: number;
          model: string;
          output_tokens?: number;
          purpose: string;
        };
        Update: {
          business_id?: string;
          conversation_id?: string | null;
          cost_usd?: number;
          created_at?: string;
          error?: string | null;
          id?: never;
          input_tokens?: number;
          latency_ms?: number;
          model?: string;
          output_tokens?: number;
          purpose?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          buffer_minutes: number;
          business_id: string;
          created_at: string;
          currency: string;
          duration_minutes: number;
          id: string;
          name_ar: string | null;
          name_en: string | null;
          price: number;
        };
        Insert: {
          active?: boolean;
          buffer_minutes?: number;
          business_id: string;
          created_at?: string;
          currency: string;
          duration_minutes: number;
          id?: string;
          name_ar?: string | null;
          name_en?: string | null;
          price: number;
        };
        Update: {
          active?: boolean;
          buffer_minutes?: number;
          business_id?: string;
          created_at?: string;
          currency?: string;
          duration_minutes?: number;
          id?: string;
          name_ar?: string | null;
          name_en?: string | null;
          price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          active: boolean;
          business_id: string;
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          business_id: string;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          business_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_services: {
        Row: {
          business_id: string;
          service_id: string;
          staff_id: string;
        };
        Insert: {
          business_id: string;
          service_id: string;
          staff_id: string;
        };
        Update: {
          business_id?: string;
          service_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_business_id_fkey";
            columns: ["service_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id", "business_id"];
          },
          {
            foreignKeyName: "staff_services_staff_id_business_id_fkey";
            columns: ["staff_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      time_off: {
        Row: {
          business_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          staff_id: string;
          starts_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          staff_id: string;
          starts_at: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          staff_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "time_off_staff_id_business_id_fkey";
            columns: ["staff_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
      tool_calls: {
        Row: {
          approved: boolean;
          business_id: string;
          conversation_id: string;
          created_at: string;
          id: number;
          input: NonNullable<Json>;
          latency_ms: number;
          output: Json | null;
          status: string;
          tool_call_id: string;
          tool_name: string;
        };
        Insert: {
          approved?: boolean;
          business_id: string;
          conversation_id: string;
          created_at?: string;
          id?: never;
          input: NonNullable<Json>;
          latency_ms?: number;
          output?: Json | null;
          status: string;
          tool_call_id: string;
          tool_name: string;
        };
        Update: {
          approved?: boolean;
          business_id?: string;
          conversation_id?: string;
          created_at?: string;
          id?: never;
          input?: NonNullable<Json>;
          latency_ms?: number;
          output?: Json | null;
          status?: string;
          tool_call_id?: string;
          tool_name?: string;
        };
        Relationships: [];
      };
      working_hours: {
        Row: {
          business_id: string;
          closes_at: string;
          id: string;
          opens_at: string;
          staff_id: string | null;
          weekday: number;
        };
        Insert: {
          business_id: string;
          closes_at: string;
          id?: string;
          opens_at: string;
          staff_id?: string | null;
          weekday: number;
        };
        Update: {
          business_id?: string;
          closes_at?: string;
          id?: string;
          opens_at?: string;
          staff_id?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "working_hours_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "working_hours_staff_id_business_id_fkey";
            columns: ["staff_id", "business_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id", "business_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_member_invite: { Args: { invite_token: string }; Returns: string };
      add_time_off: {
        Args: {
          ends_local: string;
          starts_local: string;
          target_staff_id: string;
          time_off_reason?: string;
        };
        Returns: string;
      };
      available_slots: {
        Args: {
          from_date: string;
          ignored_booking_id?: string;
          target_service_id: string;
          target_staff_id?: string;
          to_date: string;
        };
        Returns: {
          ends_at: string;
          staff_id: string;
          starts_at: string;
        }[];
      };
      book_appointment: {
        Args: {
          booking_notes?: string;
          customer_email?: string;
          customer_language?: Database["public"]["Enums"]["language"];
          customer_name: string;
          customer_phone: string;
          idempotency_key: string;
          requested_start: string;
          target_service_id: string;
          target_staff_id?: string;
        };
        Returns: {
          blocked_until: string;
          business_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          ends_at: string;
          id: string;
          notes: string | null;
          price: number;
          reference: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_booking: {
        Args: { idempotency_key: string; target_booking_id: string };
        Returns: {
          blocked_until: string;
          business_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          ends_at: string;
          id: string;
          notes: string | null;
          price: number;
          reference: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      chat_usage: {
        Args: { target_conversation_id: string };
        Returns: {
          business_chat_calls_last_minute: number;
          business_cost_today: number;
          conversation_tokens: number;
          site_cost_today: number;
        }[];
      };
      close_conversation: {
        Args: { target_conversation_id: string };
        Returns: undefined;
      };
      create_business: {
        Args: {
          business_language: Database["public"]["Enums"]["language"];
          business_name: string;
          business_slug: string;
          business_timezone: string;
        };
        Returns: string;
      };
      create_staff_member: {
        Args: {
          member_name: string;
          service_ids: string[];
          target_business_id: string;
        };
        Returns: string;
      };
      day_bookings: {
        Args: { day: string; target_business_id: string };
        Returns: {
          blocked_until: string;
          business_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          ends_at: string;
          id: string;
          notes: string | null;
          price: number;
          reference: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        }[];
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      hand_back_conversation: {
        Args: { target_conversation_id: string };
        Returns: undefined;
      };
      member_invite_details: {
        Args: { invite_token: string };
        Returns: {
          business_name: string;
          expires_at: string;
          role: Database["public"]["Enums"]["member_role"];
        }[];
      };
      reply_to_conversation: {
        Args: { body: string; target_conversation_id: string };
        Returns: undefined;
      };
      reschedule_booking: {
        Args: {
          idempotency_key: string;
          new_start: string;
          target_booking_id: string;
          target_staff_id?: string;
        };
        Returns: {
          blocked_until: string;
          business_id: string;
          cancelled_at: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          ends_at: string;
          id: string;
          notes: string | null;
          price: number;
          reference: string;
          service_id: string;
          staff_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_conversation_messages: {
        Args: { messages: Json; target_conversation_id: string };
        Returns: undefined;
      };
      save_knowledge_document: {
        Args: {
          chunks: Json;
          chunks_model: string;
          document_body: string;
          document_kind: Database["public"]["Enums"]["knowledge_kind"];
          document_language: Database["public"]["Enums"]["language"];
          document_title: string;
          target_business_id: string;
          target_document_id?: string;
        };
        Returns: string;
      };
      search_knowledge: {
        Args: {
          match_count?: number;
          min_similarity: number;
          query_embedding: string;
          query_model: string;
          query_text: string;
          target_business_id: string;
        };
        Returns: {
          chunk_id: string;
          content: string;
          document_id: string;
          keyword_match: boolean;
          kind: Database["public"]["Enums"]["knowledge_kind"];
          score: number;
          similarity: number;
          title: string;
        }[];
      };
      set_working_hours: {
        Args: {
          spans: Json;
          target_business_id: string;
          target_staff_id?: string;
        };
        Returns: undefined;
      };
      take_over_conversation: {
        Args: { target_conversation_id: string };
        Returns: undefined;
      };
      time_multirange: { Args: Record<PropertyKey, never>; Returns: unknown };
      update_staff_member: {
        Args: {
          member_name: string;
          service_ids: string[];
          target_staff_id: string;
        };
        Returns: boolean;
      };
      usage_by_day: {
        Args: {
          first_day: string;
          last_day: string;
          target_business_id: string;
        };
        Returns: {
          bookings: number;
          chat_calls: number;
          chat_latency_p50_ms: number;
          chat_latency_p95_ms: number;
          conversations: number;
          cost_usd: number;
          day: string;
          declined_tool_calls: number;
          embedding_calls: number;
          failed_model_calls: number;
          failed_tool_calls: number;
          input_tokens: number;
          output_tokens: number;
          person_requests: number;
        }[];
      };
      usage_by_model: {
        Args: {
          first_day: string;
          last_day: string;
          target_business_id: string;
        };
        Returns: {
          calls: number;
          cost_usd: number;
          failed_calls: number;
          input_tokens: number;
          model: string;
          output_tokens: number;
          purpose: string;
        }[];
      };
      visitor_usage: {
        Args: { target_visitor_hash: string };
        Returns: {
          chat_calls_last_minute: number;
          conversations_last_hour: number;
        }[];
      };
    };
    Enums: {
      booking_status: "confirmed" | "cancelled";
      conversation_status: "open" | "needs_human" | "taken_over" | "closed";
      knowledge_kind: "faq" | "policy";
      language: "en" | "ar";
      member_role: "owner" | "admin" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: ["confirmed", "cancelled"],
      conversation_status: ["open", "needs_human", "taken_over", "closed"],
      knowledge_kind: ["faq", "policy"],
      language: ["en", "ar"],
      member_role: ["owner", "admin", "staff"],
    },
  },
} as const;
