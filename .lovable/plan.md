# Unified Product & Architecture Plan

> Canonical roadmap. MVP target: **multi-page small-business website** (Home / About / Services / Contact + blog). Commerce, workflows, AI builder come later.

## 1. Product Vision

A hosted platform where users can create small-business websites, simple stores, order platforms, blogs, forms, landing pages, and automation-backed admin panels.

Simple for normal users:
- Create a site, pick a template, edit pages visually.
- Add products, services, blog posts, forms, orders.
- Manage customers and submissions.
- Connect workflows and integrations.
- See analytics.
- Use AI to generate and safely modify pages, content, workflows, and modules.

Under the hood, generic like Directus: collections, fields, records, relations, permissions, generated admin screens, module/plugin system, workflows, events/actions, integrations, component/data bindings.

Core principle: **products, orders, blog, forms, analytics, payments, workflows are modules. Collections, fields, records, permissions, events, actions, pages, navigation, bindings are core primitives.**

## 2. MVP Positioning

Position as **a small-business website and order platform with built-in content, commerce, workflows, and AI assistance** — not as a generic backend builder.

Initial use cases: single-product store, local service site, restaurant/café menu, barber/salon booking, link-in-bio, creator landing, small blog, form-based quote/order.

**First demo target: multi-page small business** (Home, About, Services, Contact, Blog).

## 3. Core Stack

- **App framework**: TanStack Start + TanStack Router + TanStack Query + React + TypeScript + Vite.
- **UI**: Tailwind v4, shadcn/ui, Radix, lucide-react, recharts, sonner.
- **Auth**: Better Auth + Drizzle adapter (email/password first; OAuth, orgs, Stripe billing plugin, 2FA later).
- **DB**: Postgres + Drizzle ORM + Drizzle Kit migrations + Zod.
- **Site builder**: Puck + Tiptap; theme tokens; Puck data stored as JSONB.
- **Workflow builder**: React Flow (canvas only) + Trigger.dev (execution, retries, schedules, logs).
- **AI builder**: guarded layer — AI generates Puck JSON, Tiptap content, theme tokens, collection definitions, product copy, blog drafts, form schemas, workflow definitions, page plans, navigation. **Never** raw SQL, arbitrary backend code, secrets, payment logic, unreviewed permissions, unsafe JS.

Reference repos: `nobruf/shadcn-next-workflows`, `azariuskr/template-main`, `noorjsdivs/webflow-app-yt`, `dyad-sh/dyad`.

## 4. High-Level Architecture

```
Platform App: marketing, auth, dashboards, site builder, module admin,
              workflow builder, integrations, analytics, AI assistant.

Core Platform: auth, workspaces, sites, members, pages, navigation,
               modules, collections, fields, records, permissions,
               events, actions, workflows, integrations, component
               bindings, theme system, versioning, AI patch system.

Runtime: public route resolver, page renderer, dynamic collection
         renderer, event emitter, workflow runner, integration
         executor, analytics tracker, background jobs.

Modules: commerce, blog, forms, customers, analytics, payments,
         integrations, workflows, AI assistant.
```

## 5. Core Product Model

- **Workspace** → members, billing, sites.
- **Site** → pages, theme, navigation, modules, collections, workflows, integrations, analytics, admin.
- **Page** → Puck document + routing metadata. Types: `static`, `collection_list`, `collection_detail`, `system`, `redirect`.
- **Navigation** → separate metadata layer (menus: header / footer / mobile / custom). Puck header/footer blocks read from menus.
- **Module** → plugin contributing models, admin views, Puck blocks, events, actions, workflows, permissions.
- **Collection** → generic data model (products, orders, blog_posts, testimonials, menu_items, etc.).
- **Field** → text, textarea, rich_text, number, money, boolean, select, date, datetime, media, relation, json, slug, email, url, status.
- **Record** → hybrid: system/business modules use physical tables; custom user collections use generic JSONB records.
- **Workflow** → visual automation (nodes + edges) triggered by events; steps execute registered actions.

## 6. Database Layer

Postgres + Drizzle. **Use migrations, not `ensureSchema()` in production.**

