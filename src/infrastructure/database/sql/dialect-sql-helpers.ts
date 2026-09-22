/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { or, sql, type SQL, type Column, type Name } from 'drizzle-orm'
import { LIKE_ESCAPE_CHARACTER, escapeLikeMetacharacters } from '@/domain/kernel/sql/sql-formatting'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

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
 * The helpers in this module return the correct fragment for the active
 * dialect, resolved via {@link parseDatabaseDialectConfig} — the canonical
 * single-source-of-truth detector. **Dialect is re-read per call** (not
 * memoized at module init) so test fixtures that swap `DATABASE_URL` mid-test
 * continue to route to the right dialect.
 *
 * @public
 */

/** Resolve the active dialect at call time (NEVER memoize at module init). */
const currentDialect = (): 'postgres' | 'sqlite' => parseDatabaseDialectConfig().dialect

/**
 * Time-bucket truncation for time-series aggregation.
 *
 * - Postgres: `DATE_TRUNC('<bucket>', column)::text` — returns a stable text
 *   representation of the truncated timestamp (e.g. `'2026-05-23 00:00:00+00'`
 *   for day, `'2026-05-23 14:00:00+00'` for hour).
 * - SQLite: `strftime('<format>', column / 1000, 'unixepoch')` — Sovrium's
 *   SQLite timestamp columns are stored as `integer(mode: 'timestamp_ms')`,
 *   so the epoch-ms value must be divided by 1000 before `strftime` reads it
 *   as `unixepoch`. The format strings are chosen so that two events in the
 *   same bucket produce IDENTICAL text — the `GROUP BY` semantics match
 *   Postgres exactly:
 *     - `hour`  → `'%Y-%m-%d %H:00:00'`
 *     - `day`   → `'%Y-%m-%d'`
 *     - `week`  → `'%Y-W%W'` (week-of-year, ISO-divergent — see note below)
 *     - `month` → `'%Y-%m'`
 *
 * Week-of-year divergence
 * -----------------------
 * Postgres `DATE_TRUNC('week', …)` truncates to ISO 8601 week (Monday-start);
 * SQLite `strftime('%W', …)` uses POSIX week-of-year (Monday-start, but the
 * first week is the first one containing 4 days of the new year). For the
 * granularities Sovrium exposes (`hour | day | week | month`), the only
 * surface that uses `week` is the analytics overview time-series, and Sovrium
 * never compares week buckets across dialects in a single deployment — each
 * deployment runs on exactly one engine. The format is documented here for
 * operators who federate analytics data across dialects.
 *
 * @param column - Drizzle column expression (the timestamp source)
 * @param bucket - Time bucket granularity
 */
/* eslint-disable functional/prefer-immutable-types -- SQL | Column are upstream drizzle-orm types; we never mutate them */
export const dateTruncTimeBucket = (
  column: SQL | Column,
  bucket: 'hour' | 'day' | 'week' | 'month'
): SQL => {
  if (currentDialect() === 'sqlite') {
    // SQLite stores timestamps as INTEGER epoch-ms; divide by 1000 before
    // passing to strftime('…', value, 'unixepoch').
    const format = sqliteBucketFormat(bucket)
    return sql`strftime(${format}, ${column} / 1000, 'unixepoch')`
  }
  // Postgres: bucket is a fixed literal from a closed enum, NEVER user input —
  // safe to inline as a SQL keyword. `::text` casts the timestamp result so
  // GROUP BY equality works across drivers (bun-sql vs node-postgres).
  return sql`DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${column})::text`
}

/**
 * `strftime` format strings for each supported time bucket. The format is the
 * `GROUP BY` key — two events in the same bucket MUST produce identical text.
 */
const sqliteBucketFormat = (bucket: 'hour' | 'day' | 'week' | 'month'): string => {
  if (bucket === 'hour') return '%Y-%m-%d %H:00:00'
  if (bucket === 'day') return '%Y-%m-%d'
  if (bucket === 'week') return '%Y-W%W'
  return '%Y-%m'
}

/**
 * Strict allowlist of JSON property keys Sovrium emits today. Extracting any
 * key outside this list throws — the goal is to prevent a future refactor
 * from accidentally widening the surface to user-controlled keys (which
 * would open a SQL-injection vector via the `'$.${key}'` JSONPath
 * concatenation below).
 *
 * Update this list when a new analytics property is promoted in the
 * `analytics-events.properties` JSON.
 */
const ALLOWED_JSON_KEYS = [
  'path',
  'title',
  'referrerDomain',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'deviceType',
  'browserName',
  'osName',
  // Recorded on every link_click / qr_scan event as the index of the target that
  // served it — the attribution key the per-target split groups on. A literal
  // member of this closed enum like every other entry, so it reaches the
  // JSONPath template no differently.
  'targetIndex',
] as const

type AllowedJsonKey = (typeof ALLOWED_JSON_KEYS)[number]

