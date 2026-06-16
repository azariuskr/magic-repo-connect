import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data?.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="text-sm font-semibold">
            Sitebuilder
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{user.email}</span>
            <button
              onClick={async () => {
                await authClient.signOut();
                await router.invalidate();
                navigate({ to: "/auth" });
              }}
              className="rounded-md border px-2.5 py-1 hover:bg-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
