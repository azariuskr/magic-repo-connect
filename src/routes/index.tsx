import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sitebuilder — quick websites for small businesses" },
      {
        name: "description",
        content:
          "Drag-and-drop website builder with rich text editing and beautiful themes. Built for barbers, cafés, salons, and small studios.",
      },
      { property: "og:title", content: "Sitebuilder" },
      { property: "og:description", content: "Quick websites for small businesses." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold">Sitebuilder</span>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          For small businesses
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
          A website you can actually edit.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Drag blocks onto a page, write content in rich text, pick a theme, and publish. No
          designer required.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start building
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {[
          { title: "Drag-and-drop blocks", body: "Hero, services, pricing, contact, booking, map." },
          { title: "Rich text everywhere", body: "Edit headlines and descriptions with Tiptap." },
          { title: "Themes you can tweak", body: "Pick a preset, change colors, ship in minutes." },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border p-5">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
