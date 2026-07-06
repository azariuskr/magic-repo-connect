import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Known Puck block types that AI is allowed to emit.
const ALLOWED_BLOCKS = ["Hero", "Services", "Pricing", "ContactForm", "BookingCTA", "Map", "Footer"] as const;
type AllowedBlock = (typeof ALLOWED_BLOCKS)[number];

const PAGE_SCHEMA_HINT = `{
  "content": [
    { "type": "Hero",        "props": { "eyebrow"?: str, "title": str, "subtitleHtml"?: html, "ctaLabel"?: str, "ctaHref"?: str, "align"?: "center"|"left" } },
    { "type": "Services",    "props": { "title": str, "items": [{ "name": str, "descriptionHtml"?: html, "price"?: str }] } },
    { "type": "Pricing",     "props": { "title": str, "tiers": [{ "name": str, "price": str, "features": "one per line", "ctaLabel"?: str, "ctaHref"?: str, "highlight"?: bool }] } },
    { "type": "ContactForm", "props": { "title"?: str, "subtitle"?: str } },
    { "type": "BookingCTA",  "props": { "title"?: str, "subtitle"?: str, "ctaLabel"?: str, "ctaHref"?: str } },
    { "type": "Map",         "props": { "title"?: str, "address": str } },
    { "type": "Footer",      "props": { "businessName": str, "tagline"?: str, "address"?: str, "phone"?: str, "email"?: str, "hours"?: str, "socialHtml"?: html } }
  ],
  "root": { "props": {} }
}`;

const THEME_SCHEMA_HINT = `{ "tokens": { "bg": "#hex", "surface": "#hex", "brand": "#hex", "fg": "#hex", "muted": "#hex", "radius": "0.5rem", "font": "system-ui" } }`;

// ---------- Auth helpers (mirror pages.functions) ----------

async function requireSession() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { auth } = await import("@/lib/auth.server");
  const req = getRequest();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

async function requireOwnedSite(siteId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site };
}

async function requireOwnedPage(pageId: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, sitePages } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [page] = await db.select().from(sitePages).where(eq(sitePages.id, pageId)).limit(1);
  if (!page) throw new Error("Not found");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, page.siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site, page };
}

// ---------- AI Gateway call ----------

async function callGateway(system: string, prompt: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("AI returned empty response");
  return content;
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Strip fences / prose
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try { return JSON.parse(fence[1]); } catch { /* noop */ }
    }
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error("AI response was not valid JSON");
  }
}

// ---------- Validators ----------

function validatePagePatch(raw: unknown): { content: Array<{ type: AllowedBlock; props: Record<string, unknown> }>; root: { props: Record<string, unknown> } } {
  const parsed = z
    .object({
      content: z
        .array(z.object({ type: z.string(), props: z.record(z.unknown()).default({}) }))
        .max(30),
      root: z.object({ props: z.record(z.unknown()).default({}) }).default({ props: {} }),
    })
    .parse(raw);
  const filtered = parsed.content.filter((b): b is { type: AllowedBlock; props: Record<string, unknown> } =>
    (ALLOWED_BLOCKS as readonly string[]).includes(b.type),
  );
  if (filtered.length === 0) throw new Error("AI patch contained no supported blocks");
  return { content: filtered, root: parsed.root };
}



function validateThemePatch(raw: unknown): { tokens: Record<string, string> } {
  const parsed = z
    .object({
      tokens: z.object({
        bg: z.string(),
        surface: z.string(),
        brand: z.string(),
        fg: z.string(),
        muted: z.string(),
        radius: z.string().default("0.5rem"),
        font: z.string().default("system-ui"),
      }),
    })
    .parse(raw);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  for (const k of ["bg", "surface", "brand", "fg", "muted"] as const) {
    if (!hex.test(parsed.tokens[k])) throw new Error(`Invalid color for ${k}: ${parsed.tokens[k]}`);
  }
  return parsed as { tokens: Record<string, string> };
}

// ---------- Serialization ----------

export type SerializedGeneration = {
  id: string;
  siteId: string;
  userId: string;
  prompt: string;
  targetType: string;
  targetId: string | null;
  status: string;
  createdAt: string;
  proposedPatchJson: string;
};

