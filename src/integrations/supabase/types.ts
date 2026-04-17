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
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          min_rides: number | null
          name: string
          start_date: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          min_rides?: number | null
          name: string
          start_date?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          min_rides?: number | null
          name?: string
          start_date?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          ride_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          ride_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          ride_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      city_sync_log: {
        Row: {
          center_lat: number
          center_lng: number
          city_key: string
          created_at: string
          id: string
          last_synced_at: string
          places_count: number
          radius_m: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          city_key: string
          created_at?: string
          id?: string
          last_synced_at?: string
          places_count?: number
          radius_m: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          city_key?: string
          created_at?: string
          id?: string
          last_synced_at?: string
          places_count?: number
          radius_m?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_fare: number | null
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_fare?: number | null
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_fare?: number | null
          used_count?: number
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          category: Database["public"]["Enums"]["vehicle_category"]
          driver_id: string
          heading: number | null
          id: string
          is_online: boolean
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["vehicle_category"]
          driver_id: string
          heading?: number | null
          id?: string
          is_online?: boolean
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["vehicle_category"]
          driver_id?: string
          heading?: number | null
          id?: string
          is_online?: boolean
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          analysis_message: string | null
          analyzed_at: string | null
          analyzed_by: string | null
          balance: number
          category: Database["public"]["Enums"]["vehicle_category"]
          cnh_back_url: string | null
          cnh_ear: boolean | null
          cnh_front_url: string | null
          cnh_number: string | null
          created_at: string
          criminal_record_issued_at: string | null
          criminal_record_url: string | null
          crlv_url: string | null
          daily_cancellations: number | null
          id: string
          last_cancellation_reset: string | null
          liveness_verified: boolean | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_key_type: string | null
          rating: number | null
          selfie_liveness_url: string | null
          selfie_with_document_url: string | null
          status: Database["public"]["Enums"]["driver_status"]
          total_rides: number | null
          updated_at: string
          user_id: string
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_photo_back_url: string | null
          vehicle_photo_front_url: string | null
          vehicle_photo_left_url: string | null
          vehicle_photo_right_url: string | null
          vehicle_plate: string | null
          vehicle_year: number | null
        }
        Insert: {
          analysis_message?: string | null
          analyzed_at?: string | null
          analyzed_by?: string | null
          balance?: number
          category?: Database["public"]["Enums"]["vehicle_category"]
          cnh_back_url?: string | null
          cnh_ear?: boolean | null
          cnh_front_url?: string | null
          cnh_number?: string | null
          created_at?: string
          criminal_record_issued_at?: string | null
          criminal_record_url?: string | null
          crlv_url?: string | null
          daily_cancellations?: number | null
          id?: string
          last_cancellation_reset?: string | null
          liveness_verified?: boolean | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          rating?: number | null
          selfie_liveness_url?: string | null
          selfie_with_document_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number | null
          updated_at?: string
          user_id: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_photo_back_url?: string | null
          vehicle_photo_front_url?: string | null
          vehicle_photo_left_url?: string | null
          vehicle_photo_right_url?: string | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
        }
        Update: {
          analysis_message?: string | null
          analyzed_at?: string | null
          analyzed_by?: string | null
          balance?: number
          category?: Database["public"]["Enums"]["vehicle_category"]
          cnh_back_url?: string | null
          cnh_ear?: boolean | null
          cnh_front_url?: string | null
          cnh_number?: string | null
          created_at?: string
          criminal_record_issued_at?: string | null
          criminal_record_url?: string | null
          crlv_url?: string | null
          daily_cancellations?: number | null
          id?: string
          last_cancellation_reset?: string | null
          liveness_verified?: boolean | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          rating?: number | null
          selfie_liveness_url?: string | null
          selfie_with_document_url?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_photo_back_url?: string | null
          vehicle_photo_front_url?: string | null
          vehicle_photo_left_url?: string | null
          vehicle_photo_right_url?: string | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string
          driver_id: string
          gps_data: Json | null
          id: string
          resolved: boolean | null
          ride_id: string | null
          route_similarity: number | null
          severity: Database["public"]["Enums"]["fraud_severity"]
          time_match_minutes: number | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description: string
          driver_id: string
          gps_data?: Json | null
          id?: string
          resolved?: boolean | null
          ride_id?: string | null
          route_similarity?: number | null
          severity: Database["public"]["Enums"]["fraud_severity"]
          time_match_minutes?: number | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string
          driver_id?: string
          gps_data?: Json | null
          id?: string
          resolved?: boolean | null
          ride_id?: string | null
          route_similarity?: number | null
          severity?: Database["public"]["Enums"]["fraud_severity"]
          time_match_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          driver_id: string | null
          id: string
          passenger_id: string | null
          resolution: string | null
          ride_id: string | null
          severity: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          driver_id?: string | null
          id?: string
          passenger_id?: string | null
          resolution?: string | null
          ride_id?: string | null
          severity?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          driver_id?: string | null
          id?: string
          passenger_id?: string | null
          resolution?: string | null
          ride_id?: string | null
          severity?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string
          category: string | null
          city: string | null
          country: string | null
          created_at: string
          google_place_id: string | null
          id: string
          last_synced_at: string
          lat: number
          lng: number
          name: string
          rating: number | null
          raw: Json | null
          state: string | null
          types: string[] | null
          updated_at: string
          user_ratings_total: number | null
        }
        Insert: {
          address: string
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          last_synced_at?: string
          lat: number
          lng: number
          name: string
          rating?: number | null
          raw?: Json | null
          state?: string | null
          types?: string[] | null
          updated_at?: string
          user_ratings_total?: number | null
        }
        Update: {
          address?: string
          category?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          last_synced_at?: string
          lat?: number
          lng?: number
          name?: string
          rating?: number | null
          raw?: Json | null
          state?: string | null
          types?: string[] | null
          updated_at?: string
          user_ratings_total?: number | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_role: Database["public"]["Enums"]["app_role"] | null
          birth_date: string | null
          cpf: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          phone_verified: boolean | null
          selfie_signup_url: string | null
          selfie_url: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          birth_date?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          selfie_signup_url?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          birth_date?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          selfie_signup_url?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_id?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      recharges: {
        Row: {
          amount: number
          bonus: number | null
          created_at: string
          driver_id: string
          id: string
          method: Database["public"]["Enums"]["recharge_method"]
          status: Database["public"]["Enums"]["recharge_status"]
        }
        Insert: {
          amount: number
          bonus?: number | null
          created_at?: string
          driver_id: string
          id?: string
          method: Database["public"]["Enums"]["recharge_method"]
          status?: Database["public"]["Enums"]["recharge_status"]
        }
        Update: {
          amount?: number
          bonus?: number | null
          created_at?: string
          driver_id?: string
          id?: string
          method?: Database["public"]["Enums"]["recharge_method"]
          status?: Database["public"]["Enums"]["recharge_status"]
        }
        Relationships: []
      }
      ride_offers: {
        Row: {
          created_at: string
          distance_to_pickup_km: number | null
          driver_id: string
          expires_at: string
          id: string
          responded_at: string | null
          ride_id: string
          status: string
        }
        Insert: {
          created_at?: string
          distance_to_pickup_km?: number | null
          driver_id: string
          expires_at?: string
          id?: string
          responded_at?: string | null
          ride_id: string
          status?: string
        }
        Update: {
          created_at?: string
          distance_to_pickup_km?: number | null
          driver_id?: string
          expires_at?: string
          id?: string
          responded_at?: string | null
          ride_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          arrived_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at: string | null
          created_at: string
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          driver_net: number | null
          duration_minutes: number | null
          for_other_person: boolean
          id: string
          legs: Json | null
          origin_address: string
          origin_lat: number | null
          origin_lng: number | null
          origin_type: string
          other_person_name: string | null
          other_person_phone: string | null
          passenger_count: number
          passenger_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pix_paid_at: string | null
          platform_fee: number | null
          price: number | null
          rating: number | null
          ride_code: string
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          stops: Json | null
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: Database["public"]["Enums"]["vehicle_category"]
          completed_at?: string | null
          created_at?: string
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          driver_net?: number | null
          duration_minutes?: number | null
          for_other_person?: boolean
          id?: string
          legs?: Json | null
          origin_address: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_type?: string
          other_person_name?: string | null
          other_person_phone?: string | null
          passenger_count?: number
          passenger_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pix_paid_at?: string | null
          platform_fee?: number | null
          price?: number | null
          rating?: number | null
          ride_code: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stops?: Json | null
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: Database["public"]["Enums"]["vehicle_category"]
          completed_at?: string | null
          created_at?: string
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          driver_net?: number | null
          duration_minutes?: number | null
          for_other_person?: boolean
          id?: string
          legs?: Json | null
          origin_address?: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_type?: string
          other_person_name?: string | null
          other_person_phone?: string | null
          passenger_count?: number
          passenger_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pix_paid_at?: string | null
          platform_fee?: number | null
          price?: number | null
          rating?: number | null
          ride_code?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stops?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tariffs: {
        Row: {
          base_fare: number
          category: Database["public"]["Enums"]["vehicle_category"]
          created_at: string
          fee_percent: number | null
          id: string
          min_fare: number
          passenger_extra: number
          per_km: number
          per_minute: number
          region: string
          region_multiplier: number
          updated_at: string
        }
        Insert: {
          base_fare?: number
          category: Database["public"]["Enums"]["vehicle_category"]
          created_at?: string
          fee_percent?: number | null
          id?: string
          min_fare?: number
          passenger_extra?: number
          per_km?: number
          per_minute?: number
          region?: string
          region_multiplier?: number
          updated_at?: string
        }
        Update: {
          base_fare?: number
          category?: Database["public"]["Enums"]["vehicle_category"]
          created_at?: string
          fee_percent?: number | null
          id?: string
          min_fare?: number
          passenger_extra?: number
          per_km?: number
          per_minute?: number
          region?: string
          region_multiplier?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          granted_by: string | null
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          driver_id: string
          id: string
          pix_key: string
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["withdrawal_status"]
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          pix_key: string
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          pix_key?: string
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      become_driver: {
        Args: {
          _category: Database["public"]["Enums"]["vehicle_category"]
          _cnh_back_url: string
          _cnh_ear: boolean
          _cnh_front_url: string
          _cnh_number: string
          _criminal_record_issued_at: string
          _criminal_record_url: string
          _crlv_url: string
          _liveness_verified: boolean
          _pix_holder_name: string
          _pix_key: string
          _pix_key_type: string
          _selfie_liveness_url: string
          _selfie_with_document_url: string
          _vehicle_brand: string
          _vehicle_color: string
          _vehicle_model: string
          _vehicle_photo_back_url: string
          _vehicle_photo_front_url: string
          _vehicle_photo_left_url: string
          _vehicle_photo_right_url: string
          _vehicle_plate: string
          _vehicle_year: number
        }
        Returns: string
      }
      check_signup_dupes: {
        Args: { _cpf: string; _phone: string }
        Returns: {
          cpf_taken: boolean
          phone_taken: boolean
        }[]
      }
      find_nearest_drivers: {
        Args: {
          _category: Database["public"]["Enums"]["vehicle_category"]
          _lat: number
          _limit?: number
          _lng: number
          _max_km?: number
        }
        Returns: {
          distance_km: number
          driver_id: string
          lat: number
          lng: number
        }[]
      }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      search_places: {
        Args: {
          _lat?: number
          _limit?: number
          _lng?: number
          _max_km?: number
          _query: string
        }
        Returns: {
          address: string
          category: string
          distance_km: number
          google_place_id: string
          id: string
          lat: number
          lng: number
          name: string
          similarity: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "driver" | "passenger" | "master"
      driver_status:
        | "pending"
        | "approved"
        | "rejected"
        | "blocked"
        | "cadastro_enviado"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "pendente_documentos"
      fraud_severity: "light" | "moderate" | "probable"
      payment_method: "cash" | "pix" | "debit" | "credit"
      recharge_method: "pix" | "card"
      recharge_status: "pending" | "completed" | "failed"
      ride_status:
        | "requested"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_type: "passenger" | "driver" | "admin"
      vehicle_category: "moto" | "economico" | "conforto"
      withdrawal_status: "pending" | "approved" | "paid" | "rejected"
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
      app_role: ["admin", "driver", "passenger", "master"],
      driver_status: [
        "pending",
        "approved",
        "rejected",
        "blocked",
        "cadastro_enviado",
        "em_analise",
        "aprovado",
        "reprovado",
        "pendente_documentos",
      ],
      fraud_severity: ["light", "moderate", "probable"],
      payment_method: ["cash", "pix", "debit", "credit"],
      recharge_method: ["pix", "card"],
      recharge_status: ["pending", "completed", "failed"],
      ride_status: [
        "requested",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_type: ["passenger", "driver", "admin"],
      vehicle_category: ["moto", "economico", "conforto"],
      withdrawal_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
