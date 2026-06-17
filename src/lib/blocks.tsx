import type { Config } from "@measured/puck";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";

// ---------- Shared RichText ----------

const tiptapExtensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Link.configure({ openOnClick: false, HTMLAttributes: { class: "underline" } }),
];

export function RichTextView({ html }: { html?: string }) {
  if (!html) return null;
  return (
    <div
      className="prose-site"
      // owner-authored content on their own site; trust boundary acceptable for v1.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function RichTextEditor({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const editor = useEditor({
    extensions: tiptapExtensions,
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] w-full px-3 py-2 text-sm focus:outline-none [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline",
      },
    },
  });
  if (!mounted) return <div className="h-24 animate-pulse rounded-md border border-input bg-muted/40" />;
  return (
    <div className="overflow-hidden rounded-md border border-input bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 px-1.5 py-1">
        <ToolbarBtn editor={editor} action={() => editor?.chain().focus().toggleBold().run()} label="B" active={!!editor?.isActive("bold")} />
        <ToolbarBtn editor={editor} action={() => editor?.chain().focus().toggleItalic().run()} label="I" active={!!editor?.isActive("italic")} />
        <span className="mx-0.5 h-4 w-px bg-border" />
        <ToolbarBtn editor={editor} action={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" active={!!editor?.isActive("heading", { level: 2 })} />
        <ToolbarBtn editor={editor} action={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" active={!!editor?.isActive("heading", { level: 3 })} />
        <ToolbarBtn editor={editor} action={() => editor?.chain().focus().toggleBulletList().run()} label="• List" active={!!editor?.isActive("bulletList")} />
        <span className="mx-0.5 h-4 w-px bg-border" />
        <ToolbarBtn editor={editor} action={() => {
          const url = window.prompt("URL");
          if (url) editor?.chain().focus().setLink({ href: url }).run();
        }} label="🔗 Link" active={!!editor?.isActive("link")} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  editor,
  action,
  label,
  active,
}: {
  editor: ReturnType<typeof useEditor> | null;
  action: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!editor}
      onClick={action}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/70 hover:bg-background hover:text-foreground"
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

// ---------- Block components ----------

function SectionShell({
  children,
  bg = "bg",
  className = "",
}: {
  children: React.ReactNode;
  bg?: "bg" | "surface";
  className?: string;
}) {
  return (
    <section
      className={`px-6 py-16 sm:px-10 lg:px-16 ${className}`}
      style={{ backgroundColor: `var(--site-${bg})` }}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function Btn({ href, children }: { href?: string; children: React.ReactNode }) {
  return (
    <a
      href={href || "#"}
      className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
      style={{
        backgroundColor: "var(--site-brand)",
        color: "var(--site-bg)",
        borderRadius: "var(--site-radius)",
      }}
    >
      {children}
    </a>
  );
}

type HeroProps = {
  eyebrow?: string;
  title?: string;
  subtitleHtml?: string;
  ctaLabel?: string;
  ctaHref?: string;
  bgImageUrl?: string;
  align?: "left" | "center";
};

function Hero({ eyebrow, title, subtitleHtml, ctaLabel, ctaHref, bgImageUrl, align = "center" }: HeroProps) {
  const isCenter = align === "center";
  return (
    <section
      className="relative px-6 py-24 sm:px-10 lg:px-16"
      style={{
        backgroundColor: "var(--site-bg)",
        backgroundImage: bgImageUrl ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${bgImageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className={`mx-auto max-w-4xl ${isCenter ? "text-center" : "text-left"}`}>
        {eyebrow ? (
          <p className="mb-3 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--site-brand)" }}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: "var(--site-fg)" }}>
          {title || "Your Headline"}
        </h1>
        {subtitleHtml ? (
          <div className={`mt-5 text-base sm:text-lg ${isCenter ? "mx-auto max-w-2xl" : ""}`} style={{ color: "var(--site-muted)" }}>
            <RichTextView html={subtitleHtml} />
          </div>
        ) : null}
        {ctaLabel ? (
          <div className={`mt-8 ${isCenter ? "" : ""}`}>
            <Btn href={ctaHref}>{ctaLabel}</Btn>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type ServicesProps = {
  title?: string;
  items?: Array<{ name: string; descriptionHtml?: string; price?: string }>;
};

function Services({ title, items }: ServicesProps) {
  return (
    <SectionShell bg="surface">
      {title ? (
        <h2 className="mb-10 text-3xl font-semibold tracking-tight" style={{ color: "var(--site-fg)" }}>
          {title}
        </h2>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(items || []).map((item, i) => (
          <div
            key={i}
            className="p-6"
            style={{
              backgroundColor: "var(--site-bg)",
              borderRadius: "var(--site-radius)",
              border: "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)",
            }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--site-fg)" }}>
                {item.name}
              </h3>
              {item.price ? (
                <span className="text-sm font-semibold" style={{ color: "var(--site-brand)" }}>
                  {item.price}
                </span>
              ) : null}
            </div>
            {item.descriptionHtml ? (
              <div className="mt-2 text-sm" style={{ color: "var(--site-muted)" }}>
                <RichTextView html={item.descriptionHtml} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

type PricingProps = {
  title?: string;
  tiers?: Array<{ name: string; price: string; features: string; ctaLabel?: string; ctaHref?: string; highlight?: boolean }>;
};

function Pricing({ title, tiers }: PricingProps) {
  return (
    <SectionShell bg="bg">
      {title ? (
        <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight" style={{ color: "var(--site-fg)" }}>
          {title}
        </h2>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(tiers || []).map((tier, i) => (
          <div
            key={i}
            className="flex flex-col p-8"
            style={{
              backgroundColor: "var(--site-surface)",
              borderRadius: "var(--site-radius)",
              border: tier.highlight
                ? "2px solid var(--site-brand)"
                : "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)",
            }}
          >
            <h3 className="text-xl font-semibold" style={{ color: "var(--site-fg)" }}>
              {tier.name}
            </h3>
            <p className="mt-3 text-3xl font-bold" style={{ color: "var(--site-brand)" }}>
              {tier.price}
            </p>
            <ul className="mt-5 space-y-2 text-sm" style={{ color: "var(--site-muted)" }}>
              {(tier.features || "").split("\n").filter(Boolean).map((f, j) => (
                <li key={j}>• {f}</li>
              ))}
            </ul>
            {tier.ctaLabel ? (
              <div className="mt-auto pt-6">
                <Btn href={tier.ctaHref}>{tier.ctaLabel}</Btn>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

type ContactFormProps = { title?: string; subtitle?: string; siteId?: string };

function ContactForm({ title, subtitle, siteId }: ContactFormProps) {
  return (
    <SectionShell bg="surface">
      <div className="mx-auto max-w-xl text-center">
        {title ? (
          <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--site-fg)" }}>
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mt-3 text-sm" style={{ color: "var(--site-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <form
        className="mx-auto mt-8 max-w-xl space-y-3"
        method="POST"
        action="#"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!siteId) return;
          const form = e.currentTarget;
          const fd = new FormData(form);
          const { submitContact } = await import("@/lib/sites.functions");
          try {
            await submitContact({
              data: {
                siteId,
                name: String(fd.get("name") || ""),
                email: String(fd.get("email") || ""),
                message: String(fd.get("message") || ""),
              },
            });
            form.reset();
            alert("Thanks — we'll be in touch.");
          } catch {
            alert("Could not send. Please try again.");
          }
        }}
      >
        <input
          name="name"
          required
          placeholder="Your name"
          maxLength={120}
          className="w-full px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--site-bg)",
            color: "var(--site-fg)",
            borderRadius: "var(--site-radius)",
            border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)",
          }}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          maxLength={255}
          className="w-full px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--site-bg)",
            color: "var(--site-fg)",
            borderRadius: "var(--site-radius)",
            border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)",
          }}
        />
        <textarea
          name="message"
          required
          placeholder="Message"
          maxLength={2000}
          rows={5}
          className="w-full px-4 py-3 text-sm"
          style={{
            backgroundColor: "var(--site-bg)",
            color: "var(--site-fg)",
            borderRadius: "var(--site-radius)",
            border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)",
          }}
        />
        <div className="flex justify-center pt-2">
          <button
            type="submit"
            className="px-6 py-3 text-sm font-semibold"
            style={{
              backgroundColor: "var(--site-brand)",
              color: "var(--site-bg)",
              borderRadius: "var(--site-radius)",
            }}
          >
            Send message
          </button>
        </div>
      </form>
    </SectionShell>
  );
}

type BookingCTAProps = { title?: string; subtitle?: string; ctaLabel?: string; ctaHref?: string };

function BookingCTA({ title, subtitle, ctaLabel, ctaHref }: BookingCTAProps) {
  return (
    <SectionShell bg="bg">
      <div
        className="px-6 py-12 text-center sm:px-12"
        style={{
          backgroundColor: "var(--site-surface)",
          borderRadius: "var(--site-radius)",
          border: "1px solid color-mix(in srgb, var(--site-brand) 30%, transparent)",
        }}
      >
        {title ? (
          <h2 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--site-fg)" }}>
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className="mx-auto mt-3 max-w-xl text-sm" style={{ color: "var(--site-muted)" }}>
            {subtitle}
          </p>
        ) : null}
        {ctaLabel ? (
          <div className="mt-6">
            <Btn href={ctaHref}>{ctaLabel}</Btn>
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}

type MapBlockProps = { address?: string; title?: string };

function MapBlock({ address, title }: MapBlockProps) {
  const q = encodeURIComponent(address || "");
  return (
    <SectionShell bg="surface">
      {title ? (
        <h2 className="mb-6 text-center text-3xl font-semibold tracking-tight" style={{ color: "var(--site-fg)" }}>
          {title}
        </h2>
      ) : null}
      <div
        style={{
          borderRadius: "var(--site-radius)",
          overflow: "hidden",
          border: "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)",
        }}
      >
        <iframe
          title="map"
          width="100%"
          height="380"
          style={{ border: 0, display: "block" }}
          src={`https://www.google.com/maps?q=${q}&output=embed`}
        />
      </div>
      {address ? (
        <p className="mt-4 text-center text-sm" style={{ color: "var(--site-muted)" }}>
          {address}
        </p>
      ) : null}
    </SectionShell>
  );
}

type FooterProps = {
  businessName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  socialHtml?: string;
};

function Footer({ businessName, tagline, address, phone, email, hours, socialHtml }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="px-6 py-12 sm:px-10 lg:px-16"
      style={{
        backgroundColor: "var(--site-surface)",
        color: "var(--site-fg)",
        borderTop: "1px solid color-mix(in srgb, var(--site-brand) 25%, transparent)",
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--site-brand)" }}>
            {businessName || "Your business"}
          </h3>
          {tagline ? (
            <p className="mt-2 text-sm" style={{ color: "var(--site-muted)" }}>
              {tagline}
            </p>
          ) : null}
        </div>
        <div className="space-y-1 text-sm" style={{ color: "var(--site-muted)" }}>
          {address ? <p>{address}</p> : null}
          {phone ? <p>{phone}</p> : null}
          {email ? (
            <p>
              <a href={`mailto:${email}`} style={{ color: "var(--site-fg)" }} className="hover:underline">
                {email}
              </a>
            </p>
          ) : null}
        </div>
        <div className="text-sm" style={{ color: "var(--site-muted)" }}>
          {hours ? (
            <div className="whitespace-pre-line">{hours}</div>
          ) : null}
          {socialHtml ? <div className="mt-3"><RichTextView html={socialHtml} /></div> : null}
        </div>
      </div>
      <div
        className="mx-auto mt-10 max-w-6xl border-t pt-6 text-center text-xs"
        style={{
          borderColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)",
          color: "var(--site-muted)",
        }}
      >
        © {year} {businessName || "Your business"}. All rights reserved.
      </div>
    </footer>
  );
}

// ---------- Puck config ----------

type PuckProps = {
  Hero: HeroProps;
  Services: ServicesProps;
  Pricing: PricingProps;
  ContactForm: ContactFormProps;
  BookingCTA: BookingCTAProps;
  Map: MapBlockProps;
  Footer: FooterProps;
};

const richTextField = {
  type: "custom" as const,
  label: "Rich text",
  render: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <RichTextEditor value={value} onChange={onChange} />
  ),
};

export function buildPuckConfig(siteId?: string): Config<PuckProps> {
  return {
    components: {
      Hero: {
        label: "Hero",
        fields: {
          eyebrow: { type: "text", label: "Eyebrow" },
          title: { type: "text", label: "Title" },
          subtitleHtml: richTextField,
          ctaLabel: { type: "text", label: "Button text" },
          ctaHref: { type: "text", label: "Button URL" },
          bgImageUrl: { type: "text", label: "Background image URL" },
          align: {
            type: "radio",
            label: "Alignment",
            options: [
              { label: "Center", value: "center" },
              { label: "Left", value: "left" },
            ],
          },
        },
        defaultProps: {
          eyebrow: "Welcome",
          title: "Premium barber, in the heart of town",
          subtitleHtml: "<p>Classic cuts, hot shaves, and beard styling — by appointment.</p>",
          ctaLabel: "Book an appointment",
          ctaHref: "#book",
          align: "center",
        },
        render: Hero,
      },
      Services: {
        label: "Services",
        fields: {
          title: { type: "text", label: "Section title" },
          items: {
            type: "array",
            label: "Services",
            arrayFields: {
              name: { type: "text", label: "Name" },
              descriptionHtml: richTextField,
              price: { type: "text", label: "Price" },
            },
            defaultItemProps: { name: "Service", descriptionHtml: "", price: "" },
          },
        },
        defaultProps: {
          title: "Services",
          items: [
            { name: "Men's haircut", descriptionHtml: "<p>Wash, cut and style.</p>", price: "25 €" },
            { name: "Beard trim", descriptionHtml: "<p>Shape and finish.</p>", price: "15 €" },
            { name: "Hot towel shave", descriptionHtml: "<p>The full experience.</p>", price: "30 €" },
          ],
        },
        render: Services,
      },
      Pricing: {
        label: "Pricing",
        fields: {
          title: { type: "text", label: "Title" },
          tiers: {
            type: "array",
            label: "Tiers",
            arrayFields: {
              name: { type: "text", label: "Name" },
              price: { type: "text", label: "Price" },
              features: { type: "textarea", label: "Features (one per line)" },
              ctaLabel: { type: "text", label: "Button label" },
              ctaHref: { type: "text", label: "Button URL" },
              highlight: {
                type: "radio",
                label: "Highlighted",
                options: [
                  { label: "No", value: false as unknown as string },
                  { label: "Yes", value: true as unknown as string },
                ],
              },
            },
            defaultItemProps: { name: "Tier", price: "0 €", features: "Feature", highlight: false },
          },
        },
        defaultProps: {
          title: "Memberships",
          tiers: [
            { name: "Drop-in", price: "—", features: "Pay per visit", ctaLabel: "Book", ctaHref: "#book" },
            { name: "Monthly", price: "60 €", features: "2 cuts per month\nPriority booking\n10% off products", ctaLabel: "Join", ctaHref: "#join", highlight: true },
            { name: "VIP", price: "120 €", features: "Unlimited visits\nPersonal barber\n20% off products", ctaLabel: "Apply", ctaHref: "#vip" },
          ],
        },
        render: Pricing,
      },
      ContactForm: {
        label: "Contact form",
        fields: {
          title: { type: "text", label: "Title" },
          subtitle: { type: "textarea", label: "Subtitle" },
        },
        defaultProps: {
          title: "Get in touch",
          subtitle: "We typically respond within a day.",
        },
        render: (props) => <ContactForm {...props} siteId={siteId} />,
      },
      BookingCTA: {
        label: "Booking CTA",
        fields: {
          title: { type: "text", label: "Title" },
          subtitle: { type: "textarea", label: "Subtitle" },
          ctaLabel: { type: "text", label: "Button label" },
          ctaHref: { type: "text", label: "Booking URL" },
        },
        defaultProps: {
          title: "Ready for a fresh look?",
          subtitle: "Book your slot online — takes less than a minute.",
          ctaLabel: "Book now",
          ctaHref: "https://",
        },
        render: BookingCTA,
      },
      Map: {
        label: "Map",
        fields: {
          title: { type: "text", label: "Title" },
          address: { type: "text", label: "Address" },
        },
        defaultProps: { title: "Find us", address: "1 Infinite Loop, Cupertino, CA" },
        render: MapBlock,
      },
    },
  };
}
