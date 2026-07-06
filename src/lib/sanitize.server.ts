// Lightweight allow-list HTML sanitizer for owner-authored rich text and
// AI-generated content. Runs on Cloudflare Workers (no DOM, no DOMPurify).
//
// Trust model: authors are authenticated site owners; AI output must go
// through this filter before being persisted. We strip anything not on
// the allow-list: scripts, styles, event handlers, dangerous protocols,
// data:/vbscript:/file: URLs, and unknown tags.

const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "a", "span", "div",
  "img",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "loading"]),
  span: new Set(["class"]),
  div: new Set(["class"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
};

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function safeUrl(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (!SAFE_URL.test(trimmed)) return null;
  if (/^javascript:/i.test(trimmed)) return null;
  return trimmed;
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sanitize an HTML string against an allow-list of tags/attributes.
 * Removes <script>, <style>, iframes, event handlers, and unsafe URLs.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  // Drop entire dangerous blocks first (script/style/iframe/object/embed).
  let html = input.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  // Drop self-closing/void versions of the same.
  html = html.replace(/<\s*(script|style|iframe|object|embed|svg|math|form|link|meta)\b[^>]*\/?>/gi, "");
  // Drop HTML comments.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    const isClose = _full.startsWith("</");
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (isClose) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
    const attrs: string[] = [];
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rawAttrs))) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? "";
      if (name.startsWith("on")) continue; // strip event handlers
      if (!allowed.has(name)) continue;
      if (name === "href" || name === "src") {
        const url = safeUrl(value);
        if (!url) continue;
        attrs.push(`${name}="${escapeAttr(url)}"`);
        continue;
      }
      if (name === "target") {
        if (value === "_blank") attrs.push('target="_blank"', 'rel="noopener noreferrer"');
        continue;
      }
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  });
}

/**
 * Recursively sanitize any string prop whose key ends in "Html".
 * Used to clean AI-generated Puck block props before persisting.
 */
export function sanitizeHtmlPropsDeep<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeHtmlPropsDeep(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string" && /Html$/.test(k)) out[k] = sanitizeHtml(v);
      else out[k] = sanitizeHtmlPropsDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
