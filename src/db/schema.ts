import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  uuid,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// Better Auth tables
// ============================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================
// Core: sites & pages
// ============================================================

export type PuckData = {
  content: Array<{ type: string; props: Record<string, any> }>;
  root: { props: Record<string, any> };
  zones?: Record<string, any>;
};

export type SiteThemeJson = {
  preset?: string;
  tokens: {
    bg: string;
    surface: string;
    brand: string;
    fg: string;
    muted: string;
    radius: string;
    font: string;
  };
};

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  theme: jsonb("theme").$type<SiteThemeJson>().notNull().default(sql`'{}'::jsonb`),
  data: jsonb("data").$type<PuckData>().notNull().default(sql`'{}'::jsonb`),
  publishedData: jsonb("published_data").$type<PuckData | null>(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sitePages = pgTable(
  "site_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    path: text("path").notNull(),
    isHome: boolean("is_home").notNull().default(false),
    navLabel: text("nav_label"),
    navOrder: integer("nav_order").notNull().default(0),
    showInNav: boolean("show_in_nav").notNull().default(true),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    puckData: jsonb("puck_data").$type<PuckData>().notNull().default(sql`'{}'::jsonb`),
    publishedData: jsonb("published_data").$type<PuckData | null>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteSlugPath: uniqueIndex("site_pages_site_id_path_key").on(t.siteId, t.path),
  }),
);

export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id").notNull().references(() => sitePages.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    label: text("label"),
    source: text("source").notNull().default("publish"), // publish | manual | revert | autosave
    title: text("title").notNull(),
    path: text("path").notNull(),
    puckData: jsonb("puck_data").$type<PuckData>().notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pageIdx: index("page_versions_page_idx").on(t.pageId, t.versionNumber),
  }),
);

export const siteSubmissions = pgTable("site_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Navigation
// ============================================================

export const siteMenus = pgTable(
  "site_menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // "primary" | "footer" | custom
    label: text("label").notNull(),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteKey: uniqueIndex("site_menus_site_id_key_key").on(t.siteId, t.key),
  }),
);

export type SiteMenuItemType = "page" | "url" | "anchor";

export const siteMenuItems = pgTable("site_menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  menuId: uuid("menu_id").notNull().references(() => siteMenus.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  label: text("label").notNull(),
  type: text("type").notNull().default("page"), // page | url | anchor
  pageId: uuid("page_id").references(() => sitePages.id, { onDelete: "set null" }),
  url: text("url"),
  anchor: text("anchor"),
  sortOrder: integer("sort_order").notNull().default(0),
  openInNewTab: boolean("open_in_new_tab").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Module system
// ============================================================

export const modules = pgTable("modules", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  system: boolean("system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moduleInstalls = pgTable(
  "module_installs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    moduleKey: text("module_key").notNull().references(() => modules.key, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteModule: uniqueIndex("module_installs_site_module_key").on(t.siteId, t.moduleKey),
  }),
);

// ============================================================
// Generic collections (Directus-style)
// ============================================================

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    moduleKey: text("module_key"),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    storage: text("storage").notNull().default("jsonb"), // jsonb | physical
    physicalTable: text("physical_table"),
    system: boolean("system").notNull().default(false),
    singleton: boolean("singleton").notNull().default(false),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteKey: uniqueIndex("collections_site_id_key_key").on(t.siteId, t.key),
  }),
);

export const collectionFields = pgTable(
  "collection_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull(),
    required: boolean("required").notNull().default(false),
    unique: boolean("unique").notNull().default(false),
    defaultValue: jsonb("default_value"),
    validation: jsonb("validation").notNull().default(sql`'{}'::jsonb`),
    ui: jsonb("ui").notNull().default(sql`'{}'::jsonb`),
    relation: jsonb("relation"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    collKey: uniqueIndex("collection_fields_coll_id_key_key").on(t.collectionId, t.key),
  }),
);

export const collectionRecords = pgTable(
  "collection_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("published"),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    siteColl: index("collection_records_site_coll_idx").on(t.siteId, t.collectionId),
  }),
);

export const collectionRelationships = pgTable("collection_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  fromCollectionId: uuid("from_collection_id").notNull(),
  fromFieldKey: text("from_field_key").notNull(),
  toCollectionId: uuid("to_collection_id").notNull(),
  relationType: text("relation_type").notNull(),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
});

// ============================================================
// Permissions
// ============================================================

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    system: boolean("system").notNull().default(false),
  },
  (t) => ({ siteKey: uniqueIndex("roles_site_id_key_key").on(t.siteId, t.key) }),
);

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(),
  resourceKey: text("resource_key").notNull(),
  action: text("action").notNull(),
  condition: jsonb("condition"),
});

// ============================================================
// Component bindings
// ============================================================

