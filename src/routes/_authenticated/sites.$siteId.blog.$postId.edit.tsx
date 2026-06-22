import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import { getBlogPost, publishBlogPost, saveBlogPost, unpublishBlogPost } from "@/lib/blog.functions";

export const Route = createFileRoute("/_authenticated/sites/$siteId/blog/$postId/edit")({
  component: BlogEditor,
});

function BlogEditor() {
  const { siteId, postId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getBlogPost);
  const saveFn = useServerFn(saveBlogPost);
  const pubFn = useServerFn(publishBlogPost);
  const unpubFn = useServerFn(unpublishBlogPost);

  const q = useQuery({ queryKey: ["blog-post", postId], queryFn: () => getFn({ data: { id: postId } }) });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!q.data || loaded) return;
    const p = q.data.post;
    setTitle(p.title);
    setSlug(p.slug);
    setExcerpt(p.excerpt ?? "");
    setContentHtml(p.contentHtml ?? "");
    setSeoTitle(p.seoTitle ?? "");
    setSeoDescription(p.seoDescription ?? "");
    setLoaded(true);
  }, [q.data, loaded]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        LinkExt.configure({ openOnClick: false, HTMLAttributes: { class: "underline" } }),
      ],
      content: contentHtml,
      immediatelyRender: false,
      onUpdate: ({ editor }) => setContentHtml(editor.getHTML()),
      editorProps: {
        attributes: {
          class:
            "min-h-[400px] w-full px-4 py-3 text-sm focus:outline-none [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-2 [&_a]:text-primary [&_a]:underline",
        },
      },
    },
    [loaded],
  );

  useEffect(() => {
    if (editor && loaded && editor.getHTML() !== contentHtml) {
      editor.commands.setContent(contentHtml || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: postId,
          title,
          slug,
          excerpt: excerpt || null,
          contentHtml,
          seoTitle: seoTitle || null,
          seoDescription: seoDescription || null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog-post", postId] }),
  });
  const pubMut = useMutation({
    mutationFn: async () => {
      await saveMut.mutateAsync();
      return pubFn({ data: { id: postId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-post", postId] });
      qc.invalidateQueries({ queryKey: ["blog-posts", siteId] });
    },
  });
  const unpubMut = useMutation({
    mutationFn: () => unpubFn({ data: { id: postId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-post", postId] });
      qc.invalidateQueries({ queryKey: ["blog-posts", siteId] });
    },
  });

  if (q.isLoading || !loaded) return <p className="p-10 text-sm text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="p-10 text-sm text-destructive">{(q.error as Error).message}</p>;

  const post = q.data!.post;
  const site = q.data!.site;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/sites/$siteId/blog" params={{ siteId }} className="hover:underline">
          ← All posts
        </Link>
        <span>•</span>
        <span className="font-mono">/blog/{post.slug}</span>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {post.status === "published" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/s/${site.slug}/blog/${post.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            Preview ↗
          </a>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {saveMut.isPending ? "Saving…" : "Save draft"}
          </button>
          {post.status === "published" ? (
            <button
              onClick={() => unpubMut.mutate()}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => pubMut.mutate()}
              disabled={pubMut.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pubMut.isPending ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          className="w-full rounded-md border border-input bg-background px-4 py-3 text-2xl font-semibold tracking-tight"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="post-slug"
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short excerpt (shown in list)"
            maxLength={500}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-hidden rounded-md border border-input bg-background">
          <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 px-1.5 py-1">
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleBold().run()} label="B" active={!!editor?.isActive("bold")} />
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleItalic().run()} label="I" active={!!editor?.isActive("italic")} />
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" active={!!editor?.isActive("heading", { level: 2 })} />
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" active={!!editor?.isActive("heading", { level: 3 })} />
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleBulletList().run()} label="• List" active={!!editor?.isActive("bulletList")} />
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleOrderedList().run()} label="1. List" active={!!editor?.isActive("orderedList")} />
            <Btn editor={editor} cmd={() => editor?.chain().focus().toggleBlockquote().run()} label="❝" active={!!editor?.isActive("blockquote")} />
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Btn
              editor={editor}
              cmd={() => {
                const url = window.prompt("URL");
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
              label="🔗 Link"
              active={!!editor?.isActive("link")}
            />
          </div>
          <EditorContent editor={editor} />
        </div>

        <details className="rounded-md border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">SEO</summary>
          <div className="mt-3 grid gap-3">
            <input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="SEO title (defaults to post title)"
              maxLength={200}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="SEO description"
              rows={3}
              maxLength={500}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </details>
      </div>
    </div>
  );
}

function Btn({
  editor,
  cmd,
  label,
  active,
}: {
  editor: ReturnType<typeof useEditor> | null;
  cmd: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!editor}
      onClick={cmd}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-background"
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
}
