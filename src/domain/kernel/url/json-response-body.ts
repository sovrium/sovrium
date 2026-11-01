/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * True when the `Content-Type` header (any casing — RFC 7230 §3.2 makes HTTP
 * field names case-insensitive) declares a JSON media type. Matches the
 * `application/json` family and the `+json` structured-syntax suffix
 * (RFC 6839, e.g. `application/vnd.api+json`).
 */
const isJsonContentType = (headers: Readonly<Record<string, string>>): boolean => {
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')
  const value = (entry?.[1] ?? '').toLowerCase()
  return value.includes('application/json') || value.includes('+json')
}

/**
 * Attempt to expose a STRUCTURED, JSON-parsed `body` for the response so a
 * later step can read a field via `{{steps.X.body.<key>}}`
 * The parsed value is
 * only surfaced when the `Content-Type` declares JSON OR the raw text parses
 * as a JSON object/array — primitive JSON (a bare number/string/bool) is not
 * worth a dotted-path lookup and is left out so non-JSON responses keep the
 * raw-text-only contract (…-003 back-compat). Returns `undefined` when no
 * parsed body should be exposed.
 */
export const parseJsonResponseBody = (
  body: string | undefined,
  headers: Readonly<Record<string, string>>
): unknown => {
  if (body === undefined || body === '') return undefined
  const looksJson = isJsonContentType(headers)
  try {
    // The response shape is arbitrary upstream JSON (no single schema
    // applies); we expose it as an opaque object for dotted-path templating.
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) return parsed
    // Bare JSON primitive — only surface it when the header explicitly says
    // JSON; otherwise leave non-JSON responses untouched.
    return looksJson ? parsed : undefined
  } catch {
    return undefined
  }
}
