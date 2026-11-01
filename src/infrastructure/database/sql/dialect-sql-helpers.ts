/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { or, sql, type SQL, type Column, type Name } from 'drizzle-orm'
import { LIKE_ESCAPE_CHARACTER, escapeLikeMetacharacters } from '@/domain/kernel/sql/sql-formatting'

/**
 * What the case-insensitive LIKE helpers accept on their left-hand side.
 *
 * `Name` is what `sql.identifier(...)` returns, and two of the three call sites
 * pass one — a runtime-resolved physical column name rather than a typed
 * Drizzle column. Omitting it is why the first attempt at a shared helper did
 * not type-check against its own callers.
 */
export type LikeOperand = SQL | Column | Name

/**
 * Dialect-aware SQL fragment helpers.
 *
 * Sovrium runs on two database engines — PostgreSQL (Drizzle on `bun:sql`) and
 * SQLite (Drizzle on `bun:sqlite`, the zero-config default). Most query-builder
 * call sites are dialect-agnostic, but a handful of analytics + activity-log
 * aggregations need raw SQL fragments (`DATE_TRUNC`, `properties->>'key'`,
 * `NOW() - INTERVAL '1 year'`) whose syntax differs between dialects.
 *
 * A fragment that differs per engine lives on `DialectSqlStrategy`, read from
 * the `dialect` the `Database` service carries. The helpers left in this module
 * spell one fragment both engines accept.
 *
 * @public
 */

/**
 * Case-insensitive substring match, portable across both engines and literal in
 * the caller's text.
 *
 * ## Why `lower(col) LIKE lower(pattern)` and not `ILIKE`
 *
 * `ILIKE` is PostgreSQL-only and SQLite rejects it outright with
 * `near "ilike": syntax error`. This spelling is case-insensitive BY
 * CONSTRUCTION on both, so unlike the other helpers in this module it does not
 * branch on the dialect — it belongs here because the dialects diverge, not
 * because the emitted SQL does. Bare `LIKE` is not a neutral fallback either: it
 * is case-SENSITIVE on Postgres and ASCII-case-INSENSITIVE on SQLite, so it
 * silently means two different things per engine.
 *
 * That spelling was independently re-derived at three call sites — trash-filter
 * `contains`, command-palette search, and the user directory. The user directory
 * is where the cost showed: it was written with `ILIKE`, and because its
 * agent-exclusion predicate is UNCONDITIONAL that did not merely break search,
 * it returned 500 on **every** authenticated request on SQLite.
 *
 * ## Why this takes RAW TEXT and not a pattern
 *
 * The earlier helper took a fully-built `%…%` pattern. That made forgetting to
 * escape the default and left each caller free to get it wrong independently —
 * and all three did, so a palette search for `50%` returned every row containing
 * `50`, and `C:\Users` found the row on SQLite and nothing at all on Postgres
 * (where `\` is the default escape). Taking raw text and owning both the
 * escaping and the wildcards makes an unescaped pattern unrepresentable rather
 * than merely discouraged. A caller that genuinely wants wildcard semantics has
 * to reach for something else, visibly.
 *
 * Escaping composes with folding: `lower()` leaves the injected `\` prefixes
 * untouched, so `Sale 50\% off` folds to `sale 50\% off` with the escape intact.
 *
 * ## Honest limits
 *
 * `lower()` is locale-aware on Postgres but ASCII-only on SQLite without ICU, so
 * a non-ASCII name ("MÜLLER" vs "müller") still matches on Postgres and not on
 * SQLite. That gap fails SOFT — a search misses a row rather than the query
 * refusing to run. Postgres also gives up a `gin_trgm_ops` index opportunity;
 * every current caller bounds its result set, so this is a capped scan.
 *
 * @param column - Drizzle column expression, or a `sql.identifier(...)`
 * @param text   - The caller's raw search text (bound as a param, matched literally)
 */
export const containsInsensitive = (column: LikeOperand, text: string): SQL =>
  sql`lower(${column}) LIKE lower(${`%${escapeLikeMetacharacters(text)}%`}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`

/**
 * The optional `?q=` predicate for a list endpoint: the term occurs in ANY of
 * the given columns, as a case-insensitive literal substring.
 *
 * Returns a `WHERE`-conditions ARRAY rather than a single condition, so a caller
 * spreads it into its condition list and an absent term contributes NOTHING:
 *
 * ```ts
 * const conditions = [
 *   ...buildTypeConditions(filters),
 *   ...searchAnyColumn(filters.q, files.filename, files.key),
 *   ...buildCursorConditions(filters),
 * ]
 * ```
 *
 * ## Why an EMPTY array and not a false predicate
 *
 * "No term" means **no narrowing** — the unfiltered page — never "match
 * nothing". An operator who clears the search box expects the list back, and a
 * helper that returned `sql\`false\`` (or a `%%` pattern that matched
 * everything) would leave them staring at a blank table, or at a search that
 * answers "all". That distinction is the whole behaviour of the search contract
 * (`searchTermSchema`, `src/domain/models/api/search-term.ts`), and it is
 * stated HERE once rather than re-derived per endpoint.
 *
 * ## Why it exists at all
 *
 * The three-line body below was written out at each of the three admin list
 * repositories that migrated to server-side search, and it composes two things a
 * re-derivation gets wrong independently: {@link containsInsensitive} (whose own
 * docblock records being mis-spelled at three call sites, once badly enough to
 * 500 every authenticated request on SQLite), and drizzle's `or()`, which
 * returns `SQL | undefined` and so needs a guard that is easy to drop. The next
 * endpoint to migrate — automation runs, connections, form submissions — should
 * inherit both by calling this, not by copying it.
 *
 * The CHOICE of columns deliberately stays at the call site: which fields a
 * given endpoint searches, and which it pointedly does not (a bucket's
 * `mimeType`, a user's `role`), is a product decision that belongs next to the
 * endpoint it describes.
 *
 * @param term    - The parsed search term; `undefined` or empty means "no search"
 * @param columns - The columns to match across (OR-ed)
 */
