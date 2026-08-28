/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, desc, eq, gt, gte, lt, or, sql, type Column, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminBucketFilesDatabaseError,
  AdminBucketFilesRepository,
  type AdminBucketFileRow,
  type AdminBucketFilesListFilters,
} from '@/application/ports/repositories/buckets/admin-bucket-files-repository'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { STORAGE_KEY_UUID_PREFIX_LENGTH } from '@/domain/utils/storage-key'
import { db } from '@/infrastructure/database'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import {
  searchAnyColumn,
  startsWithLiteral,
} from '@/infrastructure/database/sql/dialect-sql-helpers'

/** Wrap a DB promise, adapting failures to AdminBucketFilesDatabaseError. */
const wrap = makeDbWrap((cause) => new AdminBucketFilesDatabaseError({ cause }))

/**
 * Build the optional mimeType filter condition list. A `typePrefix` (`image/`)
 * matches by literal leading text; a `typeExact` (`image/png`) resolves to a
 * strict `=` match — the use case routes anything not ending in `/` through
 * `typeExact`. Spread immutably so the result is a frozen ReadonlyArray<SQL>.
 *
 * Both arms are case-SENSITIVE, and that agreement is the point. This function
 * previously hand-rolled its prefix arm as drizzle's bare `like()`, which is
 * case-sensitive on PostgreSQL and ASCII-case-INSENSITIVE on SQLite: one
 * request, one dataset, two answers (`?type=IMAGE/` returned nothing on
 * PostgreSQL and every PNG on SQLite), while `?type=IMAGE/PNG` returned nothing
 * on either because the exact arm's `eq()` never folded case. One knob cannot
 * hold two rules, so the prefix arm is aligned to its own sibling —
 * {@link startsWithLiteral}, which is case-sensitive AND metacharacter-literal
 * by construction on both engines. See that helper for why no `LIKE` spelling,
 * escaped or not, can deliver this on SQLite.
 */
const buildTypeConditions = (filters: AdminBucketFilesListFilters): ReadonlyArray<SQL> => {
  const files = fileStorageMetadataTable()
  if (filters.typeExact !== undefined) {
    return [eq(files.mimeType, filters.typeExact)]
  }
  if (filters.typePrefix !== undefined) {
    return [startsWithLiteral(files.mimeType, filters.typePrefix)]
  }
  return []
}

/**
 * Build the optional `?q=` free-text predicate: the term occurs in `filename`
 * OR in the storage `key`.
 *
 * {@link searchAnyColumn} rather than {@link startsWithLiteral} above it,
 * because this term carries an OPERATOR's prose rather than a machine mimeType
 * prefix — so it folds case where the type knob pointedly does not, and matches
 * anywhere in the value rather than only at its start. It is the one portable
 * spelling of the properties the contract promises:
 * `lower(col) LIKE lower(pattern)` (bare `LIKE` is case-SENSITIVE on Postgres
 * and case-INSENSITIVE on SQLite, and `ILIKE` does not exist on SQLite), `%` /
 * `_` escaped so `50%` finds the files containing `50%` instead of every file in
 * the bucket, and an ESCAPE clause declared explicitly rather than left to two
 * dialects that disagree about the default.
 *
 * `mimeType` is deliberately NOT searched — the `type` knob owns that, and a
 * term leaking into it would make `?type=image/&q=png` answer a question the
 * toolbar never showed the operator asking.
 *
 * Empty when no term was supplied, so the page stays unfiltered: clearing the
 * box must restore the browser, not blank it.
 */
const buildSearchConditions = (filters: AdminBucketFilesListFilters): ReadonlyArray<SQL> => {
  const files = fileStorageMetadataTable()
  return searchAnyColumn(filters.q, files.filename, files.key)
}

/**
 * The name the browser SHOWS for a stored file, as a SQL expression.
 *
 * Sovrium stores an upload under a `<uuid>-<filename>` key and records that
 * whole basename as `file_storage_metadata.filename`; the list projection strips
 * the prefix before rendering (`stripStorageKeyUuidPrefix`). So the column and
 * the cell disagree, and `ORDER BY filename` would order the browser by four
 * random UUIDs while presenting four names — an ordering that looks arbitrary
 * because it IS arbitrary. Sorting has to run over what the reader can see.
 *
 * The prefix is fixed-width, so the strip is a slice guarded by a shape test:
 * `_` matches exactly one character in a LIKE pattern on both engines, which
 * makes `________-____-____-____-____________-%` a portable "does this begin
 * with something UUID-shaped". The width comes from
 * {@link STORAGE_KEY_UUID_PREFIX_LENGTH} rather than being counted out here, so
 * this expression and the JS strip cannot drift apart on the number.
 *
 * Honest limit: LIKE has no character classes, so this tests the SHAPE
 * (8-4-4-4-12 with dashes) where the JS regex additionally tests that those
 * characters are hex. A filename contrived to match the shape with a non-hex
 * character would sort by its tail while displaying in full. It fails SOFT — one
 * row orders oddly, nothing is lost or hidden — and no key Sovrium generates can
 * reach it, since those prefixes are real UUIDs.
 */