function serializeGen(row: {
  id: string;
  siteId: string;
  userId: string;
  prompt: string;
  targetType: string;
  targetId: string | null;
  status: string;
  createdAt: Date;
  proposedPatch: unknown;
}): SerializedGeneration {
  return {
    id: row.id,
    siteId: row.siteId,
    userId: row.userId,
    prompt: row.prompt,
    targetType: row.targetType,
    targetId: row.targetId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    proposedPatchJson: JSON.stringify(row.proposedPatch ?? {}),
  };
}

// ---------- Server functions ----------

export const generatePagePatch = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ pageId: z.string().uuid(), prompt: z.string().trim().min(4).max(2000) }).parse(input),
  )
  .handler(async ({ data }): Promise<SerializedGeneration> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations } = await import("@/db/schema");
    await ensureSchema();
    const { user, site, page } = await requireOwnedPage(data.pageId);

    const system =
      `You are a website page generator. Return ONLY a JSON object that matches this shape (no prose, no markdown):\n${PAGE_SCHEMA_HINT}\n` +
      `Allowed block types: ${ALLOWED_BLOCKS.join(", ")}. Do not invent any other types.\n` +
      `Rich-text (*Html) fields use minimal HTML: <p>, <strong>, <em>, <a href>, <ul><li>, <h2>, <h3>. No scripts, no styles, no images.\n` +
      `Write concise, on-brand copy. Keep 3–7 sections total for a landing page.`;
    const userPrompt =
      `Business/site: ${site.name}\nPage: ${page.title} (${page.path})\n\nUser request: ${data.prompt}\n\nReturn the full new page JSON.`;

    const raw = await callGateway(system, userPrompt);
    const parsed = parseJsonLoose(raw);
    const { sanitizeHtmlPropsDeep } = await import("@/lib/sanitize.server");
    const patch = sanitizeHtmlPropsDeep(validatePagePatch(parsed));


    const [row] = await db
      .insert(aiGenerations)
      .values({
        siteId: site.id,
        userId: user.id,
        prompt: data.prompt,
        targetType: "page",
        targetId: data.pageId,
        proposedPatch: patch as unknown as Record<string, unknown>,
        status: "pending",
      })
      .returning();
    return serializeGen(row);
  });

export const generateThemePatch = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ siteId: z.string().uuid(), prompt: z.string().trim().min(4).max(1000) }).parse(input),
  )
  .handler(async ({ data }): Promise<SerializedGeneration> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations } = await import("@/db/schema");
    await ensureSchema();
    const { user, site } = await requireOwnedSite(data.siteId);

    const system =
      `You design website color themes. Return ONLY JSON matching:\n${THEME_SCHEMA_HINT}\n` +
      `Colors must be valid #hex. Ensure high contrast between fg and bg. radius like "0.5rem", font is a CSS font stack.`;
    const userPrompt = `Site: ${site.name}\nCurrent theme: ${JSON.stringify(site.theme)}\nRequest: ${data.prompt}`;

    const raw = await callGateway(system, userPrompt);
    const parsed = parseJsonLoose(raw);
    const patch = validateThemePatch(parsed);

    const [row] = await db
      .insert(aiGenerations)
      .values({
        siteId: site.id,
        userId: user.id,
        prompt: data.prompt,
        targetType: "theme",
        targetId: site.id,
        proposedPatch: patch as unknown as Record<string, unknown>,
        status: "pending",
      })
      .returning();
    return serializeGen(row);
  });

export const listGenerations = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ siteId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<SerializedGeneration[]> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedSite(data.siteId);
    const rows = await db
      .select()
      .from(aiGenerations)
      .where(eq(aiGenerations.siteId, data.siteId))
      .orderBy(desc(aiGenerations.createdAt))
      .limit(50);
    return rows.map(serializeGen);
  });

export const getGeneration = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<SerializedGeneration> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    const [gen] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, data.id)).limit(1);
    if (!gen) throw new Error("Not found");
    await requireOwnedSite(gen.siteId);
    return serializeGen(gen);
  });


export const rejectGeneration = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    const [gen] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, data.id)).limit(1);
    if (!gen) throw new Error("Not found");
    await requireOwnedSite(gen.siteId);
    await db.update(aiGenerations).set({ status: "rejected" }).where(eq(aiGenerations.id, data.id));
    return { ok: true };
  });

