export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ad_channels: {
        Row: {
          budget: number;
          campaigns: number;
          clicks: number;
          conversions: number;
          created_at: string;
          id: string;
          impressions: number;
          integration_state: string;
          is_demo: boolean;
          name: string;
          platform: string;
          revenue: number;
          sessions: number;
          spend: number;
          status: string;
        };
        Insert: {
          budget?: number;
          campaigns?: number;
          clicks?: number;
          conversions?: number;
          created_at?: string;
          id?: string;
          impressions?: number;
          integration_state?: string;
          is_demo?: boolean;
          name: string;
          platform: string;
          revenue?: number;
          sessions?: number;
          spend?: number;
          status?: string;
        };
        Update: {
          budget?: number;
          campaigns?: number;
          clicks?: number;
          conversions?: number;
          created_at?: string;
          id?: string;
          impressions?: number;
          integration_state?: string;
          is_demo?: boolean;
          name?: string;
          platform?: string;
          revenue?: number;
          sessions?: number;
          spend?: number;
          status?: string;
        };
        Relationships: [];
      };
      collection_items: {
        Row: {
          collection_id: string;
          product_id: string;
        };
        Insert: {
          collection_id: string;
          product_id: string;
        };
        Update: {
          collection_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "collection_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      collections: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_demo: boolean;
          published: boolean;
          slug: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          is_demo?: boolean;
          published?: boolean;
          slug: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_demo?: boolean;
          published?: boolean;
          slug?: string;
          title?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          consent_marketing: boolean;
          country: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          notes: string | null;
          orders_count: number;
          pestel: Json;
          segment: string;
          segment_reason: string | null;
          swot: Json;
          total_spent: number;
        };
        Insert: {
          consent_marketing?: boolean;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          notes?: string | null;
          orders_count?: number;
          pestel?: Json;
          segment?: string;
          segment_reason?: string | null;
          swot?: Json;
          total_spent?: number;
        };
        Update: {
          consent_marketing?: boolean;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          notes?: string | null;
          orders_count?: number;
          pestel?: Json;
          segment?: string;
          segment_reason?: string | null;
          swot?: Json;
          total_spent?: number;
        };
        Relationships: [];
      };
      opportunity_findings: {
        Row: {
          action: string | null;
          assumptions: string | null;
          confidence: string;
          created_at: string;
          evidence: string;
          id: string;
          is_demo: boolean;
          source: string;
          title: string;
          upside: string | null;
        };
        Insert: {
          action?: string | null;
          assumptions?: string | null;
          confidence?: string;
          created_at?: string;
          evidence?: string;
          id?: string;
          is_demo?: boolean;
          source: string;
          title: string;
          upside?: string | null;
        };
        Update: {
          action?: string | null;
          assumptions?: string | null;
          confidence?: string;
          created_at?: string;
          evidence?: string;
          id?: string;
          is_demo?: boolean;
          source?: string;
          title?: string;
          upside?: string | null;
        };
        Relationships: [];
      };
      page_views: {
        Row: {
          created_at: string;
          id: string;
          path: string;
          product_id: string | null;
          referrer: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          path: string;
          product_id?: string | null;
          referrer?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          path?: string;
          product_id?: string | null;
          referrer?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          category: string;
          cost: number | null;
          created_at: string;
          description: string;
          gender: string;
          id: string;
          image_key: string | null;
          image_url: string | null;
          is_demo: boolean;
          meta_description: string | null;
          meta_title: string | null;
          price: number;
          published: boolean;
          sizes: string[];
          slug: string;
          stock: number;
          supplier: string | null;
          title: string;
        };
        Insert: {
          category: string;
          cost?: number | null;
          created_at?: string;
          description?: string;
          gender?: string;
          id?: string;
          image_key?: string | null;
          image_url?: string | null;
          is_demo?: boolean;
          meta_description?: string | null;
          meta_title?: string | null;
          price?: number;
          published?: boolean;
          sizes?: string[];
          slug: string;
          stock?: number;
          supplier?: string | null;
          title: string;
        };
        Update: {
          category?: string;
          cost?: number | null;
          created_at?: string;
          description?: string;
          gender?: string;
          id?: string;
          image_key?: string | null;
          image_url?: string | null;
          is_demo?: boolean;
          meta_description?: string | null;
          meta_title?: string | null;
          price?: number;
          published?: boolean;
          sizes?: string[];
          slug?: string;
          stock?: number;
          supplier?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      saved_outfits: {
        Row: {
          created_at: string;
          id: string;
          product_ids: string[];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_ids: string[];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_ids?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          api_support: string;
          connected: boolean;
          created_at: string;
          id: string;
          integration_state: string;
          is_demo: boolean;
          last_sync_at: string | null;
          name: string;
          region: string | null;
          specialty: string | null;
          status: string;
          website: string | null;
        };
        Insert: {
          api_support?: string;
          connected?: boolean;
          created_at?: string;
          id?: string;
          integration_state?: string;
          is_demo?: boolean;
          last_sync_at?: string | null;
          name: string;
          region?: string | null;
          specialty?: string | null;
          status?: string;
          website?: string | null;
        };
        Update: {
          api_support?: string;
          connected?: boolean;
          created_at?: string;
          id?: string;
          integration_state?: string;
          is_demo?: boolean;
          last_sync_at?: string | null;
          name?: string;
          region?: string | null;
          specialty?: string | null;
          status?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_owner: { Args: never; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      owner_exists: { Args: never; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