export const searchAnyColumn = (
  term: string | undefined,
  ...columns: readonly LikeOperand[]
): ReadonlyArray<SQL> => {
  if (term === undefined || term.length === 0) return []
  const match = or(...columns.map((column) => containsInsensitive(column, term)))
  return match !== undefined ? [match] : []
}

/**
 * Case-insensitive "does NOT end with this text", spelled `NOT LIKE` rather than
 * as drizzle's `not(...)`.
 *
 * `not()` emits a bare `not ${condition}` with no parentheses. That happens to be
 * correct here — `NOT` binds looser than `LIKE` on both engines — but it is
 * correct by OPERATOR PRECEDENCE rather than by construction, and a predicate
 * that decides which rows are DISCLOSED should not rest on a reader recalling
 * precedence tables.
 *
 * It escapes its suffix through the same {@link escapeLikeMetacharacters} as
 * {@link containsInsensitive} even though its only caller today passes a fixed
 * internal constant with no metacharacter in it. The escaping is not for the
 * suffix that exists, it is for the day that suffix gains a `_` — an exclusion
 * predicate that silently WIDENS is how excluded rows become disclosed rows, and
 * nothing about that failure is loud.
 *
 * @param column - Drizzle column expression, or a `sql.identifier(...)`
 * @param suffix - The raw trailing text to exclude (matched literally)
 */
export const notEndsWithInsensitive = (column: LikeOperand, suffix: string): SQL =>
  sql`lower(${column}) NOT LIKE lower(${`%${escapeLikeMetacharacters(suffix)}`}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`

/**
 * Case-SENSITIVE "starts with this exact text", portable across both engines and
 * literal in the caller's text.
 *
 * The counterpart to {@link containsInsensitive}, for the knobs whose value is a
 * machine identifier rather than an operator's prose — a mimeType prefix
 * (`image/`), a key namespace. Those match a vocabulary that is canonically
 * lower-case and whose EXACT arm is a plain `=`, so folding case here would let
 * one knob hold two rules: `?type=IMAGE/` matching while `?type=IMAGE/PNG` does
 * not.
 *
 * ## Why NOT `LIKE 'prefix%'`, with or without ESCAPE
 *
 * Because bare `LIKE` is not one operator. It is case-SENSITIVE on PostgreSQL
 * and ASCII-case-INSENSITIVE on SQLite — the same divergence
 * {@link containsInsensitive} exists to close, in the other direction — and
 * **`ESCAPE` does not change that**. Measured against `bun:sqlite` over rows of
 * `image/png`:
 *
 * ```text
 * mime LIKE 'IMAGE/%'                → 2 rows
 * mime LIKE 'IMAGE/%' ESCAPE '\'     → 2 rows      ← the escape clause is orthogonal
 * substr(mime, 1, 6) = 'IMAGE/'      → 0 rows
 * ```
 *
 * SQLite has no per-expression case override (`case_sensitive_like` is a
 * connection-wide PRAGMA, and `GLOB` is SQLite-only with its own metacharacter
 * set), so no LIKE spelling can deliver this. Comparing a slice can, on both
 * engines, without branching on the dialect — same reason
 * {@link containsInsensitive} lives here without a branch.
 *
 * ## Literal by CONSTRUCTION, not by escaping
 *
 * There is no pattern language here, so `%` and `_` in the caller's prefix are
 * ordinary characters with nothing to neutralise: `image%/` matches only a value
 * that literally begins `image%/`, and cannot widen into `image/png` the way an
 * unescaped LIKE wildcard would. That makes the property structural rather than
 * dependent on an {@link escapeLikeMetacharacters} call a re-derivation can
 * forget — which is what the hand-rolled `like()` this replaced did forget,
 * emitting escapes with no `ESCAPE` clause to give them meaning.
 *
 * ## Honest limits
 *
 * The length is JS's `String.length` (UTF-16 code units) while both engines
 * count characters, so a prefix containing an astral-plane character (an emoji)
 * would compare a slice of the wrong width and match nothing. It fails SOFT — a
 * row is missed, the query still runs — and the values this serves (mimeTypes,
 * key namespaces) are ASCII by specification. No index is given up either: the
 * column this serves carries none, and the endpoint's own `?q=` predicate
 * already scans.
 *
 * @param column - Drizzle column expression, or a `sql.identifier(...)`
 * @param prefix - The raw leading text to match (bound as a param, matched literally)
 */
export const startsWithLiteral = (column: LikeOperand, prefix: string): SQL =>
  sql`substr(${column}, 1, ${sql.raw(String(prefix.length))}) = ${prefix}`
