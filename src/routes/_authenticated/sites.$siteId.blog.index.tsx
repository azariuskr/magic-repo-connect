import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getSite } from "@/lib/sites.functions";
import {
  createBlogPost,
  deleteBlogPost,
  listBlogPosts,
  publishBlogPost,
  unpublishBlogPost,
} from "@/lib/blog.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/blog/")({
  component: BlogIndex,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function BlogIndex() {
  const { siteId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getSiteFn = useServerFn(getSite);
  const listFn = useServerFn(listBlogPosts);
  const createFn = useServerFn(createBlogPost);
  const deleteFn = useServerFn(deleteBlogPost);
  const publishFn = useServerFn(publishBlogPost);
  const unpublishFn = useServerFn(unpublishBlogPost);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => getSiteFn({ data: { id: siteId } }),
  });
  const postsQuery = useQuery({
    queryKey: ["blog-posts", siteId],
    queryFn: () => listFn({ data: { siteId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["blog-posts", siteId] });

  const createMut = useMutation({
    mutationFn: (input: { title: string; slug: string }) =>
      createFn({ data: { siteId, ...input } }),
    onSuccess: (post) => {
      invalidate();
      navigate({ to: "/sites/$siteId/blog/$postId/edit", params: { siteId, postId: post.id } });
    },
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => deleteFn({ data: { id } }), onSuccess: invalidate });
  const pubMut = useMutation({ mutationFn: (id: string) => publishFn({ data: { id } }), onSuccess: invalidate });
  const unpubMut = useMutation({ mutationFn: (id: string) => unpublishFn({ data: { id } }), onSuccess: invalidate });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const site = siteQuery.data;
  const posts = postsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:underline">All sites</Link>
        <span>/</span>
        <Link to="/sites/$siteId/pages" params={{ siteId }} className="hover:underline">
          {site?.name ?? "…"}
        </Link>
        <span>/</span>
        <span className="text-foreground">Blog</span>
      </div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog posts</h1>
          <p className="text-sm text-muted-foreground">
            Write posts with a rich editor. Published posts appear at /blog on your live site.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {site ? (
            <a
              href={`/s/${site.slug}/blog`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              View blog ↗
            </a>
          ) : null}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New post
          </button>
        </div>
      </div>

      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate({ title, slug: slug || slugify(title) });
          }}
          className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            required
            placeholder="Post title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="post-slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <button
            type="submit"
            disabled={createMut.isPending}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
          {createMut.error ? (
            <p className="col-span-full text-xs text-destructive">
              {(createMut.error as Error).message}
            </p>
          ) : null}
        </form>
      ) : null}

      {postsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : postsQuery.error ? (
        <p className="text-sm text-destructive">{(postsQuery.error as Error).message}</p>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Slug</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">/blog/{p.slug}</td>
                  <td className="px-4 py-3">
                    {p.status === "published" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to="/sites/$siteId/blog/$postId/edit"
                        params={{ siteId, postId: p.id }}
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                      >
                        Edit
                      </Link>
                      {p.status === "published" ? (
                        <button
                          onClick={() => unpubMut.mutate(p.id)}
                          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => pubMut.mutate(p.id)}
                          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete post "${p.title}"?`)) deleteMut.mutate(p.id);
                        }}
                        className="rounded-md border border-destructive/40 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
