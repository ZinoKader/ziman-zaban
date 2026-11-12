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
      cards: {
        Row: {
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
          item_id: string
          lang: Database["public"]["Enums"]["target_lang"]
          lapses: number
          last_review: string | null
          learning_steps: number
          reps: number
          scheduled_days: number
          skill: Database["public"]["Enums"]["skill"]
          stability: number
          state: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
          item_id: string
          lang: Database["public"]["Enums"]["target_lang"]
          lapses: number
          last_review?: string | null
          learning_steps: number
          reps: number
          scheduled_days: number
          skill: Database["public"]["Enums"]["skill"]
          stability: number
          state: number
          user_id?: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          due?: string
          elapsed_days?: number
          item_id?: string
          lang?: Database["public"]["Enums"]["target_lang"]
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          skill?: Database["public"]["Enums"]["skill"]
          stability?: number
          state?: number
          user_id?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          created_at: string
          id: number
          item_key: string
          message: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at: string
          id?: never
          item_key: string
          message: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          item_key?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_totals: {
        Row: {
          correct: number
          day: string
          lang: Database["public"]["Enums"]["target_lang"]
          ms: number
          new_items: number
          reviews: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          correct?: number
          day: string
          lang: Database["public"]["Enums"]["target_lang"]
          ms?: number
          new_items?: number
          reviews?: number
          user_id?: string
        }
        Update: {
          correct?: number
          day?: string
          lang?: Database["public"]["Enums"]["target_lang"]
          ms?: number
          new_items?: number
          reviews?: number
          user_id?: string
        }
        Relationships: []
      }
      medals: {
        Row: {
          earned_at: string
          lang: Database["public"]["Enums"]["target_lang"]
          user_id: string
          words: number
        }
        ComputedFields: never
        Insert: {
          earned_at: string
          lang: Database["public"]["Enums"]["target_lang"]
          user_id?: string
          words: number
        }
        Update: {
          earned_at?: string
          lang?: Database["public"]["Enums"]["target_lang"]
          user_id?: string
          words?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          settings: NonNullable<Json>
          settings_updated_at: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          settings?: NonNullable<Json>
          settings_updated_at?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          settings?: NonNullable<Json>
          settings_updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          day: string
          grade: number
          id: number
          is_new: boolean
          item_id: string
          kind: string
          lang: Database["public"]["Enums"]["target_lang"]
          ms: number
          reviewed_at: string
          skill: Database["public"]["Enums"]["skill"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          day: string
          grade: number
          id?: never
          is_new: boolean
          item_id: string
          kind: string
          lang: Database["public"]["Enums"]["target_lang"]
          ms: number
          reviewed_at: string
          skill: Database["public"]["Enums"]["skill"]
          user_id?: string
        }
        Update: {
          day?: string
          grade?: number
          id?: never
          is_new?: boolean
          item_id?: string
          kind?: string
          lang?: Database["public"]["Enums"]["target_lang"]
          ms?: number
          reviewed_at?: string
          skill?: Database["public"]["Enums"]["skill"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_language: {
        Args: {
          reset_at: string
          target: Database["public"]["Enums"]["target_lang"]
        }
        Returns: undefined
      }
      save_progress: { Args: { data: Json }; Returns: undefined }
      save_settings: {
        Args: { changed_at?: string; settings: Json }
        Returns: undefined
      }
    }
    Enums: {
      skill: "recognition" | "recall" | "construction" | "response"
      target_lang: "ckb" | "fa"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      skill: ["recognition", "recall", "construction", "response"],
      target_lang: ["ckb", "fa"],
    },
  },
} as const
