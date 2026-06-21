import { sql } from "./client.server";

let initialized: Promise<void> | null = null;

const DDL = `
-- ============================================================
-- Better Auth
-- ============================================================
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Sites & pages
-- ============================================================
CREATE TABLE IF NOT EXISTS "sites" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_data JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "site_pages" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  is_home BOOLEAN NOT NULL DEFAULT FALSE,
  nav_label TEXT,
  nav_order INTEGER NOT NULL DEFAULT 0,
  show_in_nav BOOLEAN NOT NULL DEFAULT TRUE,
  seo_title TEXT,
  seo_description TEXT,
  puck_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_data JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_pages_site_id_path_key ON "site_pages" (site_id, path);
CREATE TABLE IF NOT EXISTS "page_versions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES "site_pages"(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT,
  source TEXT NOT NULL DEFAULT 'publish',
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  puck_data JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS page_versions_page_idx ON "page_versions" (page_id, version_number);
CREATE TABLE IF NOT EXISTS "site_submissions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Navigation
-- ============================================================
CREATE TABLE IF NOT EXISTS "site_menus" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "site_menus" ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS site_menus_site_id_key_key ON "site_menus" (site_id, key);
CREATE TABLE IF NOT EXISTS "site_menu_items" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES "site_menus"(id) ON DELETE CASCADE,
  parent_id UUID,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'page',
  page_id UUID REFERENCES "site_pages"(id) ON DELETE SET NULL,
  url TEXT,
  anchor TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Modules
-- ============================================================
CREATE TABLE IF NOT EXISTS "modules" (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "module_installs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES "modules"(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_installs_site_module_key ON "module_installs" (site_id, module_key);

-- ============================================================
-- Collections
-- ============================================================
CREATE TABLE IF NOT EXISTS "collections" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  module_key TEXT,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  storage TEXT NOT NULL DEFAULT 'jsonb',
  physical_table TEXT,
  system BOOLEAN NOT NULL DEFAULT FALSE,
  singleton BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS collections_site_id_key_key ON "collections" (site_id, key);
CREATE TABLE IF NOT EXISTS "collection_fields" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES "collections"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  "unique" BOOLEAN NOT NULL DEFAULT FALSE,
  default_value JSONB,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  ui JSONB NOT NULL DEFAULT '{}'::jsonb,
  relation JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_fields_coll_id_key_key ON "collection_fields" (collection_id, key);
CREATE TABLE IF NOT EXISTS "collection_records" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES "collections"(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'published',
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS collection_records_site_coll_idx ON "collection_records" (site_id, collection_id);
CREATE INDEX IF NOT EXISTS collection_records_data_gin ON "collection_records" USING GIN (data);
CREATE TABLE IF NOT EXISTS "collection_relationships" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  from_collection_id UUID NOT NULL,
  from_field_key TEXT NOT NULL,
  to_collection_id UUID NOT NULL,
  relation_type TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- Permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS "roles" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  system BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS roles_site_id_key_key ON "roles" (site_id, key);
CREATE TABLE IF NOT EXISTS "permissions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES "roles"(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  action TEXT NOT NULL,
  condition JSONB
);

-- ============================================================
-- Component bindings
-- ============================================================
CREATE TABLE IF NOT EXISTS "component_bindings" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  page_id UUID REFERENCES "site_pages"(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL,
  component_type TEXT NOT NULL,
  binding_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  event_type TEXT,
  action_type TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Events, actions, workflows
-- ============================================================
CREATE TABLE IF NOT EXISTS "event_definitions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES "sites"(id) ON DELETE CASCADE,
  module_key TEXT,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "action_definitions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES "sites"(id) ON DELETE CASCADE,
  module_key TEXT,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  executor_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "events" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "workflows" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "workflow_runs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES "workflows"(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  trigger_event_id UUID,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS "workflow_step_runs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id UUID NOT NULL REFERENCES "workflow_runs"(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL,
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS "workflow_schedules" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES "workflows"(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  cron TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS "integration_providers" (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  config_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  system BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS "integration_accounts" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL REFERENCES "integration_providers"(key),
  name TEXT NOT NULL,
  encrypted_credentials TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "custom_http_integrations" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "custom_http_actions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES "custom_http_integrations"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS webhook_endpoints_site_key_key ON "webhook_endpoints" (site_id, key);
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  endpoint_id UUID REFERENCES "webhook_endpoints"(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Commerce
-- ============================================================
CREATE TABLE IF NOT EXISTS "products" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description_html TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  inventory_quantity INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS products_site_id_slug_key ON "products" (site_id, slug);
CREATE TABLE IF NOT EXISTS "customers" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_site_id_email_key ON "customers" (site_id, email);
CREATE TABLE IF NOT EXISTS "orders" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES "customers"(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "order_items" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES "orders"(id) ON DELETE CASCADE,
  product_id UUID REFERENCES "products"(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- Blog
-- ============================================================
CREATE TABLE IF NOT EXISTS "blog_posts" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_html TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  cover_image_key TEXT,
  seo_title TEXT,
  seo_description TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_site_id_slug_key ON "blog_posts" (site_id, slug);
CREATE TABLE IF NOT EXISTS "blog_categories" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_site_id_slug_key ON "blog_categories" (site_id, slug);

-- ============================================================
-- Forms
-- ============================================================
CREATE TABLE IF NOT EXISTS "forms" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "form_submissions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  form_id UUID REFERENCES "forms"(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Analytics
-- ============================================================
CREATE TABLE IF NOT EXISTS "analytics_events" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  page_id UUID REFERENCES "site_pages"(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  referrer TEXT,
  path TEXT NOT NULL,
  country TEXT,
  device_type TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "analytics_daily" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  page_id UUID REFERENCES "site_pages"(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  form_submissions INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- AI
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_generations" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  proposed_patch JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "ai_patch_applications" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES "ai_generations"(id) ON DELETE CASCADE,
  applied_by TEXT NOT NULL,
  before_snapshot JSONB,
  after_snapshot JSONB,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Media
-- ============================================================
CREATE TABLE IF NOT EXISTS "media_assets" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES "sites"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES "sites"(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS "templates" (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  preview TEXT,
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export function ensureSchema(): Promise<void> {
  if (!initialized) {
    initialized = sql.unsafe(DDL).then(() => undefined).catch((err) => {
      initialized = null;
      throw err;
    });
  }
  return initialized;
}