/* eslint-disable functional/prefer-immutable-types -- SQL / Column are upstream drizzle-orm types (structurally mutable); these builders return them untouched and never mutate one */
const displayFilename = (): SQL => {
  const files = fileStorageMetadataTable()
  const shape = `${'_'.repeat(8)}-${'_'.repeat(4)}-${'_'.repeat(4)}-${'_'.repeat(4)}-${'_'.repeat(12)}-%`
  const tail = sql.raw(String(STORAGE_KEY_UUID_PREFIX_LENGTH + 1))
  return sql`CASE WHEN ${files.filename} LIKE ${shape} THEN substr(${files.filename}, ${tail}) ELSE ${files.filename} END`
}

/**
 * The ordering expression for one sort key — the SINGLE place a key becomes a
 * column, read by BOTH the `ORDER BY` and the cursor seek.
 *
 * There used to be two such places and they were kept in agreement by hand, plus
 * a third in the use case that encodes the cursor VALUE. That third one is the
 * dangerous one: a seek disagreeing with an ordering still answers 200 and still
 * looks perfectly sorted on any single page, and only reveals itself as skipped
 * or repeated rows once someone walks the pages. Adding a sort key means adding
 * it here, to `bucketFilesSortSchema`, and to `cursorValueForItem` — the three
 * are one contract.
 *
 * ## Why the string keys fold case
 *
 * `ORDER BY <text column>` is not one ordering. SQLite applies BINARY collation
 * — raw byte order, which puts every capitalised name in a block ahead of every
 * lower-case one — while Postgres applies the database collation, normally
 * dictionary order. The same bucket would therefore present two different
 * browsers depending on which engine is underneath, and the naive fix passes on
 * Postgres (what CI defaults to) while shipping the wrong order on SQLite (what
 * every self-hoster runs). `lower()` is the one spelling both engines agree on,
 * it is what an operator reading an alphabetical file list expects — `README.md`
 * next to `readme-old.md`, not in a separate uppercase block — and it is already
 * how the `?q=` path folds (see `searchAnyColumn`).
 *
 * Two names equal under `lower()` are separated by the `id` tie-break, so the
 * `(<sortKey>, id)` tuple stays strictly monotonic and the cursor never revisits
 * a row.
 */
/* eslint-disable functional/prefer-immutable-types -- SQL / Column are upstream drizzle-orm types (structurally mutable); these builders return them untouched and never mutate one */
const sortColumnExpression = (sort: AdminBucketFilesListFilters['sort']): SQL | Column => {
  const files = fileStorageMetadataTable()
  if (sort === 'size') return files.size
  if (sort === 'createdAt') return files.createdAt
  if (sort === 'mimeType') return sql`lower(${files.mimeType})`
  return sql`lower(${displayFilename()})`
}

/**
 * Coerce a cursor's `value` half into the bound term the seek compares against
 * {@link sortColumnExpression} for the same key.
 *
 * The two must be symmetric or the seek lands in a different place from the
 * ordering. `createdAt` binds a `Date` so drizzle renders the column's native
 * type on both dialects (timestamptz vs epoch-ms); `size` binds a `Number`; the
 * string keys are folded by SQL `lower()` rather than by JS `toLowerCase()`, so
 * both sides of the comparison fold under the SAME rule — JS folds the full
 * Unicode range while SQLite's `lower()` is ASCII-only, and mixing the two would
 * make the seek disagree with the ordering exactly where a non-ASCII name sits.
 */
/* eslint-disable functional/prefer-immutable-types -- SQL / Column are upstream drizzle-orm types (structurally mutable); these builders return them untouched and never mutate one */
const cursorBoundValue = (
  sort: AdminBucketFilesListFilters['sort'],
  value: string
): SQL | Readonly<Date> | number => {
  if (sort === 'size') return Number(value)
  if (sort === 'createdAt') return new Date(value)
  return sql`lower(${value})`
}

/**
 * Present a sort expression to drizzle's comparison builders.
 *
 * `gt` / `lt` / `eq` are overloaded on `Column` OR `SQL`, never on their union,
 * so a value typed as the union matches no overload even though every one of
 * them accepts it at runtime — the builders emit `sql\`${left} > ${…}\`` and
 * both variants are SQLWrappers the template renders identically. Passing the
 * `Column` through unwrapped rather than folding it into an `SQL` is load
 * bearing, not cosmetic: it is what lets drizzle bind the right-hand value with
 * the COLUMN's driver mapper, which is how a `Date` reaches SQLite as epoch-ms
 * instead of as an object the driver rejects.
 */
/* eslint-disable functional/prefer-immutable-types -- SQL / Column are upstream drizzle-orm types (structurally mutable); these builders return them untouched and never mutate one */
const comparable = (expression: SQL | Column): SQL => expression as SQL

