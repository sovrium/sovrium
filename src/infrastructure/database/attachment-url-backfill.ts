/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time repair of `default`-bound stored attachment URLs.
 *
 * ── What is being repaired ────────────────────────────────────────────────
 * Older releases of `enrichAttachmentMetadata` (the record-create write path)
 * persisted a hardcoded `/api/buckets/default/files/<key>` into every `single-attachment`
 * column declaring `storeMetadata: true`, whatever bucket the column declared.
 * It wrote bad DATA rather than computing a bad response — the read enricher
 * deliberately leaves a `storeMetadata` object untouched (it carries no `key`),
 * so the API echoes the stored value verbatim and fixing the write path alone
 * repairs nothing already on disk.
 *
 * There is no implicit `default` bucket either: the built-in bucket is
 * `system`, and a `/api/buckets/default/...` URL answers 404. So a
 * column that declares NO bucket is repaired too, onto `system` — unless the app
 * declares an ordinary bucket named `default`, in which case such a URL may be
 * right and is left alone.
 *
 * ── Why this is NOT a Drizzle migration ───────────────────────────────────
 * Two independent reasons: `runMigrations` runs BEFORE `initializeSchema`, so
 * on a fresh install the user tables do not exist yet; and `drizzle/**.sql` is
 * static and checked in, able to name only `auth.*` / `system.*` — the tables
 * to repair come from each self-hoster's own config and are unknowable ahead
 * of time.
 *
 * ── Why this is NOT inside `executeMigrationSteps` ────────────────────────
 * THE TRAP. That path sits behind a checksum fast-path whose snapshot input is
 * only `app.tables`, so an operator who upgrades the binary WITHOUT editing
 * their config matches the checksum and never reaches it — precisely the
 * install that has been accumulating bad rows. The repair therefore runs as a
 * post-schema startup step, unconditionally, on every boot.
 *
 * ── Discipline ────────────────────────────────────────────────────────────
 * Log-and-continue, never fail-fast (the discipline of the sibling post-schema
 * seeders, NOT of schema init). A transient database hiccup during a data
 * repair must never take the app offline; the row stays wrong and the next
 * boot retries.
 *
 * Dialect-aware by construction: the repaired column is `JSONB` under Postgres
 * and JSON-in-TEXT under SQLite, so the value reads back parsed on one dialect
 * and as a raw string on the other. Reads go through `executeRaw`
 * (`.execute()` / `.all()`) and writes through `jsonbLiteral`, which already
 * branches on `isSqliteRuntime()`. There is no in-SQL JSON path in this repo,
 * so the rewrite is read-modify-write in TypeScript.
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { db } from '@/infrastructure/database'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from './lookup/lookup-view-generators'
import { executeRaw } from './sql/dialect-execute'
import { shouldCreateDatabaseColumn } from './sql/sql-field-predicates'
import { jsonbLiteral } from './sql/sql-utils'
import type { App, Table } from '@/domain/models/app'

/**
 * The URL prefix the defective write path emitted.
 *
 * The rewrite is anchored on this PREFIX and never on the bare token
 * `default`: `buildUploadStorageKey` emits `<uuid>-<original-filename>`, so a
 * key like `…-default-avatar.png` is perfectly legal and an unanchored
 * `replace('default', …)` would turn a working URL into a dangling one.
 */
const DEFAULT_BUCKET_URL_PREFIX = '/api/buckets/default/files/'

/** The retired name of the built-in bucket, which stored URLs may still carry. */
export const LEGACY_DEFAULT_BUCKET = 'default'

/** One column of one physical relation that may hold rows needing repair. */
export interface RepairTarget {
  /** The PHYSICAL relation — the `_base` table when the table is a view. */
  readonly relation: string
  /** Row identity — `table.primaryKey?.field`, not `id` unconditionally. */
  readonly primaryKey: string
  /** `field.name` IS the column name; there is no mapper. */
  readonly column: string
  /** The bucket the column resolves to (`system` when it declares none), never `default`. */
  readonly bucket: string
}

/**
 * Rewrite a stored attachment metadata object whose `url` names the implicit
 * `default` bucket so it names `bucket` instead.
 *
 * Returns `undefined` when nothing needs rewriting — the value is not a
 * metadata object, carries no string `url`, or its `url` already names some
 * other bucket. That `undefined` IS the idempotence guarantee: re-running the
 * repair over an already-repaired row produces no UPDATE.
 *
 * Only `url` changes; every other property the operator's row carries
 * (`filename`, `mimeType`, `size`, and anything else) is preserved.
 */
export const rebindDefaultBucketUrl = (
  value: unknown,
  bucket: string
): Readonly<Record<string, unknown>> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const { url } = record
  if (typeof url !== 'string' || !url.startsWith(DEFAULT_BUCKET_URL_PREFIX)) return undefined
  const key = url.slice(DEFAULT_BUCKET_URL_PREFIX.length)
  return { ...record, url: `/api/buckets/${bucket}/files/${key}` }
}

/**
 * Normalize a stored cell to an object, whichever dialect wrote it. Postgres
 * hands back a parsed `jsonb`; SQLite hands back the JSON verbatim as TEXT.
 * A non-JSON string is not an error here — it just cannot be repaired.
 */
