// Audit log helper. Records privileged actions for site owners so they can
// review changes to their site (publishes, deletions, AI patches, integrations,
// order status changes, etc.). Failures never block the caller.

export type AuditEntry = {
  siteId?: string | null;
  userId?: string | null;
  action: string;               // e.g. "blog.post.publish"
  resourceType: string;         // e.g. "blog_post"
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { db } = await import("@/db/client.server");
    const { auditLogs } = await import("@/db/schema");
    await db.insert(auditLogs).values({
      siteId: entry.siteId ?? null,
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: (entry.metadata ?? {}) as never,
    });
  } catch (err) {
    // Don't propagate — auditing is best-effort.
    console.error("[audit] failed to record", entry.action, err);
  }
}

/**
 * Best-effort client IP for rate-limit keys and audit metadata.
 * Reads standard proxy headers set by Cloudflare / Vite / most CDNs.
 */
export function getRequestIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