Tables (grouped):
- **Auth (Better Auth)**: `user`, `session`, `account`, `verification`.
- **Workspaces/sites**: `workspaces`, `workspace_members`, `sites`, `site_members`.
- **Pages/nav**: `site_pages` (with `published_puck_data`, `collection_key`, `route_param`), `page_versions`, `site_menus`, `site_menu_items`.
- **Modules**: `modules`, `module_installs`, `module_dependencies`.
- **Generic engine**: `collections`, `collection_fields`, `collection_records` (JSONB + GIN index), `collection_relationships`.
- **Permissions**: `roles`, `permissions` (resource_type + action + condition).
- **Bindings**: `component_bindings` (data_source / event / action).
- **Events/actions**: `event_definitions`, `action_definitions`, `events`.
- **Workflows**: `workflows`, `workflow_versions`, `workflow_runs`, `workflow_step_runs`, `workflow_schedules`.
- **Integrations**: `integration_providers`, `integration_accounts`, `custom_http_integrations`, `custom_http_actions`.
- **Commerce (physical)**: `products`, `customers`, `orders`, `order_items`.
- **Blog (physical)**: `blog_posts`, `blog_categories`.
- **Forms**: `forms`, `form_submissions`.
- **Analytics**: `analytics_events`, `analytics_daily`.
- **AI**: `ai_generations`, `ai_patch_applications`.

(Full column definitions in source plan; see prior message in chat history for schemas.)

## 7. Module System

```ts
type PlatformModule = {
  key: string;
  name: string;
  version: string;
  collections?: CollectionDefinition[];
  physicalTables?: string[];
  adminViews?: AdminViewDefinition[];
  puckBlocks?: PuckBlockDefinition[];
  events?: EventDefinition[];
  actions?: ActionDefinition[];
  workflowTemplates?: WorkflowTemplate[];
  permissions?: PermissionDefinition[];
  install?: (ctx: InstallContext) => Promise<void>;
  uninstall?: (ctx: InstallContext) => Promise<void>;
};
```

Modules: **commerce**, **blog**, **forms**, **analytics**, **workflows**, **integrations**, **payments-stripe**.

## 8. Project Layout

```
src/
├── app/              router, start, query-client
├── routes/           __root, index, auth, _authenticated/*, s/$siteSlug/$, api/*
├── db/               client.server, schema/*, migrations/
├── core/             auth, workspaces, sites, pages, navigation, modules,
│                     collections, permissions, events, actions, workflows,
│                     integrations, analytics, ai, storage
├── modules/          commerce, blog, forms, analytics, payments-stripe,
│                     integrations-http, workflows
├── components/       ui, layout, admin (DataTable, RecordForm, CollectionAdmin,
│                     FieldRenderer), builder (puck, theme, bindings),
│                     workflows (canvas, nodes, edges, panels), ai
├── server-fns/       sites, pages, navigation, collections, records,
│                     workflows, integrations, analytics, ai
├── trigger/          workflows, schedules, analytics, integrations
├── lib/              auth-client, utils, slug, sanitize, env, constants
└── styles.css
```

## 9. Public Route Resolver

Single catch-all: `/s/$siteSlug/$`. Later resolve by host for custom domains.

Flow: resolve site → try exact page match → try dynamic template (`/products/:slug`) → resolve collection record → render with `currentRecord` context. Supports static, dynamic product/blog pages, system pages, redirects.

## 10. Puck Builder

One page at a time. Edit `puck_data`, publish to `published_puck_data`.

Block categories: Layout, Content, Commerce, Blog, Forms, Navigation, Media, Social, Analytics, Custom collections.

Initial blocks: Hero, RichText, Image, VideoEmbed, Services, Pricing, Testimonials, FAQ, ContactForm, NewsletterForm, ProductGrid, ProductCard, ProductDetail, OrderForm, BlogList, BlogPost, Map, Header, Footer, NavMenu, Button, Section, Spacer.

Tiptap stores JSON; render sanitized HTML.

## 11. Generic Admin Renderer

Directus-like. Components: CollectionList, RecordCreate, RecordEdit, RecordDetail, RelationPicker, MediaField, RichTextField, StatusField, MoneyField, SlugField, JsonField, SelectField, RepeaterField.

Admin views declared via metadata so modules can register screens without handcoding.

## 12. Workflow Architecture

React Flow edits JSON only — never executes. Execution: event emitted → validate payload → match workflows → create `workflow_run` → Trigger.dev task runs steps → action registry executes each → log step runs → update status.

