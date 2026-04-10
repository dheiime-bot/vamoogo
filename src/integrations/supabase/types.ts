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
      drivers: {
        Row: {
          balance: number
          category: Database["public"]["Enums"]["vehicle_category"]
          cnh_back_url: string | null
          cnh_ear: boolean | null
          cnh_front_url: string | null
          cnh_number: string | null
          created_at: string
          daily_cancellations: number | null
          id: string
          last_cancellation_reset: string | null
          rating: number | null
          status: Database["public"]["Enums"]["driver_status"]
          total_rides: number | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
        }
        Insert: {
          balance?: number
          category?: Database["public"]["Enums"]["vehicle_category"]
          cnh_back_url?: string | null
          cnh_ear?: boolean | null
          cnh_front_url?: string | null
          cnh_number?: string | null
          created_at?: string
          daily_cancellations?: number | null
          id?: string
          last_cancellation_reset?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          balance?: number
          category?: Database["public"]["Enums"]["vehicle_category"]
          cnh_back_url?: string | null
          cnh_ear?: boolean | null
          cnh_front_url?: string | null
          cnh_number?: string | null
          created_at?: string
          daily_cancellations?: number | null
          id?: string
          last_cancellation_reset?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"]
          total_rides?: number | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
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
          cpf: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          phone_verified: boolean | null
          selfie_url: string | null
          updated_at: string
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          cpf: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          selfie_url?: string | null
          updated_at?: string
          user_id: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
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
      rides: {
        Row: {
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
          id: string
          origin_address: string
          origin_lat: number | null
          origin_lng: number | null
          passenger_count: number
          passenger_id: string
          platform_fee: number | null
          price: number | null
          rating: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          stops: Json | null
          updated_at: string
        }
        Insert: {
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
          id?: string
          origin_address: string
          origin_lat?: number | null
          origin_lng?: number | null
          passenger_count?: number
          passenger_id: string
          platform_fee?: number | null
          price?: number | null
          rating?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stops?: Json | null
          updated_at?: string
        }
        Update: {
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
          id?: string
          origin_address?: string
          origin_lat?: number | null
          origin_lng?: number | null
          passenger_count?: number
          passenger_id?: string
          platform_fee?: number | null
          price?: number | null
          rating?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          stops?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      tariffs: {
        Row: {
          base_fare: number
          category: Database["public"]["Enums"]["vehicle_category"]
          created_at: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "driver" | "passenger"
      driver_status: "pending" | "approved" | "rejected" | "blocked"
      fraud_severity: "light" | "moderate" | "probable"
      recharge_method: "pix" | "card"
      recharge_status: "pending" | "completed" | "failed"
      ride_status:
        | "requested"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_type: "passenger" | "driver" | "admin"
      vehicle_category: "moto" | "car" | "premium"
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
      app_role: ["admin", "driver", "passenger"],
      driver_status: ["pending", "approved", "rejected", "blocked"],
      fraud_severity: ["light", "moderate", "probable"],
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
      vehicle_category: ["moto", "car", "premium"],
    },
  },
} as const