/**
 * Build the deterministic cursor-seek predicate for the `(<sortKey>, id)` tuple.
 * For `desc`: rows strictly "after" the cursor are `sortExpr < value OR (sortExpr
 * = value AND id < id)`. For `asc`: the mirror with `>`. Returns an empty list
 * when no cursor is set (first page).
 *
 * The comparison runs over {@link sortColumnExpression} — the SAME expression
 * the `ORDER BY` uses, not merely the same column. That distinction is the whole
 * point for the folded string keys: seeking on the raw column while ordering on
 * `lower()` would skip or repeat rows at every page boundary whose neighbours
 * differ only in case.
 */
const buildCursorConditions = (filters: AdminBucketFilesListFilters): ReadonlyArray<SQL> => {
  if (filters.cursor === undefined) return []
  const files = fileStorageMetadataTable()
  const { value, id } = filters.cursor

  const sortExpr = comparable(sortColumnExpression(filters.sort))
  const sortValue = cursorBoundValue(filters.sort, value)

  const beyond = filters.order === 'asc' ? gt(sortExpr, sortValue) : lt(sortExpr, sortValue)
  const tieBreak = filters.order === 'asc' ? gt(files.id, id) : lt(files.id, id)
  const seek = or(beyond, and(eq(sortExpr, sortValue), tieBreak))
  return seek !== undefined ? [seek] : []
}

/**
 * Drizzle implementation for {@link AdminBucketFilesRepository.listFiles}.
 * Pulled out of the `wrap()` callback so the latter stays under the complexity
 * cap. Fetches `limit + 1` rows ordered by the `(<sortKey>, id)` tuple so the
 * use case can derive `hasMore`.
 */
const listFilesImpl = async (
  filters: AdminBucketFilesListFilters
): Promise<ReadonlyArray<AdminBucketFileRow>> => {
  const files = fileStorageMetadataTable()
  // All three knobs AND together. The search sits INSIDE the same WHERE as the
  // cursor seek, which is what makes the `limit + 1` overfetch an overfetch of
  // MATCHES — so `nextCursor` walks the match stream and terminates on it,
  // rather than offering pages a six-result search does not have.
  const conditions = [
    ...buildTypeConditions(filters),
    ...buildSearchConditions(filters),
    ...buildCursorConditions(filters),
  ]

  const sortCol = sortColumnExpression(filters.sort)
  const direction = filters.order === 'asc' ? asc : desc
  // `id` is the deterministic tie-breaker — same direction as the primary key so
  // the `(<sortKey>, id)` tuple is strictly monotonic and the cursor never
  // revisits a row.
  const orderBy: ReadonlyArray<SQL> = [direction(sortCol), direction(files.id)]

  const query = db
    .select({
      id: files.id,
      key: files.key,
      filename: files.filename,
      mimeType: files.mimeType,
      size: files.size,
      createdAt: files.createdAt,
    })
    .from(files)
    .orderBy(...orderBy)
    .limit(filters.limit + 1)

  const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query
  return rows as ReadonlyArray<AdminBucketFileRow>
}

/**
 * Admin Bucket Files Repository Implementation (Drizzle).
 *
 * Three dialect-aware reads over `system.file_storage_metadata` backing the
 * admin bucket file browser and the storage overview's upload series. All
 * projection / cursor / pagination / bucketing logic lives in the application
 * layer; this layer emits only raw queries. Dialect
 * resolution is handled by the per-call `fileStorageMetadataTable()` selector
 * (PG `system.file_storage_metadata` vs SQLite flat
 * `system_file_storage_metadata`).
 *
 * Sovrium today backs every named bucket with a single virtual "default"
 * bucket, so the listing reads ALL metadata rows — the per-named-bucket
 * projection is a Phase-1 concern. This replicates the legacy basic handler's
 * "all keys" semantics (the spec asserts non-empty / shape / ordering, not
 * per-bucket scoping).
 */
export const AdminBucketFilesRepositoryLive = Layer.succeed(AdminBucketFilesRepository, {
  listFiles: (filters) => wrap(async () => listFilesImpl(filters)),

  sumTotalBytes: wrap(async () => {
    const files = fileStorageMetadataTable()
    const rows = (await db
      .select({ total: sql<number | string | null>`COALESCE(SUM(${files.size}), 0)` })
      .from(files)) as ReadonlyArray<{ total: number | string | null }>
    return toFiniteCount(rows[0]?.total)
  }),

  listUploadsSince: (since) =>
    wrap(async () => {
      // Upload-series source. `createdAt` is bound as a `Date`, which drizzle
      // renders as a timestamptz comparison on Postgres and as epoch-ms on
      // SQLite (`timestamp_ms` mode) — the same binding the file-browser's
      // date cursor already relies on.
      const files = fileStorageMetadataTable()
      return (await db
        .select({ size: files.size, createdAt: files.createdAt })
        .from(files)
        .where(gte(files.createdAt, since))) as ReadonlyArray<{
        size: number
        createdAt: Date | string | number
      }>
    }),
})
