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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          can_close_protocols: boolean
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          profile_id: string | null
          role: string | null
          tenant_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          can_close_protocols?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          profile_id?: string | null
          role?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          can_close_protocols?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          profile_id?: string | null
          role?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_state: {
        Row: {
          ai_disabled_reason: string | null
          ai_paused_until: string | null
          auto_msg_count_window: number
          bot_detection_triggered: boolean | null
          bot_likelihood: number | null
          consecutive_auto_msgs: number | null
          conversation_id: string
          conversation_summary: string | null
          id: string
          last_human_inbound_at: string | null
          updated_at: string
          window_started_at: string
        }
        Insert: {
          ai_disabled_reason?: string | null
          ai_paused_until?: string | null
          auto_msg_count_window?: number
          bot_detection_triggered?: boolean | null
          bot_likelihood?: number | null
          consecutive_auto_msgs?: number | null
          conversation_id: string
          conversation_summary?: string | null
          id?: string
          last_human_inbound_at?: string | null
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          ai_disabled_reason?: string | null
          ai_paused_until?: string | null
          auto_msg_count_window?: number
          bot_detection_triggered?: boolean | null
          bot_likelihood?: number | null
          consecutive_auto_msgs?: number | null
          conversation_id?: string
          conversation_summary?: string | null
          id?: string
          last_human_inbound_at?: string | null
          updated_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_state_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_events: {
        Row: {
          conversation_id: string
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          message: string | null
          metadata: Json | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_logs: {
        Row: {
          conversation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input_excerpt: string | null
          latency_ms: number | null
          model: string
          output_text: string | null
          prompt_version: string | null
          provider: string
          request_id: string | null
          status: string
          team_id: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_excerpt?: string | null
          latency_ms?: number | null
          model: string
          output_text?: string | null
          prompt_version?: string | null
          provider: string
          request_id?: string | null
          status?: string
          team_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_excerpt?: string | null
          latency_ms?: number | null
          model?: string
          output_text?: string | null
          prompt_version?: string | null
          provider?: string
          request_id?: string | null
          status?: string
          team_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_configs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_ref: string | null
          max_tokens: number | null
          model: string
          provider: string
          temperature: number | null
          top_p: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_ref?: string | null
          max_tokens?: number | null
          model: string
          provider: string
          temperature?: number | null
          top_p?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_ref?: string | null
          max_tokens?: number | null
          model?: string
          provider?: string
          temperature?: number | null
          top_p?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          anti_spam_seconds: number
          base_system_prompt: string
          created_at: string
          enable_auto_summary: boolean
          enabled_global: boolean
          fallback_offhours_message: string
          human_request_pause_hours: number
          id: string
          max_messages_per_hour: number
          memory_message_count: number
          model_name: string | null
          policies_json: Json | null
          schedule_json: Json | null
          system_prompt: string | null
          temperature: number | null
          tenant_id: string
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          anti_spam_seconds?: number
          base_system_prompt?: string
          created_at?: string
          enable_auto_summary?: boolean
          enabled_global?: boolean
          fallback_offhours_message?: string
          human_request_pause_hours?: number
          id?: string
          max_messages_per_hour?: number
          memory_message_count?: number
          model_name?: string | null
          policies_json?: Json | null
          schedule_json?: Json | null
          system_prompt?: string | null
          temperature?: number | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          anti_spam_seconds?: number
          base_system_prompt?: string
          created_at?: string
          enable_auto_summary?: boolean
          enabled_global?: boolean
          fallback_offhours_message?: string
          human_request_pause_hours?: number
          id?: string
          max_messages_per_hour?: number
          memory_message_count?: number
          model_name?: string | null
          policies_json?: Json | null
          schedule_json?: Json | null
          system_prompt?: string | null
          temperature?: number | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_team_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          prompt_override: string | null
          schedule_json: Json
          team_id: string
          tenant_id: string
          throttling_json: Json | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_override?: string | null
          schedule_json?: Json
          team_id: string
          tenant_id?: string
          throttling_json?: Json | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_override?: string | null
          schedule_json?: Json
          team_id?: string
          tenant_id?: string
          throttling_json?: Json | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_team_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_team_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_team_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_team_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_team_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          estimated: boolean | null
          id: string
          input_tokens: number
          latency_ms: number | null
          message_id: string | null
          mode: string
          model: string
          output_tokens: number
          provider: string
          team_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          estimated?: boolean | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          message_id?: string | null
          mode?: string
          model: string
          output_tokens?: number
          provider: string
          team_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          estimated?: boolean | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          message_id?: string | null
          mode?: string
          model?: string
          output_tokens?: number
          provider?: string
          team_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          provider?: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          location: string | null
          sac_ticket_id: string | null
          start_at: string
          status: string
          tenant_id: string
          timezone: string
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          location?: string | null
          sac_ticket_id?: string | null
          start_at: string
          status?: string
          tenant_id?: string
          timezone?: string
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          location?: string | null
          sac_ticket_id?: string | null
          start_at?: string
          status?: string
          tenant_id?: string
          timezone?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_sac_ticket_id_fkey"
            columns: ["sac_ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      condominiums: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "condominiums_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominiums_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominiums_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominiums_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_condominiums: {
        Row: {
          condominium_id: string
          contact_id: string
          created_at: string
          id: string
          is_default: boolean
        }
        Insert: {
          condominium_id: string
          contact_id: string
          created_at?: string
          id?: string
          is_default?: boolean
        }
        Update: {
          condominium_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_condominiums_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_condominiums_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          chat_lid: string | null
          created_at: string
          group_name: string | null
          id: string
          is_group: boolean
          lid: string | null
          lid_collected_at: string | null
          lid_source: string | null
          name: string
          phone: string | null
          profile_picture_url: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
          whatsapp_display_name: string | null
          workspace_id: string
        }
        Insert: {
          chat_lid?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          is_group?: boolean
          lid?: string | null
          lid_collected_at?: string | null
          lid_source?: string | null
          name: string
          phone?: string | null
          profile_picture_url?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          whatsapp_display_name?: string | null
          workspace_id?: string
        }
        Update: {
          chat_lid?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          is_group?: boolean
          lid?: string | null
          lid_collected_at?: string | null
          lid_source?: string | null
          name?: string
          phone?: string | null
          profile_picture_url?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          whatsapp_display_name?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_labels: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          label_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          label_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_labels_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participant_state: {
        Row: {
          conversation_id: string
          created_at: string
          current_participant_id: string | null
          id: string
          identification_asked: boolean
          last_confirmed_at: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          current_participant_id?: string | null
          id?: string
          identification_asked?: boolean
          last_confirmed_at?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          current_participant_id?: string | null
          id?: string
          identification_asked?: boolean
          last_confirmed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participant_state_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participant_state_current_participant_id_fkey"
            columns: ["current_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_resolution: {
        Row: {
          approved_by: string | null
          category: string | null
          conversation_id: string | null
          created_at: string
          id: string
          resolution_steps: Json | null
          resolution_summary: string | null
          snippet_generated: boolean | null
          team_id: string | null
        }
        Insert: {
          approved_by?: string | null
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          resolution_steps?: Json | null
          resolution_summary?: string | null
          snippet_generated?: boolean | null
          team_id?: string | null
        }
        Update: {
          approved_by?: string | null
          category?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          resolution_steps?: Json | null
          resolution_summary?: string | null
          snippet_generated?: boolean | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_resolution_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_resolution_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          active_condominium_confidence: number | null
          active_condominium_id: string | null
          active_condominium_set_at: string | null
          active_condominium_set_by: string | null
          ai_mode: string | null
          ai_paused_until: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          audio_auto_transcribe: boolean | null
          audio_enabled: boolean | null
          chat_id: string | null
          contact_id: string
          created_at: string
          human_control: boolean | null
          id: string
          last_message_at: string | null
          marked_unread: boolean | null
          priority: string | null
          protocol: string | null
          resolved_at: string | null
          resolved_by: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          tenant_id: string
          thread_key: string
          typing_by_user_id: string | null
          typing_lock_until: string | null
          unread_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active_condominium_confidence?: number | null
          active_condominium_id?: string | null
          active_condominium_set_at?: string | null
          active_condominium_set_by?: string | null
          ai_mode?: string | null
          ai_paused_until?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          audio_auto_transcribe?: boolean | null
          audio_enabled?: boolean | null
          chat_id?: string | null
          contact_id: string
          created_at?: string
          human_control?: boolean | null
          id?: string
          last_message_at?: string | null
          marked_unread?: boolean | null
          priority?: string | null
          protocol?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          thread_key: string
          typing_by_user_id?: string | null
          typing_lock_until?: string | null
          unread_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          active_condominium_confidence?: number | null
          active_condominium_id?: string | null
          active_condominium_set_at?: string | null
          active_condominium_set_by?: string | null
          ai_mode?: string | null
          ai_paused_until?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          audio_auto_transcribe?: boolean | null
          audio_enabled?: boolean | null
          chat_id?: string | null
          contact_id?: string
          created_at?: string
          human_control?: boolean | null
          id?: string
          last_message_at?: string | null
          marked_unread?: boolean | null
          priority?: string | null
          protocol?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          tenant_id?: string
          thread_key?: string
          typing_by_user_id?: string | null
          typing_lock_until?: string | null
          unread_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_active_condominium_id_fkey"
            columns: ["active_condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations_settings: {
        Row: {
          asana_enabled: boolean
          asana_project_id: string | null
          asana_section_admin: string | null
          asana_section_financeiro: string | null
          asana_section_operacional: string | null
          asana_section_support: string | null
          created_at: string
          evolution_apikey: string | null
          evolution_instance: string | null
          id: string
          tenant_id: string
          updated_at: string
          whatsapp_group_id: string | null
          whatsapp_notifications_enabled: boolean
          workspace_id: string | null
        }
        Insert: {
          asana_enabled?: boolean
          asana_project_id?: string | null
          asana_section_admin?: string | null
          asana_section_financeiro?: string | null
          asana_section_operacional?: string | null
          asana_section_support?: string | null
          created_at?: string
          evolution_apikey?: string | null
          evolution_instance?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          whatsapp_group_id?: string | null
          whatsapp_notifications_enabled?: boolean
          workspace_id?: string | null
        }
        Update: {
          asana_enabled?: boolean
          asana_project_id?: string | null
          asana_section_admin?: string | null
          asana_section_financeiro?: string | null
          asana_section_operacional?: string | null
          asana_section_support?: string | null
          created_at?: string
          evolution_apikey?: string | null
          evolution_instance?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          whatsapp_group_id?: string | null
          whatsapp_notifications_enabled?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_embeddings: {
        Row: {
          created_at: string
          embedding: string | null
          id: string
          model_name: string
          snippet_id: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          id?: string
          model_name?: string
          snippet_id?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          embedding?: string | null
          id?: string
          model_name?: string
          snippet_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_embeddings_snippet_id_fkey"
            columns: ["snippet_id"]
            isOneToOne: false
            referencedRelation: "kb_snippets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_embeddings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_snippets: {
        Row: {
          approved: boolean
          category: string
          confidence_score: number | null
          created_at: string
          id: string
          problem_text: string
          solution_text: string
          source: string | null
          tags: Json | null
          team_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          used_count: number | null
          workspace_id: string | null
        }
        Insert: {
          approved?: boolean
          category?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          problem_text: string
          solution_text: string
          source?: string | null
          tags?: Json | null
          team_id?: string | null
          tenant_id?: string
          title: string
          updated_at?: string
          used_count?: number | null
          workspace_id?: string | null
        }
        Update: {
          approved?: boolean
          category?: string
          confidence_score?: number | null
          created_at?: string
          id?: string
          problem_text?: string
          solution_text?: string
          source?: string | null
          tags?: Json | null
          team_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          used_count?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_snippets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_snippets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_snippets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          id: string
          message_id: string | null
          rating: string
          reason: string | null
          save_as_procedure: boolean | null
          team_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_id?: string | null
          rating: string
          reason?: string | null
          save_as_procedure?: boolean | null
          team_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          message_id?: string | null
          rating?: string
          reason?: string | null
          save_as_procedure?: boolean | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_feedback_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          chat_id: string | null
          client_message_id: string | null
          content: string | null
          conversation_id: string
          delivered_at: string | null
          direction: string | null
          id: string
          media_url: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          provider: string | null
          provider_message_id: string | null
          raw_payload: Json | null
          read_at: string | null
          sender_id: string | null
          sender_name: string | null
          sender_phone: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          sent_at: string
          status: string | null
          tenant_id: string
          transcribed_at: string | null
          transcript: string | null
          transcript_provider: string | null
          whatsapp_message_id: string | null
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          chat_id?: string | null
          client_message_id?: string | null
          content?: string | null
          conversation_id: string
          delivered_at?: string | null
          direction?: string | null
          id?: string
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          provider?: string | null
          provider_message_id?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_type: Database["public"]["Enums"]["sender_type"]
          sent_at?: string
          status?: string | null
          tenant_id?: string
          transcribed_at?: string | null
          transcript?: string | null
          transcript_provider?: string | null
          whatsapp_message_id?: string | null
          workspace_id?: string
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          chat_id?: string | null
          client_message_id?: string | null
          content?: string | null
          conversation_id?: string
          delivered_at?: string | null
          direction?: string | null
          id?: string
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          provider?: string | null
          provider_message_id?: string | null
          raw_payload?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_type?: Database["public"]["Enums"]["sender_type"]
          sent_at?: string
          status?: string | null
          tenant_id?: string
          transcribed_at?: string | null
          transcript?: string | null
          transcript_provider?: string | null
          whatsapp_message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          conversation_id: string | null
          created_at: string
          dedupe_key: string
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string | null
          status: string
          zapi_response_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          dedupe_key: string
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          status?: string
          zapi_response_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          dedupe_key?: string
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          status?: string
          zapi_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          confidence: number
          contact_id: string
          created_at: string
          entity_id: string | null
          id: string
          is_primary: boolean
          name: string
          role_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          confidence?: number
          contact_id: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_primary?: boolean
          name: string
          role_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          confidence?: number
          contact_id?: string
          created_at?: string
          entity_id?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          role_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ai_enabled: boolean
          billing_interval: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_ai_tokens: number | null
          max_members: number | null
          max_messages: number | null
          name: string
          price_cents: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          billing_interval?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_ai_tokens?: number | null
          max_members?: number | null
          max_messages?: number | null
          name: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          billing_interval?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_ai_tokens?: number | null
          max_members?: number | null
          max_messages?: number | null
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          team_id: string | null
          tenant_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          name: string
          team_id?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          team_id?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          ai_summary: string | null
          asana_task_gid: string | null
          category: string | null
          condominium_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          created_by_agent_id: string | null
          created_by_type: string | null
          customer_text: string | null
          due_date: string | null
          id: string
          participant_id: string | null
          priority: string
          protocol_code: string
          requester_name: string | null
          requester_role: string | null
          resolved_at: string | null
          resolved_by_agent_id: string | null
          resolved_by_name: string | null
          status: string
          summary: string | null
          tenant_id: string
          updated_at: string
          whatsapp_group_message_id: string | null
          workspace_id: string
        }
        Insert: {
          ai_summary?: string | null
          asana_task_gid?: string | null
          category?: string | null
          condominium_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          created_by_type?: string | null
          customer_text?: string | null
          due_date?: string | null
          id?: string
          participant_id?: string | null
          priority?: string
          protocol_code: string
          requester_name?: string | null
          requester_role?: string | null
          resolved_at?: string | null
          resolved_by_agent_id?: string | null
          resolved_by_name?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp_group_message_id?: string | null
          workspace_id?: string
        }
        Update: {
          ai_summary?: string | null
          asana_task_gid?: string | null
          category?: string | null
          condominium_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by_agent_id?: string | null
          created_by_type?: string | null
          customer_text?: string | null
          due_date?: string | null
          id?: string
          participant_id?: string | null
          priority?: string
          protocol_code?: string
          requester_name?: string | null
          requester_role?: string | null
          resolved_at?: string | null
          resolved_by_agent_id?: string | null
          resolved_by_name?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          updated_at?: string
          whatsapp_group_message_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocols_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_created_by_agent_id_fkey"
            columns: ["created_by_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_attempt_logs: {
        Row: {
          ack_token: string | null
          created_at: string
          error: string | null
          http_status: number | null
          id: string
          job_id: string | null
          next_retry_at: string | null
          provider: string
          provider_message_id: string | null
          response_json: Json | null
          result: string
          retryable: boolean
          target_id: string | null
          tenant_id: string
          workspace_id: string | null
        }
        Insert: {
          ack_token?: string | null
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          job_id?: string | null
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          response_json?: Json | null
          result: string
          retryable?: boolean
          target_id?: string | null
          tenant_id?: string
          workspace_id?: string | null
        }
        Update: {
          ack_token?: string | null
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          job_id?: string | null
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          response_json?: Json | null
          result?: string
          retryable?: boolean
          target_id?: string | null
          tenant_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_attempt_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_attempt_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_jobs: {
        Row: {
          ack_received_at: string | null
          ack_required: boolean
          attempts: number
          created_at: string
          event_id: string
          first_fire_at: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          repeat_every_minutes: number
          status: string
          tenant_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ack_received_at?: string | null
          ack_required?: boolean
          attempts?: number
          created_at?: string
          event_id: string
          first_fire_at: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at: string
          repeat_every_minutes?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ack_received_at?: string | null
          ack_required?: boolean
          attempts?: number
          created_at?: string
          event_id?: string
          first_fire_at?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          repeat_every_minutes?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_recipients: {
        Row: {
          attempt_count: number | null
          created_at: string
          display_name: string
          id: string
          jid: string
          last_attempt_at: string | null
          last_enqueued_at: string | null
          last_error: string | null
          last_sent_at: string | null
          next_attempt_at: string | null
          phone_e164: string | null
          reminder_id: string
          status: string | null
          team_id: string
          type: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string
          display_name: string
          id?: string
          jid: string
          last_attempt_at?: string | null
          last_enqueued_at?: string | null
          last_error?: string | null
          last_sent_at?: string | null
          next_attempt_at?: string | null
          phone_e164?: string | null
          reminder_id: string
          status?: string | null
          team_id: string
          type: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string
          display_name?: string
          id?: string
          jid?: string
          last_attempt_at?: string | null
          last_enqueued_at?: string | null
          last_error?: string | null
          last_sent_at?: string | null
          next_attempt_at?: string | null
          phone_e164?: string | null
          reminder_id?: string
          status?: string | null
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_recipients_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminder_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_recipients_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_targets: {
        Row: {
          created_at: string
          event_id: string
          id: string
          jid: string
          target_name: string | null
          target_type: string
          team_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          jid: string
          target_name?: string | null
          target_type: string
          team_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          jid?: string
          target_name?: string | null
          target_type?: string
          team_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_targets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_targets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          contact_id: string | null
          created_at: string | null
          current_attempts: number | null
          id: string
          interval_minutes: number | null
          last_attempt_at: string | null
          max_attempts: number | null
          message_content: string
          next_attempt_at: string | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          current_attempts?: number | null
          id?: string
          interval_minutes?: number | null
          last_attempt_at?: string | null
          max_attempts?: number | null
          message_content: string
          next_attempt_at?: string | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          current_attempts?: number | null
          id?: string
          interval_minutes?: number | null
          last_attempt_at?: string | null
          max_attempts?: number | null
          message_content?: string
          next_attempt_at?: string | null
          status?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_counters: {
        Row: {
          seq: number
          tenant_id: string
          workspace_id: string | null
          year: number
        }
        Insert: {
          seq?: number
          tenant_id?: string
          workspace_id?: string | null
          year: number
        }
        Update: {
          seq?: number
          tenant_id?: string
          workspace_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sac_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_counters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_counters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          code: string
          contact_channel: string | null
          contact_name: string | null
          contact_ref: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: string
          related_entity: string | null
          resolved_at: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          code: string
          contact_channel?: string | null
          contact_name?: string | null
          contact_ref?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string
          related_entity?: string | null
          resolved_at?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          code?: string
          contact_channel?: string | null
          contact_name?: string | null
          contact_ref?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string
          related_entity?: string | null
          resolved_at?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sac_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string
          id: string
          instance_name: string | null
          is_enabled: boolean
          provider: string
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
          workspace_id: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_enabled?: boolean
          provider: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
          workspace_id?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_enabled?: boolean
          provider?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          role: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      usage_records: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          period_month: number
          period_year: number
          quantity: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          period_month: number
          period_year: number
          quantity?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          period_month?: number
          period_year?: number
          quantity?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_instances: {
        Row: {
          created_at: string
          evolution_api_key: string
          evolution_base_url: string
          evolution_instance_key: string
          id: string
          last_error: string | null
          last_qr_at: string | null
          last_qr_requested_at: string | null
          last_status: string | null
          last_status_at: string | null
          last_status_details: Json | null
          last_sync_at: string | null
          qr_code: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evolution_api_key: string
          evolution_base_url: string
          evolution_instance_key: string
          id?: string
          last_error?: string | null
          last_qr_at?: string | null
          last_qr_requested_at?: string | null
          last_status?: string | null
          last_status_at?: string | null
          last_status_details?: Json | null
          last_sync_at?: string | null
          qr_code?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evolution_api_key?: string
          evolution_base_url?: string
          evolution_instance_key?: string
          id?: string
          last_error?: string | null
          last_qr_at?: string | null
          last_qr_requested_at?: string | null
          last_status?: string | null
          last_status_at?: string | null
          last_status_details?: Json | null
          last_sync_at?: string | null
          qr_code?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_instances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_instances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_targets: {
        Row: {
          created_at: string
          display_name: string
          id: string
          jid: string
          last_seen_at: string | null
          phone: string | null
          phone_e164: string | null
          source: string
          team_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          jid: string
          last_seen_at?: string | null
          phone?: string | null
          phone_e164?: string | null
          source?: string
          team_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          jid?: string
          last_seen_at?: string | null
          phone?: string | null
          phone_e164?: string | null
          source?: string
          team_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_targets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          headers: Json | null
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          headers?: Json | null
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          headers?: Json | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      zapi_settings: {
        Row: {
          created_at: string
          enable_group_notifications: boolean
          forward_webhook_url: string | null
          id: string
          last_webhook_received_at: string | null
          open_tickets_group_id: string | null
          team_id: string | null
          tenant_id: string
          updated_at: string
          workspace_id: string | null
          zapi_instance_id: string | null
          zapi_security_token: string | null
          zapi_token: string | null
        }
        Insert: {
          created_at?: string
          enable_group_notifications?: boolean
          forward_webhook_url?: string | null
          id?: string
          last_webhook_received_at?: string | null
          open_tickets_group_id?: string | null
          team_id?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
          zapi_instance_id?: string | null
          zapi_security_token?: string | null
          zapi_token?: string | null
        }
        Update: {
          created_at?: string
          enable_group_notifications?: boolean
          forward_webhook_url?: string | null
          id?: string
          last_webhook_received_at?: string | null
          open_tickets_group_id?: string | null
          team_id?: string | null
          tenant_id?: string
          updated_at?: string
          workspace_id?: string | null
          zapi_instance_id?: string | null
          zapi_security_token?: string | null
          zapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_whatsapp_health: {
        Row: {
          id: string | null
          instance_name: string | null
          instance_status: string | null
          last_error: string | null
          last_health_check_at: string | null
          last_qr_requested_at: string | null
          server_latency_ms: number | null
          server_reachable: boolean | null
          status: string | null
          team_id: string | null
          team_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_instances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_instances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          role: string | null
          updated_at: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          settings: Json | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_workspace_members: {
        Args: { p_user_id?: string; p_workspace_id: string }
        Returns: boolean
      }
      can_perform_action: {
        Args: {
          p_action_type: string
          p_quantity?: number
          p_workspace_id: string
        }
        Returns: {
          allowed: boolean
          current_usage: number
          plan_name: string
          reason: string
          subscription_status: string
          usage_limit: number
        }[]
      }
      cleanup_old_ai_logs: { Args: never; Returns: undefined }
      cleanup_old_messages: { Args: never; Returns: undefined }
      current_tenant_id: { Args: never; Returns: string }
      current_workspace_id: { Args: never; Returns: string }
      current_workspace_ids: { Args: never; Returns: string[] }
      current_workspace_role: { Args: never; Returns: string }
      detect_display_name_type: {
        Args: { display_name: string }
        Returns: string
      }
      generate_workspace_slug: {
        Args: { p_name: string; p_user_id: string }
        Returns: string
      }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_unread_count: { Args: { conv_id: string }; Returns: undefined }
      is_platform_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_tenant_admin: { Args: { t_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      match_kb_snippets: {
        Args: {
          filter_team_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          id: string
          problem_text: string
          similarity: number
          snippet_id: string
          solution_text: string
          tags: Json
          title: string
        }[]
      }
      next_sac_code: { Args: never; Returns: string }
      next_sac_code_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      normalize_chat_id: { Args: { raw_chat_id: string }; Returns: string }
      platform_archive_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      platform_create_demo_workspace: {
        Args: { p_name: string }
        Returns: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      platform_list_workspaces: {
        Args: never
        Returns: {
          active_members_count: number
          ai_replies: number
          ai_tokens: number
          created_at: string
          current_period_end: string
          members_count: number
          messages_sent: number
          owner_email: string
          owner_name: string
          plan_name: string
          subscription_status: string
          workspace_id: string
          workspace_name: string
          workspace_slug: string
        }[]
      }
      platform_reset_workspace_integrations: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      platform_start_workspace_trial: {
        Args: { p_days?: number; p_plan_name?: string; p_workspace_id: string }
        Returns: undefined
      }
      record_usage: {
        Args: {
          p_metric_name: string
          p_period_month?: number
          p_period_year?: number
          p_quantity?: number
          p_workspace_id: string
        }
        Returns: {
          created_at: string
          id: string
          metric_name: string
          period_month: number
          period_year: number
          quantity: number
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "usage_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_user_workspace_claims: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      workspace_membership_role: {
        Args: { p_user_id?: string; p_workspace_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "agent"
      conversation_status: "open" | "resolved"
      message_type: "text" | "image" | "video" | "audio" | "document" | "system"
      sender_type: "contact" | "agent" | "system"
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
    Enums: {
      app_role: ["admin", "agent"],
      conversation_status: ["open", "resolved"],
      message_type: ["text", "image", "video", "audio", "document", "system"],
      sender_type: ["contact", "agent", "system"],
    },
  },
} as const
