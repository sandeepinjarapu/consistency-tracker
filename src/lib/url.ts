// URL safety helpers. Both are pure so they can be unit-tested and reused
// at validation time (reject bad input) and render time (neutralize any
// value that slipped in before validation existed).

/**
 * Returns the URL only if it's a safe external http(s) link, else null.
 * Guards against javascript:/data:/vbscript: and other script-capable
 * schemes that would execute when rendered as an <a href>.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? url
      : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a post-login `next` target to a same-origin relative path. Anything
 * that would point off-origin (absolute URLs, protocol-relative `//evil`,
 * `@evil.com`, etc.) falls back to the default, so a crafted `?next=` can't
 * turn an auth redirect into an open redirect.
 */
export function safeNextPath(
  raw: string | null | undefined,
  origin: string,
  fallback = "/consistencytracker"
): string {
  if (!raw) return fallback;
  try {
    const dest = new URL(raw, origin);
    if (dest.origin !== origin) return fallback;
    return dest.pathname + dest.search + dest.hash;
  } catch {
    return fallback;
  }
}
