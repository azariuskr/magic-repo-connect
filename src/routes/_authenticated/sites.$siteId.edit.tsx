import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy single-page editor. Now redirects to the per-page editor list.
export const Route = createFileRoute("/_authenticated/sites/$siteId/edit")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/sites/$siteId/pages", params: { siteId: params.siteId } });
  },
  component: () => null,
});
