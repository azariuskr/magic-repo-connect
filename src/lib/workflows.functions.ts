import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Duplicated from events.server.ts because that file is server-only and can't
// be imported at module scope of a .functions.ts (client bundle would fail).
export const KNOWN_EVENT_TYPES = [
  "order.created",
  "form.submitted",
  "blog.post.published",
] as const;
export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

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

async function requireOwnedWorkflow(id: string) {
  const user = await requireSession();
  const { db } = await import("@/db/client.server");
  const { sites, workflows } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [wf] = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
  if (!wf) throw new Error("Not found");
  const [site] = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, wf.siteId), eq(sites.ownerId, user.id)))
    .limit(1);
  if (!site) throw new Error("Not found");
  return { user, site, workflow: wf };
}

const stepSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("webhook"),
    url: z.string().url().max(2000),
    method: z.enum(["POST", "GET"]).optional(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("log"),
    message: z.string().max(500),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("integration_call"),
    accountId: z.string().uuid(),
    to: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    text: z.string().max(4000).optional(),
    path: z.string().max(500).optional(),
    method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
  }),
]);

const graphSchema = z.object({
  nodes: z.array(stepSchema).max(20),
  edges: z.array(z.unknown()).optional(),
});

export type WorkflowSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  triggerType: string;
  eventType: string | null;
  stepCount: number;
  updatedAt: string;
};

export const listWorkflows = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ siteId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<WorkflowSummary[]> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { workflows } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedSite(data.siteId);
    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.siteId, data.siteId))
      .orderBy(desc(workflows.updatedAt));
    return rows.map((w) => {
      const cfg = (w.triggerConfig ?? {}) as { eventType?: string };
      const graph = (w.graph ?? { nodes: [] }) as { nodes: unknown[] };
      return {
        id: w.id,
        name: w.name,
        description: w.description ?? null,
        status: w.status,
        triggerType: w.triggerType,
        eventType: cfg.eventType ?? null,
        stepCount: graph.nodes?.length ?? 0,
        updatedAt: w.updatedAt.toISOString(),
      };
    });
  });

export const getWorkflow = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    await ensureSchema();
    const { workflow } = await requireOwnedWorkflow(data.id);
    const cfg = (workflow.triggerConfig ?? {}) as { eventType?: string };
    const graph = (workflow.graph ?? { nodes: [] }) as { nodes: unknown[] };
    return {
      id: workflow.id,
      siteId: workflow.siteId,
      name: workflow.name,
      description: workflow.description ?? null,
      status: workflow.status,
      eventType: cfg.eventType ?? KNOWN_EVENT_TYPES[0],
      steps: (graph.nodes ?? []) as z.infer<typeof stepSchema>[],
      updatedAt: workflow.updatedAt.toISOString(),
    };
  });

export const createWorkflow = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        siteId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        eventType: z.enum(KNOWN_EVENT_TYPES),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { workflows } = await import("@/db/schema");
    await ensureSchema();
    await requireOwnedSite(data.siteId);
    const [row] = await db
      .insert(workflows)
      .values({
        siteId: data.siteId,
        name: data.name,
        status: "draft",
        triggerType: "event",
        triggerConfig: { eventType: data.eventType },
        graph: { nodes: [], edges: [] },
      })
      .returning({ id: workflows.id });
    return { id: row.id };
  });

export const saveWorkflow = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().max(1000).nullable().optional(),
        status: z.enum(["draft", "active", "paused"]).optional(),
        eventType: z.enum(KNOWN_EVENT_TYPES).optional(),
        graph: graphSchema.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { workflows } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedWorkflow(data.id);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (data.status !== undefined) update.status = data.status;
    if (data.eventType !== undefined)
      update.triggerConfig = { eventType: data.eventType };
    if (data.graph !== undefined) update.graph = data.graph;
    await db.update(workflows).set(update).where(eq(workflows.id, data.id));
    return { ok: true };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { workflows } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedWorkflow(data.id);
    await db.delete(workflows).where(eq(workflows.id, data.id));
    return { ok: true };
  });

export type WorkflowRunSummary = {
  id: string;
  status: string;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  stepCount: number;
};

export const listWorkflowRuns = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ workflowId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<WorkflowRunSummary[]> => {
    const { ensureSchema } = await import("@/db/bootstrap.server");
    const { db } = await import("@/db/client.server");
    const { workflowRuns, workflowStepRuns } = await import("@/db/schema");
    const { eq, desc, sql } = await import("drizzle-orm");
    await ensureSchema();
    await requireOwnedWorkflow(data.workflowId);
    const rows = await db
      .select({
        id: workflowRuns.id,
        status: workflowRuns.status,
        error: workflowRuns.error,
        startedAt: workflowRuns.startedAt,
        finishedAt: workflowRuns.finishedAt,
        stepCount: sql<number>`(select count(*) from ${workflowStepRuns} where ${workflowStepRuns.workflowRunId} = ${workflowRuns.id})`,
      })
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, data.workflowId))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(50);
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      error: r.error ?? null,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      stepCount: Number(r.stepCount ?? 0),
    }));
  });
