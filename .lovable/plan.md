# Small-business site builder — v1 plan

A multi-tenant app where signed-in users build small business sites by dragging blocks in Puck, edit text inline with Tiptap, pick a theme, and publish to a public `/s/:slug` URL.

## ⚠️ Heads-up on Better Auth

Better Auth needs a direct Postgres connection. The runtime here is Cloudflare Workers (TanStack Start SSR), which can't open raw `pg` TCP sockets. Two viable paths:

- **A. Better Auth + Supabase Postgres via HTTP driver** (`@better-auth/adapter-drizzle` + Drizzle + `postgres` over Supabase pooler with `prepare:false`, or Neon/Hyperdrive). Works, but Lovable Cloud doesn't expose the raw connection string to the Worker by default — you'd need to add `DATABASE_URL` as a secret pointing at the Cloud's Postgres (or a Neon DB you own).
- **B. Lovable Cloud auth (Supabase Auth)** — already wired, zero config, same Postgres, RLS-ready. Strongly recommended for v1; you can swap to Better Auth later (auth is one module).

I'll proceed assuming **A**. If `DATABASE_URL` isn't available at build/runtime, I'll fall back to B and flag it.

## Architecture

```text
src/
  routes/
    __root.tsx
    index.tsx                    # marketing / login CTA
    auth.tsx                     # Better Auth sign-in/up (email + password)
    _authenticated/
      route.tsx                  # gate
      dashboard.index.tsx        # list of user's sites + "New site"
      sites.$siteId.edit.tsx     # Puck editor + theme panel
    s.$slug.tsx                  # PUBLIC render route (SSR)
    api/auth/$.ts                # Better Auth handler
  lib/
    auth.ts                      # Better Auth server config
    auth-client.ts               # better-auth/react client
    sites.functions.ts           # createServerFn: list/get/create/save/publish
    render/
      blocks.tsx                 # Puck config: shared block components
      theme.tsx                  # theme tokens -> CSS vars
  db/
    schema.ts                    # Drizzle: users, sessions, accounts (BA), sites
    client.ts                    # postgres-js + drizzle (server-only)
```

## Database (Drizzle migrations)

- Better Auth tables: `user`, `session`, `account`, `verification` (per BA schema).
- `sites`:
  - `id uuid pk`
  - `owner_id` → `user.id` cascade
  - `slug citext unique`
  - `name text`
  - `theme jsonb` (preset key + token overrides)
  - `data jsonb` (Puck `{ content, root, zones }`)
  - `published_data jsonb` nullable (last published snapshot)
  - `published_at timestamptz` nullable
  - `created_at` / `updated_at`

Public render reads `published_data` only — drafts stay private. No RLS needed (Better Auth + server fns enforce ownership in queries).

## Puck blocks (v1)

Six blocks, each a React component + Puck config (fields → form schema):

1. **Hero** — eyebrow, title, subtitle, CTA label+href, bg image, alignment. Title/subtitle via Tiptap.
2. **Services** — repeating items `{ name, description, price }`. Descriptions via Tiptap.
3. **Pricing** — tier cards `{ name, price, features[], cta }`.
4. **ContactForm** — fields config; posts to a server fn that stores submissions in a `submissions` table linked to `site_id`.
5. **BookingCTA** — title, subtitle, external booking URL, button label.
6. **Map** — address + embedded Google Maps iframe (no API key needed for basic embed).

Shared `RichText` component wraps `@tiptap/react` + StarterKit + Link. Read-only on the public render route (Tiptap `editable:false`), editable inside Puck.

## Theming

`theme.tokens` → CSS variables injected on the site root:
- `--brand`, `--brand-fg`, `--bg`, `--fg`, `--muted`, `--radius`, `--font-sans`.
- Preset: **Barber dark** (`#0a0a0a / #1a1a1a / #d4af37 / #f5f5f5`).
- Side panel in editor: color pickers + radius + font select. Stored on `sites.theme`.

## Editor flow

- `/dashboard` → cards for each site + "Create site" (asks for name + slug).
- `/sites/:id/edit`:
  - Left: Puck component palette.
  - Center: Puck canvas (autosave debounced 800ms via `saveSite` server fn).
  - Right: Puck fields panel + a **Theme** tab.
  - Top bar: site name, slug, **Preview** (`/s/:slug?draft=token`), **Publish** (copies `data` → `published_data`, stamps `published_at`).

## Public render route `/s/$slug`

- `loader`: calls public server fn `getPublishedSite({ slug })` (publishable client + safe column projection). Returns 404 if not published.
- Renders `<Puck.Render config={puckConfig} data={published_data} />` inside a `<ThemeProvider tokens={theme}>` wrapper.
- `head()` derives `<title>` and meta description from Hero block or site name.
- SSR on; cacheable.

## Packages to add

`better-auth`, `@better-auth/cli`, `drizzle-orm`, `drizzle-kit`, `postgres`, `@measured/puck`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `zod`.

## What v1 does NOT include (for later turns)

- Multiple pages per site (single page only).
- Custom domains.
- Image uploads (use URL fields for now — storage comes next).
- Additional themes beyond Barber dark.
- Gallery/Testimonials/FAQ/Team/Menu/etc. blocks.
- Google OAuth (email/password only in v1; BA Google requires extra config).

## One blocker to confirm before I build

I need a Postgres URL the Worker can reach. Options:
1. You provide a `DATABASE_URL` secret (Neon/Supabase pooler URL — fastest, recommended).
2. I fall back to Lovable Cloud auth (Supabase Auth) and keep the rest of the plan identical.

Reply with **(1) I'll provide DATABASE_URL**, **(2) fall back to Cloud auth**, or **(3) proceed and let me know exactly what URL format you need** and I'll start scaffolding the non-auth pieces in parallel.