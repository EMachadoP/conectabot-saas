export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          tenant_id: string
          updated_at?: string
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
          policies_json: Json | null
          schedule_json: Json | null
          tenant_id: string
          timezone: string
          updated_at: string
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
          policies_json?: Json | null
          schedule_json?: Json | null
          tenant_id: string
          timezone?: string
          updated_at?: string
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
          policies_json?: Json | null
          schedule_json?: Json | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          prompt_override?: string | null
          schedule_json?: Json
          team_id: string
          tenant_id: string
          throttling_json?: Json | null
          updated_at?: string
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
          tenant_id: string
          timezone?: string
          title: string
          updated_at?: string
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
        ]
      }
      condominiums: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominiums_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          updated_at?: string
          whatsapp_display_name?: string | null
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
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          thread_key: string
          typing_by_user_id?: string | null
          typing_lock_until?: string | null
          unread_count?: number
          updated_at?: string
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
          tenant_id: string
          updated_at?: string
          whatsapp_group_id?: string | null
          whatsapp_notifications_enabled?: boolean
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
        }
        Relationships: [
          {
            foreignKeyName: "integrations_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          title: string
          updated_at?: string
          used_count?: number | null
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
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          transcribed_at?: string | null
          transcript?: string | null
          transcript_provider?: string | null
          whatsapp_message_id?: string | null
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
        ]
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
          tenant_id: string
          updated_at?: string
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
          tenant_id: string
          updated_at?: string
          whatsapp_group_message_id?: string | null
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
        ]
      }
      reminder_attempt_logs: {
        Row: {
          ack_token: string | null
          attempt_no: number
          error: string | null
          event_id: string
          fired_at: string
          http_status: number | null
          id: string
          job_id: string
          next_retry_at: string | null
          provider: string
          provider_message_id: string | null
          response_json: Json | null
          result: string
          retryable: boolean | null
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          ack_token?: string | null
          attempt_no: number
          error?: string | null
          event_id: string
          fired_at?: string
          http_status?: number | null
          id?: string
          job_id: string
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          response_json?: Json | null
          result: string
          retryable?: boolean | null
          target_id?: string | null
          tenant_id: string
        }
        Update: {
          ack_token?: string | null
          attempt_no?: number
          error?: string | null
          event_id?: string
          fired_at?: string
          http_status?: number | null
          id?: string
          job_id?: string
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          response_json?: Json | null
          result?: string
          retryable?: boolean | null
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_attempt_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_attempt_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "reminder_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_attempt_logs_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "reminder_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_attempt_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          updated_at?: string
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
        ]
      }
      reminder_targets: {
        Row: {
          created_at: string
          event_id: string
          id: string
          target_name: string | null
          target_ref: string
          target_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          target_name?: string | null
          target_ref: string
          target_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          target_name?: string | null
          target_ref?: string
          target_type?: string
          tenant_id?: string
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
            foreignKeyName: "reminder_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_counters: {
        Row: {
          seq: number
          tenant_id: string
          year: number
        }
        Insert: {
          seq?: number
          tenant_id: string
          year: number
        }
        Update: {
          seq?: number
          tenant_id?: string
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
          tenant_id: string
          title: string
          updated_at?: string
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
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          is_enabled?: boolean
          provider: string
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
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
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          updated_at?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      cleanup_old_ai_logs: { Args: never; Returns: undefined }
      cleanup_old_messages: { Args: never; Returns: undefined }
      current_tenant_id: { Args: never; Returns: string }
      detect_display_name_type: {
        Args: { display_name: string }
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

