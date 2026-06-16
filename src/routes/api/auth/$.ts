import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request) {
  const { ensureSchema } = await import("@/db/bootstrap.server");
  const { auth } = await import("@/lib/auth.server");
  await ensureSchema();
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
