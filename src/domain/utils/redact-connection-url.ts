/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single canonical redactor for connection strings rendered into
 * operator-facing text.
 *
 * Every site that interpolates a `DATABASE_URL`-shaped value into a message an
 * operator can see routes through `redactConnectionUrl`. There is exactly ONE
 * of these, for the same reason there is exactly one `sanitizeRichTextHTML`
 * under standing rule S2: the repo has twice been burned by a second
 * implementation that drifted from the first. Do not add another.
 *
 * ─── WHY IT KEEPS THE URL AT ALL ────────────────────────────────────────────
 *
 * The messages this feeds echo `DATABASE_URL` deliberately — an operator who
 * typed `postgress://` needs to see what they typed, and that is the whole
 * diagnosis. Redaction must not cost that. `postgres://admin:***@db:5432/app`
 * still names the scheme, host, port and database; only the password goes.
 * That is safe to drop because **the password is never the thing that was
 * wrong**: nothing about a scheme-refusal can be caused by its content.
 *
 * Deleting the URL instead of redacting it would trade a security bug for a
 * usability bug. `[internal ref]` exists to stop exactly that.
 *
 * ─── WHY NOT `new URL` ──────────────────────────────────────────────────────
 *
 * Measured, all three ([internal ref] D4) — a `new URL` + `u.password = '***'`
 * redactor is not merely clumsy here, it is WRONG:
 *
 *  - `new URL('jdbc:postgresql://admin:pw@h/app')` parses as `protocol=jdbc:`
 *    with empty `username`/`password` and the whole credential-bearing
 *    remainder sitting in `pathname`. It returns that input **completely
 *    unredacted** — and `jdbc:` is one of the exact spellings that reaches the
 *    error path this protects.
 *  - `new URL('./database.db')` **throws**. A redactor that throws on the
 *    malformed input that made us throw is worse than none.
 *  - `new URL` percent-encodes: `p@ss:word` becomes `p%40ss%3Aword`. That is
 *    also the second, independent reason this is not layered onto the
 *    value-matching `redactSecretsInValue` — a literal comparison against the
 *    environment's value would no longer match.
 *
 * So this operates on the raw string. A `jdbc:` prefix or a `+psycopg` suffix
 * is then handled by construction rather than by enumeration.
 *
 * ─── CONTRACT ───────────────────────────────────────────────────────────────
 *
 *  - **Total.** Never throws, for any input, including one that is not a URL.
 *    It runs on the error path; throwing there replaces a bad message with a
 *    worse one.
 *  - **Fails closed.** A value that cannot be confidently decomposed but looks
 *    like it carries userinfo is elided whole rather than partially redacted.
 *  - **Lossless when there is no secret.** `postgres://admin@h/app` and
 *    `file:./database.db` come back verbatim, or the diagnosability floor
 *    regresses for the common case.
 */

/**
 * Fixed-width redaction placeholder.
 *
 * Deliberately the same three characters as `REDACTION_PLACEHOLDER`
 * (`src/domain/models/api/admin/config/schema.ts`) — [internal ref] requires the
 * existing spelling rather than a second one — but re-declared instead of
 * imported, for two reasons:
 *
 *  1. `eslint-plugin-boundaries` forbids it. A `domain-util` may import
 *     `ALL_DOMAIN_MODELS` and other `domain-util`s; `domain-model-api` is not
 *     on that list ("Keep utilities pure").
 *  2. That module imports `@hono/zod-openapi`, ~21ms of module evaluation.
 *     `database-dialect.ts` is env parsing on the CLI boot path, so importing
 *     it would put the whole OpenAPI stack in front of every `sovrium` run to
 *     borrow three characters.
 *
 * The two are pinned equal behaviourally from the API-side test, which IS
 * allowed to import a domain util — so divergence fails a test rather than
 * relying on this comment being read.
 */
const PLACEHOLDER = '***'

/** RFC 3986 scheme: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":" */
const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/

/** Characters that terminate the authority component (RFC 3986 §3.2). */
const AUTHORITY_TERMINATORS = ['/', '?', '#'] as const

/** Lowest index at which any of `needles` occurs, or -1 if none do. */
const firstIndexOfAny = (haystack: string, needles: readonly string[]): number => {
  const hits = needles.map((needle) => haystack.indexOf(needle)).filter((index) => index !== -1)
  return hits.length === 0 ? -1 : Math.min(...hits)
}

/**
 * No `//`, so there is no authority to decompose — the fail-closed branch.
 *
 * If an `@` appears before the first `/`, `?` or `#` that follows the scheme,
 * the value looks like it carries userinfo but cannot be split with
 * confidence, so the whole thing is elided. Anything else (a bare path, the
 * `:memory:` sentinel, `file:./x.db`) is returned untouched — an `@` LATER in
 * a path is a filename, not a credential.
 */
const redactOpaque = (raw: string): string => {
  const scheme = SCHEME_RE.exec(raw)
  const afterScheme = raw.slice(scheme?.[0]?.length ?? 0)
  const terminator = firstIndexOfAny(afterScheme, AUTHORITY_TERMINATORS)
  const head = terminator === -1 ? afterScheme : afterScheme.slice(0, terminator)
  return head.includes('@') ? PLACEHOLDER : raw
}

/**
 * Replace the password inside a `user:password@` userinfo component with
 * `***`, leaving every other part of the value intact.
 *
 * @param raw - Any string. A `DATABASE_URL`, a bare path, or garbage.
 * @returns The value with its password redacted; never throws.
 *
 * @example
 * redactConnectionUrl('postgres://admin:hunter2@db:5432/app')
 * // 'postgres://admin:***@db:5432/app'
 *
 * @example
 * redactConnectionUrl('postgres://admin@db/app') // unchanged — no password
 *
 * @public
 */
export const redactConnectionUrl = (raw: string): string => {
  const doubleSlash = raw.indexOf('//')
  if (doubleSlash === -1) return redactOpaque(raw)

  const prefix = raw.slice(0, doubleSlash + 2)
  const rest = raw.slice(doubleSlash + 2)
  const terminator = firstIndexOfAny(rest, AUTHORITY_TERMINATORS)
  const authorityEnd = terminator === -1 ? rest.length : terminator
  const authority = rest.slice(0, authorityEnd)
  const tail = rest.slice(authorityEnd)

  // Userinfo runs to the LAST `@` in the authority, not the first. Real
  // passwords contain unencoded `@` (`p@ss:word`), and splitting on the first
  // would leave the remainder of the password sitting in the "host" — i.e.
  // still printed.
  const at = authority.lastIndexOf('@')
  if (at === -1) return raw

  const userinfo = authority.slice(0, at)
  const hostPortAndAt = authority.slice(at)

  // Password runs from the FIRST `:` to the end of the userinfo, so a `:` in
  // the password is absorbed rather than splitting it.
  const separator = userinfo.indexOf(':')
  if (separator === -1) return raw

  return `${prefix}${userinfo.slice(0, separator)}:${PLACEHOLDER}${hostPortAndAt}${tail}`
}
