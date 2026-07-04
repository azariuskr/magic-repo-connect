// Server-only event emitter with an inline workflow runner.
// Never imported from route/component files — only from *.functions.ts handlers.

export type EmittableEvent =
  | { type: "order.created"; payload: Record<string, unknown> }
  | { type: "form.submitted"; payload: Record<string, unknown> }
  | { type: "blog.post.published"; payload: Record<string, unknown> };

export const KNOWN_EVENT_TYPES = [
  "order.created",
  "form.submitted",
  "blog.post.published",
] as const;
export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

export type WorkflowStep =
  | { id: string; type: "webhook"; url: string; method?: "POST" | "GET" }
  | { id: string; type: "log"; message: string }
  | {
      id: string;
      type: "integration_call";
      accountId: string;
      to?: string;
      subject?: string;
      text?: string;
      path?: string;
      method?: "GET" | "POST" | "PUT" | "DELETE";
    };

export type WorkflowGraph = { nodes: WorkflowStep[]; edges?: unknown[] };

// Fire-and-forget: record the event, find matching workflows for the site,
// and execute each one inline. Never throws to the caller.
export async function emitEvent(
  siteId: string,
  type: KnownEventType,
  payload: Record<string, unknown>,
  sourceType = "system",
  sourceId?: string,
): Promise<void> {
  try {
    const { db } = await import("@/db/client.server");
    const { events, workflows, workflowRuns, workflowStepRuns } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");

    const [ev] = await db
      .insert(events)
      .values({ siteId, type, sourceType, sourceId, payload })
      .returning({ id: events.id });

    const rows = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.siteId, siteId),
          eq(workflows.status, "active"),
          eq(workflows.triggerType, "event"),
        ),
      );

    for (const wf of rows) {
      const cfg = (wf.triggerConfig ?? {}) as { eventType?: string };
      if (cfg.eventType !== type) continue;

      const [run] = await db
        .insert(workflowRuns)
        .values({
          workflowId: wf.id,
          siteId,
          status: "running",
          triggerEventId: ev?.id,
          input: payload,
        })
        .returning();

      const graph = (wf.graph ?? { nodes: [] }) as WorkflowGraph;
      const outputs: Record<string, unknown> = {};
      let runError: string | null = null;

      for (const step of graph.nodes ?? []) {
        const started = new Date();
        try {
          const result = await executeStep(step, { payload, outputs });
          outputs[step.id] = result;
          await db.insert(workflowStepRuns).values({
            workflowRunId: run.id,
            stepId: step.id,
            actionType: step.type,
            status: "success",
            input: step as unknown as Record<string, unknown>,
            output: result as Record<string, unknown>,
            startedAt: started,
            finishedAt: new Date(),
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          runError = message;
          await db.insert(workflowStepRuns).values({
            workflowRunId: run.id,
            stepId: step.id,
            actionType: step.type,
            status: "error",
            input: step as unknown as Record<string, unknown>,
            error: message,
            startedAt: started,
            finishedAt: new Date(),
          });
          break;
        }
      }

      await db
        .update(workflowRuns)
        .set({
          status: runError ? "error" : "success",
          error: runError,
          output: outputs,
          finishedAt: new Date(),
        })
        .where(eq(workflowRuns.id, run.id));
    }
  } catch (e) {
    // Never let workflow failures break the originating request.
    console.error("[emitEvent] failed", type, e);
  }
}

async function executeStep(
  step: WorkflowStep,
  ctx: { payload: Record<string, unknown>; outputs: Record<string, unknown> },
): Promise<unknown> {
  if (step.type === "webhook") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(step.url, {
        method: step.method ?? "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: ctx.payload }),
        signal: controller.signal,
      });
      const text = await res.text().catch(() => "");
      return { status: res.status, body: text.slice(0, 500) };
    } finally {
      clearTimeout(timer);
    }
  }
  if (step.type === "log") {
    const msg = String(step.message ?? "").slice(0, 500);
    console.log("[workflow.log]", msg, ctx.payload);
    return { message: msg };
  }
  throw new Error(`Unknown step type: ${(step as { type: string }).type}`);
}
