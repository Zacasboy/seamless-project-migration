// Tipos da base de dados pallessiani (fybrptjsdubegufwdsrk).
// Gerados a partir do esquema real em 16/11/2026 e completados com as colunas da migration
// supabase/migrations/20261116020000_admin_alignment_orders.sql.
// Para regenerar: npx supabase gen types typescript --project-id fybrptjsdubegufwdsrk

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type Table<Row, Required extends keyof Row, R extends Rel[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: R;
};

export type AppRole = "admin" | "user";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

export type AgentSettingsRow = {
  agent: string;
  enabled: boolean;
  autonomy: "auto" | "propor";
  frequency: "daily" | "weekly" | "manual";
  instructions: string;
  config: Json;
  updated_at: string;
  updated_by: string | null;
};
export type AgentRunRow = {
  id: string;
  agent: string;
  trigger: "manual" | "cron" | "import";
  status: "running" | "done" | "error";
  summary: string | null;
  report_md: string | null;
  error: string | null;
  sources: Json;
  input_tokens: number;
  output_tokens: number;
  started_by: string | null;
  started_at: string;
  finished_at: string | null;
};
export type AgentActionRow = {
  id: string;
  run_id: string | null;
  agent: string;
  op: "create" | "update" | "delete";
  entity: "products" | "collections" | "marketing_content" | "agent_plans" | "agent_memory" | "store_settings";
  entity_id: string | null;
  label: string | null;
  before: { [key: string]: Json | undefined } | null;
  after: { [key: string]: Json | undefined } | null;
  reason: string | null;
  status: "applied" | "proposed" | "undone" | "rejected" | "failed";
  error: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
};
export type MarketingContentRow = {
  id: string;
  kind: "post" | "ad" | "email" | "blog";
  channel: string;
  title: string;
  body: string;
  hashtags: string[];
  cta: string | null;
  audience: string | null;
  product_ids: string[];
  budget_eur: number | null;
  expected_ctr: number | null;
  expected_cvr: number | null;
  success_probability: number | null;
  rationale: string | null;
  status: "draft" | "approved" | "published" | "archived";
  scheduled_for: string | null;
  agent: string | null;
  created_at: string;
  updated_at: string;
};
export type AgentPlanRow = {
  id: string;
  agent: string;
  kind: "concorrencia" | "marca" | "seo" | "conteudo";
  title: string;
  body_md: string;
  actions: Json;
  sources: Json;
  status: "open" | "in_progress" | "done" | "archived";
  created_at: string;
  updated_at: string;
};
export type AgentMemoryRow = { key: string; value: Json; updated_at: string; updated_by_agent: string | null };

export type SupplierCredentialRow = {
  provider: string;
  access_token: string; // cifrado
  refresh_token: string | null; // cifrado
  expires_at: string | null;
  refresh_expires_at: string | null;
  account: string | null;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  gender: string;
  garment_type: string | null;
  sku: string | null;
  size_options: string[];
  color_options: string[];
  stock_status: string;
  image_key: string | null;
  image_url: string | null;
  image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  supplier: string | null;
  published: boolean;
  created_at: string;
  cost: number | null;
  is_demo: boolean;
};

export type SupplierRow = {
  id: string;
  name: string;
  website: string | null;
  region: string | null;
  specialty: string | null;
  status: string;
  connected: boolean;
  provider_key: string | null;
  api_connection_status: string;
  supported_operations: string[];
  api_docs_url: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
  is_demo: boolean;
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  segment: string;
  segment_reason: string | null;
  swot: Json;
  pestel: Json;
  notes: string | null;
  last_order_at: string | null;
  lifetime_value: number;
  marketing_consent: boolean;
  consent_updated_at: string | null;
  created_at: string;
  is_demo: boolean;
};

export type AdChannelRow = {
  id: string;
  name: string;
  platform: string;
  status: string;
  budget: number;
  external_account_id: string | null;
  tracking_id: string | null;
  last_synced_at: string | null;
  last_sync_status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  created_at: string;
  is_demo: boolean;
};

export type CollectionRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  campaign: string;
  season: string;
  status: string;
  hero_product_id: string | null;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
};

export type CollectionItemRow = {
  id: string;
  collection_id: string;
  product_id: string | null;
  outfit_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ShippingInfo = {
  name?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  nif?: string;
};

export type OrderRow = {
  id: string;
  user_id: string;
  status: string;
  total: number;
  currency: string;
  shipping: Json;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  quantity: number;
  unit_price: number;
  size: string | null;
  color: string | null;
};

export type PageViewRow = {
  id: string;
  path: string;
  product_id: string | null;
  referrer: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRoleRow = { id: string; user_id: string; role: AppRole };

export type OpportunityRow = {
  id: string;
  title: string;
  source: string;
  confidence: string;
  evidence: string | null;
  upside: string | null;
  assumptions: string | null;
  action: string | null;
  is_demo: boolean;
  created_at: string;
};

export type SupplierVariantRef = {
  id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  stock: number | null;
  available: boolean;
};

export type ProductSupplierLinkRow = {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_product_url: string | null;
  supplier_sku: string | null;
  supplier_cost: number | null;
  supplier_currency: string | null;
  availability_status: string | null;
  last_checked_at: string | null;
  external_product_id: string | null;
  external_variants: Json;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreSettingRow = {
  key: string;
  value: Json;
  updated_at: string;
  updated_by: string | null;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      products: Table<ProductRow, "slug" | "title" | "category">;
      suppliers: Table<SupplierRow, "name">;
      customers: Table<CustomerRow, "name">;
      ad_channels: Table<AdChannelRow, "name" | "platform">;
      collections: Table<CollectionRow, "slug" | "title">;
      collection_items: Table<CollectionItemRow, "collection_id" | "position">;
      orders: Table<OrderRow, "user_id">;
      order_items: Table<
        OrderItemRow,
        "order_id" | "title",
        [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ]
      >;
      page_views: Table<PageViewRow, "path">;
      profiles: Table<ProfileRow, "id">;
      user_roles: Table<UserRoleRow, "user_id" | "role">;
      opportunity_findings: Table<OpportunityRow, "title" | "source">;
      store_settings: Table<StoreSettingRow, "key" | "value">;
      product_supplier_links: Table<ProductSupplierLinkRow, "product_id" | "supplier_id">;
      supplier_credentials: Table<SupplierCredentialRow, "provider" | "access_token">;
      agent_settings: Table<AgentSettingsRow, "agent">;
      agent_runs: Table<AgentRunRow, "agent" | "trigger">;
      agent_actions: Table<AgentActionRow, "agent" | "op" | "entity" | "status">;
      marketing_content: Table<MarketingContentRow, "kind" | "channel" | "title">;
      agent_plans: Table<AgentPlanRow, "agent" | "kind" | "title">;
      agent_memory: Table<AgentMemoryRow, "key" | "value">;
    };
    Views: { [_ in never]: never };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      owner_exists: { Args: never; Returns: boolean };
      place_order: {
        Args: { _items: Json; _shipping: Json; _notes?: string | null };
        Returns: string;
      };
      cancel_my_email_change_request: { Args: { _id: string }; Returns: undefined };
      order_supplier_refs: {
        Args: { _product_ids: string[] };
        Returns: {
          product_id: string;
          provider_key: string;
          external_product_id: string;
          external_variants: Json;
        }[];
      };
    };
    Enums: { app_role: AppRole };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