Initial nodes: Trigger, Condition, Delay, SendEmail, CallWebhook, CreateRecord, UpdateRecord, CreateOrder, UpdateOrderStatus, TrackAnalytics, RunIntegrationAction, End.

## 13. Integrations

Initial: Email, Webhook, Custom HTTP API, Stripe payment links. Later: Stripe Checkout, Google Sheets, Telegram/WhatsApp. **No arbitrary user backend code in MVP.**

## 14. AI Builder

AI modifies **metadata**, not source. Output types: `site_plan`, `page_patch`, `puck_data`, `theme_patch`, `collection_definition`, `workflow_definition`, `blog_draft`, `product_copy`, `form_schema`, `navigation_patch`.

Pipeline: prompt → structured JSON → validate (Zod/JSON Schema) → check module compatibility → diff/preview → user approves → save version → allow rollback.

Assistant UX inside builder: create page, improve section, generate product/blog page, build order workflow, create form, suggest navigation, make site more premium, explain workflow.

## 15. Security Rules

- Never trust Puck JSON or AI output blindly.
- Sanitize rich text (DOMPurify / isomorphic-dompurify).
- Validate all server function inputs with Zod.
- Site/workspace permission checks everywhere.
- Encrypt integration credentials.
- Don't expose secrets to workflows.
- No arbitrary code execution in MVP.
- Version before applying AI changes.
- Rate limiting, audit logs.

## 16. Build Phases

| # | Phase | Deliverable |
|---|---|---|
| 1 | Foundation | Auth, workspaces, sites, single-page Puck editor, theme, public render. |
| 2 | Pages & Navigation | Multi-page sites, menus, route resolver, page switcher. |
| 3 | Metadata Engine | Collections, fields, records, generic admin, basic permissions. |
| 4 | Modules | Module registry + installs; commerce, blog, forms, analytics scaffolds. |
| 5 | Commerce / Blog / Forms | Products, orders, customers, blog posts, forms, submissions, admin + Puck blocks. |
| 6 | Events & Workflows | Event/action registry, workflow schema, React Flow builder, Trigger.dev runner, logs, schedules. |
| 7 | Integrations | Webhooks, custom HTTP, email, Stripe payment links, credentials. |
| 8 | AI Builder | Assistant panel, generators (site/page/theme/workflow/collection), patch preview, approve/rollback. |
| 9 | Production Hardening | Migrations, audit logs, rate limits, sanitization, error reporting, retries, secret encryption, billing, rollups, backups, observability. |

## 17. Timeline (with strong AI tooling)

- Prototype: 4–6 weeks
- Usable MVP: 8–12 weeks
- Paid beta: 3–5 months
- Robust v1: 6–9 months

First paid beta includes: sites, pages, navigation, Puck builder, themes, blog, products, orders, forms, customers, basic analytics, simple workflows, webhook/email integrations, AI page/content generation.

**Postpone**: full custom code execution, full integration marketplace, advanced Stripe Connect, advanced permissions UI, complex schema migration engine, app marketplace, white-label deployments.

## 18. Key Architectural Rule

```
Modules define collections, fields, admin views, blocks, events, actions, permissions.
Pages use Puck blocks.
Blocks bind to collections, records, events, actions.
Events trigger workflows.
Workflows execute actions via Trigger.dev.
Integrations are action providers.
AI proposes metadata patches.
Validators protect the system before anything is saved.
```

---

## Current State (as of save)

- **Phase 1** partially complete: TanStack Start app, Better Auth (email/password) with Drizzle adapter, Postgres via `DATABASE_URL`, dashboard, create site, single-page Puck editor with Tiptap, barber-dark theme, public `/s/$slug` render. Schema bootstrapped via `src/db/bootstrap.server.ts` (needs migration to Drizzle Kit for prod).
- **Phase 2–6 done (lite)**: multi-page sites + menus, blog, forms, commerce (products/orders/customers), event-driven workflows with inline runner.
- **Phase 7-lite (Integrations)** done: `integration_accounts` with AES-256-GCM encrypted credentials (`src/lib/crypto.server.ts`), providers seeded (webhook, email_resend, http_generic), executor in `src/lib/integrations.server.ts`, admin UI at `/sites/$siteId/integrations`, and a new workflow step type `integration_call` wired through the runner.
- **Next up**: Phase 8 — AI builder (page/theme/copy generation with patch preview & rollback), then Phase 9 hardening (Drizzle Kit migrations, audit logs, rate limits).