const parseStoredCell = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw
  try {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Whether the app declares an ordinary bucket named `default` — the retired
 * name of the built-in bucket, which an app may now use freely. When it does, a
 * stored `/api/buckets/default/...` URL or a `default` attribution may be right,
 * so the legacy repairs leave them alone.
 */
export const declaresLegacyDefaultBucket = (app: Readonly<App>): boolean =>
  (app.buckets ?? []).some((bucket) => bucket.name === LEGACY_DEFAULT_BUCKET)

/**
 * Columns of one table that the defective write path could have written.
 *
 * Narrow by construction — `single-attachment` + an explicit
 * `storeMetadata: true` is the ONLY surface that ever persisted a URL. A
 * column bound to a DECLARED bucket named `default` already holds the right
 * answer and is excluded. A column declaring no bucket resolves to the built-in
 * `system` bucket, unless the app declares a `default` bucket of its own: a
 * `/api/buckets/default/...` URL may then be right, so it is left alone.
 */
const collectTableTargets = (
  app: Readonly<App>,
  table: Readonly<Table>
): readonly RepairTarget[] => {
  const sanitized = sanitizeTableName(table.name)
  const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
  const primaryKey = table.primaryKey?.field ?? 'id'

  return table.fields
    .filter(shouldCreateDatabaseColumn)
    .filter(
      (field) =>
        field.type === 'single-attachment' &&
        'storeMetadata' in field &&
        (field as { readonly storeMetadata?: unknown }).storeMetadata === true
    )
    .flatMap((field) => {
      const declared = resolveFieldBucket(app, table.name, field.name)
      if (declared === undefined && declaresLegacyDefaultBucket(app)) return []
      const bucket = declared ?? SYSTEM_BUCKET_NAME
      if (bucket === LEGACY_DEFAULT_BUCKET) return []
      return [{ relation, primaryKey, column: field.name, bucket }]
    })
}

/**
 * Every bucket-bound `storeMetadata` column across the app's tables.
 *
 * Exported for direct unit assertion of the PHYSICAL relation it resolves:
 * A migration attachment URL backfill spec cannot prove that on its own, because
 * a generated view carries INSTEAD OF UPDATE triggers, so an UPDATE
 * mis-targeted at the view would still land on the base table's rows.
 */
export const collectRepairTargets = (app: Readonly<App>): readonly RepairTarget[] =>
  (app.tables ?? []).flatMap((table) => collectTableTargets(app, table))

/**
 * Repair one column of one relation. Returns the number of rows rewritten.
 *
 * The SQL `LIKE` is a cheap pre-filter so an install with nothing to repair
 * pays a scan rather than a rewrite; `rebindDefaultBucketUrl`'s `startsWith`
 * is the authority. `CAST(… AS TEXT)` reads a `jsonb` column on Postgres and a
 * TEXT column on SQLite identically.
 */
const repairTarget = async (target: Readonly<RepairTarget>): Promise<number> => {
  const { relation, primaryKey, column, bucket } = target

  const rows = await executeRaw(
    db,
    sql`SELECT ${sql.identifier(primaryKey)} AS row_id, ${sql.identifier(column)} AS value
        FROM ${sql.identifier(relation)}
        WHERE ${sql.identifier(column)} IS NOT NULL
          AND CAST(${sql.identifier(column)} AS TEXT) LIKE ${`%${DEFAULT_BUCKET_URL_PREFIX}%`}`
  )

  const repairs = rows.flatMap((row) => {
    const rebound = rebindDefaultBucketUrl(parseStoredCell(row['value']), bucket)
    return rebound === undefined ? [] : [{ id: row['row_id'], value: rebound }]
  })

  for (const repair of repairs) {
    await executeRaw(
      db,
      sql`UPDATE ${sql.identifier(relation)}
          SET ${sql.identifier(column)} = ${jsonbLiteral(repair.value)}
          WHERE ${sql.identifier(primaryKey)} = ${repair.id}`
    )
  }

  return repairs.length
}

/**
 * Post-schema startup entry point: rebind every stored attachment URL that
 * still names the retired `default` bucket onto the bucket its column resolves
 * to — its declared bucket, or the built-in `system` one.
 *
 * Best-effort per target AND overall — one unreachable relation must not skip
 * the rest, and no failure may block startup.
 */
export const runAttachmentUrlBackfill = async (app: Readonly<App>): Promise<void> => {
  const targets = collectRepairTargets(app)
  if (targets.length === 0) return

  // Sequential, not `Promise.all`: SQLite serializes writers anyway, and a
  // fan-out over an unbounded number of declared columns would contend for the
  // Postgres pool during boot.
  let repaired = 0
  for (const target of targets) {
    repaired += await repairTarget(target).catch((error: unknown) => {
      logError(
        `[attachment-url-backfill] repair of ${target.relation}.${target.column} failed (non-fatal)`,
        error
      )
      return 0
    })
  }

  if (repaired > 0) {
    logInfo(`[attachment-url-backfill] rebound ${repaired} stored attachment URL(s)`)
  }
}
