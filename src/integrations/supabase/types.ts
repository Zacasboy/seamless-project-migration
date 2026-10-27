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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ad_channels: {
        Row: {
          budget: number
          created_at: string
          external_account_id: string | null
          id: string
          last_sync_status: string
          last_synced_at: string | null
          name: string
          platform: string
          status: string
          tracking_id: string | null
        }
        Insert: {
          budget?: number
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_sync_status?: string
          last_synced_at?: string | null
          name: string
          platform: string
          status?: string
          tracking_id?: string | null
        }
        Update: {
          budget?: number
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_sync_status?: string
          last_synced_at?: string | null
          name?: string
          platform?: string
          status?: string
          tracking_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          consent_updated_at: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          last_order_at: string | null
          lifetime_value: number
          marketing_consent: boolean
          name: string
          notes: string | null
          pestel: Json
          segment: string
          swot: Json
        }
        Insert: {
          consent_updated_at?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_order_at?: string | null
          lifetime_value?: number
          marketing_consent?: boolean
          name: string
          notes?: string | null
          pestel?: Json
          segment?: string
          swot?: Json
        }
        Update: {
          consent_updated_at?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_order_at?: string | null
          lifetime_value?: number
          marketing_consent?: boolean
          name?: string
          notes?: string | null
          pestel?: Json
          segment?: string
          swot?: Json
        }
        Relationships: []
      }
      email_change_requests: {
        Row: {
          consumed_at: string | null
          created_at: string
          current_email: string | null
          id: string
          new_email: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          current_email?: string | null
          id?: string
          new_email: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          current_email?: string | null
          id?: string
          new_email?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          size: string | null
          title: string
          unit_price: number
        }
        Insert: {
          color?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          size?: string | null
          title: string
          unit_price?: number
        }
        Update: {
          color?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          size?: string | null
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          id: string
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          product_id: string | null
          referrer: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          product_id?: string | null
          referrer?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          product_id?: string | null
          referrer?: string | null
        }
        Relationships: []
      }
      product_supplier_links: {
        Row: {
          availability_status: string
          created_at: string
          id: string
          last_checked_at: string | null
          product_id: string
          supplier_cost: number | null
          supplier_currency: string
          supplier_id: string
          supplier_product_url: string | null
          supplier_sku: string | null
          updated_at: string
        }
        Insert: {
          availability_status?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          product_id: string
          supplier_cost?: number | null
          supplier_currency?: string
          supplier_id: string
          supplier_product_url?: string | null
          supplier_sku?: string | null
          updated_at?: string
        }
        Update: {
          availability_status?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          product_id?: string
          supplier_cost?: number | null
          supplier_currency?: string
          supplier_id?: string
          supplier_product_url?: string | null
          supplier_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_supplier_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_links_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          color_options: string[]
          created_at: string
          currency: string
          description: string
          garment_type: string | null
          gender: string
          id: string
          image_alt: string | null
          image_key: string | null
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          price: number
          published: boolean
          size_options: string[]
          sku: string | null
          slug: string
          stock_status: string
          supplier: string | null
          title: string
        }
        Insert: {
          category: string
          color_options?: string[]
          created_at?: string
          currency?: string
          description?: string
          garment_type?: string | null
          gender?: string
          id?: string
          image_alt?: string | null
          image_key?: string | null
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          price?: number
          published?: boolean
          size_options?: string[]
          sku?: string | null
          slug: string
          stock_status?: string
          supplier?: string | null
          title: string
        }
        Update: {
          category?: string
          color_options?: string[]
          created_at?: string
          currency?: string
          description?: string
          garment_type?: string | null
          gender?: string
          id?: string
          image_alt?: string | null
          image_key?: string | null
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          price?: number
          published?: boolean
          size_options?: string[]
          sku?: string | null
          slug?: string
          stock_status?: string
          supplier?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_outfits: {
        Row: {
          created_at: string
          fit_preference: string | null
          id: string
          name: string
          product_ids: string[]
          size_preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fit_preference?: string | null
          id?: string
          name?: string
          product_ids: string[]
          size_preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fit_preference?: string | null
          id?: string
          name?: string
          product_ids?: string[]
          size_preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          api_connection_status: string
          api_docs_url: string | null
          connected: boolean
          created_at: string
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          name: string
          provider_key: string | null
          region: string | null
          specialty: string | null
          status: string
          supported_operations: string[]
          website: string | null
        }
        Insert: {
          api_connection_status?: string
          api_docs_url?: string | null
          connected?: boolean
          created_at?: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          name: string
          provider_key?: string | null
          region?: string | null
          specialty?: string | null
          status?: string
          supported_operations?: string[]
          website?: string | null
        }
        Update: {
          api_connection_status?: string
          api_docs_url?: string | null
          connected?: boolean
          created_at?: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          name?: string
          provider_key?: string | null
          region?: string | null
          specialty?: string | null
          status?: string
          supported_operations?: string[]
          website?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_my_email_change_request: {
        Args: { _id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const