export const componentBindings = pgTable("component_bindings", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").references(() => sitePages.id, { onDelete: "cascade" }),
  componentId: text("component_id").notNull(),
  componentType: text("component_type").notNull(),
  bindingType: text("binding_type").notNull(), // data_source | event | action
  sourceType: text("source_type").notNull(),   // collection | integration | workflow | system
  sourceKey: text("source_key").notNull(),
  eventType: text("event_type"),
  actionType: text("action_type"),
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Events, actions & workflows
// ============================================================

export const eventDefinitions = pgTable("event_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
  moduleKey: text("module_key"),
  type: text("type").notNull(),
  label: text("label").notNull(),
  payloadSchema: jsonb("payload_schema").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const actionDefinitions = pgTable("action_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
  moduleKey: text("module_key"),
  type: text("type").notNull(),
  label: text("label").notNull(),
  inputSchema: jsonb("input_schema").notNull().default(sql`'{}'::jsonb`),
  outputSchema: jsonb("output_schema").notNull().default(sql`'{}'::jsonb`),
  executorKey: text("executor_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  triggerType: text("trigger_type").notNull(),
  triggerConfig: jsonb("trigger_config").notNull().default(sql`'{}'::jsonb`),
  graph: jsonb("graph").notNull().default(sql`'{"nodes":[],"edges":[]}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  triggerEventId: uuid("trigger_event_id"),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const workflowStepRuns = pgTable("workflow_step_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  stepId: text("step_id").notNull(),
  actionType: text("action_type").notNull(),
  status: text("status").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const workflowSchedules = pgTable("workflow_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  cron: text("cron").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Integrations
// ============================================================

export const integrationProviders = pgTable("integration_providers", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  authType: text("auth_type").notNull(),
  configSchema: jsonb("config_schema").notNull().default(sql`'{}'::jsonb`),
  actionSchema: jsonb("action_schema").notNull().default(sql`'{}'::jsonb`),
  system: boolean("system").notNull().default(false),
});

export const integrationAccounts = pgTable("integration_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  providerKey: text("provider_key").notNull().references(() => integrationProviders.key),
  name: text("name").notNull(),
  encryptedCredentials: text("encrypted_credentials"),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customHttpIntegrations = pgTable("custom_http_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  authConfig: jsonb("auth_config").notNull().default(sql`'{}'::jsonb`),
  headers: jsonb("headers").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customHttpActions = pgTable("custom_http_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  integrationId: uuid("integration_id").notNull().references(() => customHttpIntegrations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  inputSchema: jsonb("input_schema").notNull().default(sql`'{}'::jsonb`),
  outputSchema: jsonb("output_schema").notNull().default(sql`'{}'::jsonb`),
  mapping: jsonb("mapping").notNull().default(sql`'{}'::jsonb`),
});

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    secretHash: text("secret_hash").notNull(),
    eventType: text("event_type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteKey: uniqueIndex("webhook_endpoints_site_key_key").on(t.siteId, t.key) }),
);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  endpointId: uuid("endpoint_id").references(() => webhookEndpoints.id, { onDelete: "set null" }),
  direction: text("direction").notNull(), // inbound | outbound
  status: text("status").notNull(),
  payload: jsonb("payload"),
  responseStatus: integer("response_status"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Commerce
// ============================================================

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    descriptionHtml: text("description_html"),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    images: jsonb("images").notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("draft"),
    inventoryQuantity: integer("inventory_quantity"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteSlug: uniqueIndex("products_site_id_slug_key").on(t.siteId, t.slug) }),
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteEmail: uniqueIndex("customers_site_id_email_key").on(t.siteId, t.email) }),
);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  totalCents: integer("total_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
});

// ============================================================
// Blog
// ============================================================

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    contentJson: jsonb("content_json").notNull().default(sql`'{}'::jsonb`),
    contentHtml: text("content_html"),
    status: text("status").notNull().default("draft"),
    coverImageKey: text("cover_image_key"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ siteSlug: uniqueIndex("blog_posts_site_id_slug_key").on(t.siteId, t.slug) }),
);

export const blogCategories = pgTable(
  "blog_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => ({ siteSlug: uniqueIndex("blog_categories_site_id_slug_key").on(t.siteId, t.slug) }),
);

// ============================================================
// Forms
// ============================================================

export const forms = pgTable("forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  schema: jsonb("schema").notNull().default(sql`'{}'::jsonb`),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  formId: uuid("form_id").references(() => forms.id, { onDelete: "set null" }),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Analytics
// ============================================================

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").references(() => sitePages.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  referrer: text("referrer"),
  path: text("path").notNull(),
  country: text("country"),
  deviceType: text("device_type"),
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsDaily = pgTable("analytics_daily", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").references(() => sitePages.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  views: integer("views").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  orders: integer("orders").notNull().default(0),
  formSubmissions: integer("form_submissions").notNull().default(0),
  revenueCents: integer("revenue_cents").notNull().default(0),
});

// ============================================================
// AI patch system
// ============================================================

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  proposedPatch: jsonb("proposed_patch").notNull().default(sql`'{}'::jsonb`),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiPatchApplications = pgTable("ai_patch_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  generationId: uuid("generation_id").notNull().references(() => aiGenerations.id, { onDelete: "cascade" }),
  appliedBy: text("applied_by").notNull(),
  beforeSnapshot: jsonb("before_snapshot"),
  afterSnapshot: jsonb("after_snapshot"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Media library
// ============================================================

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  publicUrl: text("public_url").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Audit log
// ============================================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Templates (onboarding)
// ============================================================

export const templates = pgTable("templates", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  preview: text("preview"),
  manifest: jsonb("manifest").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Type exports
// ============================================================

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type SitePage = typeof sitePages.$inferSelect;
export type NewSitePage = typeof sitePages.$inferInsert;
export type SiteMenu = typeof siteMenus.$inferSelect;
export type SiteMenuItem = typeof siteMenuItems.$inferSelect;
