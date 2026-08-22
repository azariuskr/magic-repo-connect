import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Lightweight public loaders used by data-bound Puck blocks (Latest posts,
// Product grid). They return only published, display-safe fields.

export type BlockPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
};

export type BlockProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
};

async function siteIdForSlug(siteSlug: string): Promise<string | null> {
  const { db } = await import("@/db/client.server");
  const { sites } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.slug, siteSlug)).limit(1);
  return site?.id ?? null;
}

export const listBlockPosts = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z
      .object({
        siteSlug: z.string().trim().min(1).max(64),
        limit: z.number().int().min(1).max(12).default(3),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<BlockPost[]> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { blogPosts } = await import("@/db/schema");
    const { and, desc, eq } = await import("drizzle-orm");
    await ensureSchema();
    const siteId = await siteIdForSlug(data.siteSlug);
    if (!siteId) return [];
    const rows = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .where(and(eq(blogPosts.siteId, siteId), eq(blogPosts.status, "published")))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(data.limit);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt ?? null,
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
    }));
  });

export const listBlockProducts = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z
      .object({
        siteSlug: z.string().trim().min(1).max(64),
        limit: z.number().int().min(1).max(12).default(3),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<BlockProduct[]> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { products } = await import("@/db/schema");
    const { and, desc, eq } = await import("drizzle-orm");
    await ensureSchema();
    const siteId = await siteIdForSlug(data.siteSlug);
    if (!siteId) return [];
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        priceCents: products.priceCents,
        currency: products.currency,
        images: products.images,
      })
      .from(products)
      .where(and(eq(products.siteId, siteId), eq(products.status, "published")))
      .orderBy(desc(products.updatedAt))
      .limit(data.limit);
    return rows.map((r) => {
      const imgs = Array.isArray(r.images) ? (r.images as unknown[]) : [];
      const first = imgs[0];
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        priceCents: r.priceCents ?? 0,
        currency: r.currency ?? "EUR",
        imageUrl: typeof first === "string" ? first : null,
      };
    });
  });
