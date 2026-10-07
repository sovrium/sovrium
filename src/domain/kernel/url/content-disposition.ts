/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Naming a download in its `Content-Disposition` header (RFC 6266).
 *
 * A stored file keeps the name its uploader gave it, so the name is untrusted
 * text going into a header. Three things go wrong when it is pasted into
 * `filename="…"` as-is: a `"` ends the quoted string early and lets the rest of
 * the name be read as further parameters, a CR or LF is a header-injection
 * attempt (and a TypeError from `Headers`), and a non-ASCII character is not a
 * legal header byte at all.
 *
 * So a plain printable-ASCII name keeps the simple `filename="…"` form, and any
 * other name is sent twice: an ASCII fallback in `filename="…"` (non-ASCII
 * replaced by `_`, `"` and `\` backslash-escaped) for old clients, and the exact
 * name in RFC 5987 `filename*=UTF-8''…` percent-encoding, which every current
 * browser prefers. Control characters are dropped from both.
 */

/** C0 controls (below a space) and DEL: never legal inside a header value. */
function isControlChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code < 0x20 || code === 0x7f
}

/** Printable ASCII with nothing that needs escaping inside a quoted string. */
const PLAIN_QUOTED_SAFE = /^[\x20-\x21\x23-\x5B\x5D-\x7E]*$/u

/** `encodeURIComponent` leaves these unescaped, but RFC 5987 `attr-char` excludes them. */
const NON_ATTR_CHARS = /['()*]/gu

/** Percent-encode `value` as an RFC 5987 `value-chars` string. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    NON_ATTR_CHARS,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

/** The `filename="…"` fallback: ASCII only, `"` and `\` escaped. */
function asciiFallback(value: string): string {
  return value.replace(/[^\x20-\x7E]/gu, '_').replace(/["\\]/gu, '\\$&')
}

/**
 * The `Content-Disposition` value for a response whose body is the file named
 * `filename`, shown `inline` or offered as an `attachment` (the default).
 */
export function buildContentDisposition(
  filename: string,
  disposition: 'attachment' | 'inline' = 'attachment'
): string {
  const clean = [...filename].filter((char) => !isControlChar(char)).join('')
  if (PLAIN_QUOTED_SAFE.test(clean)) return `${disposition}; filename="${clean}"`
  return `${disposition}; filename="${asciiFallback(clean)}"; filename*=UTF-8''${encodeRfc5987(clean)}`
}