export const applyGeneration = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations, aiPatchApplications, sites, sitePages, pageVersions } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    await ensureSchema();

    const [gen] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, data.id)).limit(1);
    if (!gen) throw new Error("Not found");
    if (gen.status !== "pending") throw new Error(`Generation is ${gen.status}`);
    const { user, site } = await requireOwnedSite(gen.siteId);

    if (gen.targetType === "page") {
      if (!gen.targetId) throw new Error("Missing page target");
      const [page] = await db.select().from(sitePages).where(eq(sitePages.id, gen.targetId)).limit(1);
      if (!page) throw new Error("Page missing");

      // Snapshot the current puckData BEFORE overwriting.
      const [{ next }] = await db
        .select({ next: sql<number>`COALESCE(MAX(${pageVersions.versionNumber}), 0) + 1` })
        .from(pageVersions)
        .where(eq(pageVersions.pageId, page.id));
      await db.insert(pageVersions).values({
        pageId: page.id,
        siteId: page.siteId,
        versionNumber: next ?? 1,
        source: "ai",
        label: `Pre-AI snapshot (${gen.prompt.slice(0, 40)})`,
        title: page.title,
        path: page.path,
        puckData: page.puckData as never,
        createdBy: user.id,
      });

      const patch = gen.proposedPatch as { content: unknown; root: unknown };
      const [updated] = await db
        .update(sitePages)
        .set({ puckData: patch as never, updatedAt: new Date() })
        .where(eq(sitePages.id, page.id))
        .returning();

      await db.insert(aiPatchApplications).values({
        generationId: gen.id,
        appliedBy: user.id,
        beforeSnapshot: page.puckData as never,
        afterSnapshot: updated.puckData as never,
      });
      await db.update(aiGenerations).set({ status: "applied" }).where(eq(aiGenerations.id, gen.id));
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        siteId: site.id,
        userId: user.id,
        action: "ai.apply",
        resourceType: "page",
        resourceId: page.id,
        metadata: { generationId: gen.id, prompt: gen.prompt.slice(0, 200) },
      });
      return { ok: true, targetType: "page" as const, pageId: page.id };

    }

    if (gen.targetType === "theme") {
      const patch = gen.proposedPatch as { tokens: Record<string, string> };
      const before = site.theme;
      const nextTheme = { ...(site.theme ?? {}), preset: "ai", tokens: patch.tokens };
      const [updated] = await db
        .update(sites)
        .set({ theme: nextTheme as never, updatedAt: new Date() })
        .where(eq(sites.id, site.id))
        .returning();
      await db.insert(aiPatchApplications).values({
        generationId: gen.id,
        appliedBy: user.id,
        beforeSnapshot: before as never,
        afterSnapshot: updated.theme as never,
      });
      await db.update(aiGenerations).set({ status: "applied" }).where(eq(aiGenerations.id, gen.id));
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        siteId: site.id,
        userId: user.id,
        action: "ai.apply",
        resourceType: "theme",
        resourceId: site.id,
        metadata: { generationId: gen.id, prompt: gen.prompt.slice(0, 200) },
      });
      return { ok: true, targetType: "theme" as const, siteId: site.id };

    }

    throw new Error(`Unsupported target type: ${gen.targetType}`);
  });

export const rollbackApplication = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ generationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { aiGenerations, aiPatchApplications, sites, sitePages } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();

    const [gen] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, data.generationId)).limit(1);
    if (!gen) throw new Error("Not found");
    await requireOwnedSite(gen.siteId);

    const [app] = await db
      .select()
      .from(aiPatchApplications)
      .where(eq(aiPatchApplications.generationId, gen.id))
      .orderBy(desc(aiPatchApplications.appliedAt))
      .limit(1);
    if (!app) throw new Error("No application to roll back");

    if (gen.targetType === "page" && gen.targetId) {
      await db
        .update(sitePages)
        .set({ puckData: app.beforeSnapshot as never, updatedAt: new Date() })
        .where(eq(sitePages.id, gen.targetId));
    } else if (gen.targetType === "theme") {
      await db.update(sites).set({ theme: app.beforeSnapshot as never, updatedAt: new Date() }).where(eq(sites.id, gen.siteId));
    }
    await db.update(aiGenerations).set({ status: "rolled_back" }).where(eq(aiGenerations.id, gen.id));
    return { ok: true };
  });