/**
 * Extract a string value from a JSON column at a top-level key.
 *
 * - Postgres: `${jsonColumn}->>'key'` — JSONB string-extraction operator.
 * - SQLite:   `json_extract(${jsonColumn}, '$.key')` — built-in JSON1
 *   function (always enabled in `bun:sqlite`).
 *
 * The two operators produce semantically-identical output for the property
 * shapes Sovrium stores (flat top-level string keys): Postgres returns the
 * underlying string or `NULL`; SQLite returns the string or `NULL`. `GROUP BY`
 * on either expression produces the same buckets.
 *
 * Safety
 * ------
 * `key` is constrained to {@link ALLOWED_JSON_KEYS} — a closed enum of
 * Sovrium-owned property names. The function THROWS for any other key.
 * This is belt-and-suspenders alongside the static type:
 *   1. Static `AllowedJsonKey` rejects typos at compile time.
 *   2. Runtime check rejects dynamically-constructed keys (e.g. from a
 *      future caller that builds the key from `params.field`).
 * Without (2), a refactor could silently introduce SQL injection through
 * the inlined `'$.${key}'` concatenation.
 *
 * @param jsonColumn - The JSON column expression (`properties`, etc.)
 * @param key        - Top-level JSON key (from the allowlist)
 */
/* eslint-disable functional/prefer-immutable-types -- SQL | Column are upstream drizzle-orm types; we never mutate them */
export const jsonExtractPath = (jsonColumn: SQL | Column, key: AllowedJsonKey): SQL => {
  // Belt-and-suspenders: enforce the allowlist at runtime even if a caller
  // bypasses the static type via `as AllowedJsonKey`.
  if (!ALLOWED_JSON_KEYS.includes(key)) {
    // eslint-disable-next-line functional/no-throw-statements -- input-validation guard at a security-critical boundary
    throw new Error(`jsonExtractPath: key "${key}" is not in the allowlist`)
  }
  if (currentDialect() === 'sqlite') {
    // The JSONPath fragment `'$.<key>'` inlines `key` from a CLOSED enum.
    // No user input ever reaches this template — see ALLOWED_JSON_KEYS.
    return sql`json_extract(${jsonColumn}, ${sql.raw(`'$.${key}'`)})`
  }
  return sql`${jsonColumn}->>${sql.raw(`'${key}'`)}`
}

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
/* eslint-disable functional/prefer-immutable-types -- SQL | Column are upstream drizzle-orm types; we never mutate them */
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
 * (`searchTermSchema`, `src/domain/models/api/combinators/search.ts`), and it is
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
/* eslint-disable functional/prefer-immutable-types -- SQL | Column are upstream drizzle-orm types; we never mutate them */
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
/* eslint-disable functional/prefer-immutable-types -- SQL | Column are upstream drizzle-orm types; we never mutate them */
export const startsWithLiteral = (column: LikeOperand, prefix: string): SQL =>
  sql`substr(${column}, 1, ${sql.raw(String(prefix.length))}) = ${prefix}`

/**
 * Time interval in the past, relative to "now", for `WHERE <ts_column> >= …`
 * filters.
 *
 * - Postgres: `NOW() - INTERVAL '<amount> <unit>'` — server-side `now()`,
 *   integer-arithmetic interval. Comparison target is a `timestamp` value,
 *   directly comparable with the `timestamp(withTimezone)` column type.
 * - SQLite:   `(strftime('%s','now','-<amount> <unit>s') * 1000)` — emits
 *   an INTEGER epoch-millisecond value, matching Sovrium's
 *   `integer('created_at', { mode: 'timestamp_ms' })` column shape. Using
 *   `datetime('now', …)` would emit a TEXT `'YYYY-MM-DD HH:MM:SS'` value
 *   which compares incorrectly against INTEGER columns.
 *
 * @param amount - Non-negative integer
 * @param unit   - `'year' | 'month' | 'day' | 'hour'`
 */
/* eslint-disable functional/prefer-immutable-types -- SQL is an upstream drizzle-orm type; we never mutate it */
export const dateIntervalAgo = (amount: number, unit: 'year' | 'month' | 'day' | 'hour'): SQL => {
  // Guard the amount: must be a non-negative integer. `unit` is a closed
  // enum so no runtime check needed beyond the static type.
  if (!Number.isInteger(amount) || amount < 0) {
    // eslint-disable-next-line functional/no-throw-statements -- input-validation guard
    throw new Error(`dateIntervalAgo: amount must be a non-negative integer (got ${amount})`)
  }
  if (currentDialect() === 'sqlite') {
    // Emit an INTEGER epoch-ms value (matches Sovrium's
    // `timestamp_ms` column mode). Both `amount` and `unit` are validated,
    // safe to inline as a SQL function-call literal.
    return sql.raw(`(CAST(strftime('%s','now','-${amount} ${unit}s') AS INTEGER) * 1000)`)
  }
  // Postgres: NOW() - INTERVAL '<amount> <unit>' — `amount` and `unit` are
  // both validated, safe to inline as a SQL interval literal.
  return sql.raw(`NOW() - INTERVAL '${amount} ${unit}'`)
}
