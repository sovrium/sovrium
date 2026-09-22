/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time recovery of the bucket a stored object belongs to.
 *
 * ── What is being recovered ───────────────────────────────────────────────
 * Storage keys are FLAT: every declared bucket addresses one physical
 * keyspace, so the catalog's `bucket` column is the only record of which
 * bucket owns an object. Objects written before that column existed have it
 * NULL, and reads/deletes are FAIL CLOSED — an object with no known owner is
 * refused rather than served through whichever bucket a caller happens to
 * name. Left alone, an upgrade would make every pre-existing attachment and
 * avatar unreadable.
 *
 * Most of them are recoverable, because the app already publishes the binding
 * somewhere else:
 *
 * - `auth.user.image` holds `/api/buckets/avatars/files/<key>` for every
 *   avatar this instance issued.
 * - a `storeMetadata` attachment cell holds `/api/buckets/<bucket>/files/<key>`.
 * - a plain attachment cell holds the bare key, and its COLUMN declares the
 *   bucket (falling back to the implicit `default`) — the same resolution the
 *   read path uses to build the URL.
 *
 * What stays dark: an object referenced from nowhere the config can name — an
 * orphan, or one written straight to the object store out of band. That is the
 * accepted residual of failing closed.
 *
 * ── Why this is NOT a Drizzle migration ───────────────────────────────────
 * Same two reasons as `attachment-url-backfill.ts`: `runMigrations` runs before
 * the user tables exist on a fresh install, and `drizzle/**.sql` is static and
 * can name only `auth.*` / `system.*`, while the tables to read come from each
 * self-hoster's own config.
 *
 * ── Why this is NOT inside `executeMigrationSteps` ────────────────────────
 * That path sits behind a checksum fast path keyed on `app.tables`, so an
 * operator who upgrades the binary WITHOUT editing their config would never
 * reach it — precisely the install that needs the recovery.
 *
 * Log-and-continue, never fail-fast: a database hiccup during a repair must not
 * take the app offline. Unrecovered rows stay NULL and the next boot retries.
 */

import { and, eq, isNull, sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { AVATAR_BUCKET_NAME, avatarStorageKeyFromUrl } from '@/domain/models/app/auth/avatar-url'
import { DEFAULT_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  fileStorageMetadataTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from './lookup/lookup-view-generators'
import { executeRaw } from './sql/dialect-execute'
import { shouldCreateDatabaseColumn } from './sql/sql-field-predicates'
import type { App, Table } from '@/domain/models/app'

/** The URL shape every bucket file is published under. */
const BUCKET_URL_PATTERN = /^\/api\/buckets\/([^/]+)\/files\/(.+)$/

/** One attachment column that may name objects needing attribution. */
interface AttachmentColumn {
  /** The PHYSICAL relation — the `_base` table when the table is a view. */
  readonly relation: string
  /** `field.name` IS the column name; there is no mapper. */
  readonly column: string
  /** The bucket the column declares, or the implicit `default`. */
  readonly bucket: string
}

/**
 * Recover `{ key, bucket }` from one stored attachment cell.
 *
 * A `storeMetadata` object carries the bucket inside its `url` and is
 * authoritative — it records where the object was actually published, which
 * may predate a later change to the column's declared bucket. A bare key
 * carries nothing, so the column's declared bucket is used.
 */
const bindingFromUrl = (
  value: unknown
): { readonly key: string; readonly bucket: string } | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const { url } = value as Record<string, unknown>
  if (typeof url !== 'string') return undefined
  const match = BUCKET_URL_PATTERN.exec(url)
  const bucket = match?.[1]
  const key = match?.[2]
  return bucket && key ? { key, bucket } : undefined
}

export const recoverBinding = (
  value: unknown,
  columnBucket: string
): { readonly key: string; readonly bucket: string } | undefined => {
  const parsed = typeof value === 'string' ? parseMaybeJson(value) : value
  if (typeof parsed === 'string') {
    return parsed.length > 0 ? { key: parsed, bucket: columnBucket } : undefined
  }
  return bindingFromUrl(parsed)
}

/**
 * Normalize a stored cell, whichever dialect wrote it. Postgres hands back a
 * parsed `jsonb`; SQLite hands the JSON back verbatim as TEXT. A non-JSON
 * string is a bare storage key, not an error.
 */
const parseMaybeJson = (raw: string): unknown => {
  if (!raw.startsWith('{')) return raw
  try {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/** Every attachment column across the app's tables. */
export const collectAttachmentColumns = (app: Readonly<App>): readonly AttachmentColumn[] =>
  (app.tables ?? []).flatMap((table: Readonly<Table>) => {
    const sanitized = sanitizeTableName(table.name)
    const relation = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
    return table.fields
      .filter(shouldCreateDatabaseColumn)
      .filter((f) => f.type === 'single-attachment' || f.type === 'multiple-attachments')
      .map((f) => ({
        relation,
        column: f.name,
        bucket: resolveFieldBucket(app, table.name, f.name) ?? DEFAULT_BUCKET_NAME,
      }))
  })

/**
 * Attribute `key` to `bucket`, but only while it has no binding. The
 * `IS NULL` guard is what makes this idempotent AND safe: a row already
 * attributed — by an upload, or by an earlier pass reading a more
 * authoritative source — is never overwritten.
 */
const attribute = async (key: string, bucket: string): Promise<number> => {
  const files = fileStorageMetadataTable()
  const updated = await db
    .update(files)
    .set({ bucket })
    .where(and(eq(files.key, key), isNull(files.bucket)))
    .returning({ key: files.key })
  return updated.length
}

/**
 * Is there anything to recover at all?
 *
 * Steady state is the common case — every object uploaded since the binding
 * shipped carries one — and without this guard every boot would scan every
 * attachment column of every table forever. The `bucket` column is indexed, so
 * a settled install pays one indexed lookup and stops.
 */
const hasUnattributedObjects = async (): Promise<boolean> => {
  const files = fileStorageMetadataTable()
  const rows = await db.select({ key: files.key }).from(files).where(isNull(files.bucket)).limit(1)
  return rows.length > 0
}

/** Recover avatar objects from the `image` column every issued URL is stored in. */
const recoverAvatars = async (): Promise<number> => {
  const users = authUsersTable()
  const rows = await db.select({ image: users.image }).from(users)
  const keys = rows
    .map((row) => avatarStorageKeyFromUrl(row.image))
    .filter((key): key is string => key !== undefined)
  const counts = await Promise.all(keys.map((key) => attribute(key, AVATAR_BUCKET_NAME)))
  return counts.reduce((total, n) => total + n, 0)
}

/** Recover the objects one attachment column names. */
const recoverColumn = async (target: Readonly<AttachmentColumn>): Promise<number> => {
  const rows = await executeRaw(
    db,
    sql`SELECT ${sql.identifier(target.column)} AS value
        FROM ${sql.identifier(target.relation)}
        WHERE ${sql.identifier(target.column)} IS NOT NULL`
  )
  const bindings = rows.flatMap((row) => {
    const recovered = recoverBinding(row['value'], target.bucket)
    return recovered === undefined ? [] : [recovered]
  })
  const counts = await Promise.all(bindings.map((b) => attribute(b.key, b.bucket)))
  return counts.reduce((total, n) => total + n, 0)
}

/**
 * Post-schema startup entry point: attribute every stored object whose owning
 * bucket the config can still name.
 *
 * Best-effort per source AND overall — one unreadable relation must not skip
 * the rest, and no failure may block startup.
 */
export const runStorageBucketBackfill = async (app: Readonly<App>): Promise<void> => {
  const pending = await hasUnattributedObjects().catch((error: unknown) => {
    logError('[storage-bucket-backfill] could not probe for unattributed objects', error)
    return false
  })
  if (!pending) return

  const avatars = await recoverAvatars().catch((error: unknown) => {
    logError('[storage-bucket-backfill] avatar recovery failed (non-fatal)', error)
    return 0
  })

  // Sequential, not `Promise.all`: SQLite serializes writers anyway, and a
  // fan-out over an unbounded number of declared columns would contend for the
  // Postgres pool during boot.
  // eslint-disable-next-line functional/no-let -- accumulator for the sequential loop below
  let attachments = 0
  // eslint-disable-next-line functional/no-loop-statements -- sequential per-column recovery
  for (const target of collectAttachmentColumns(app)) {
    // eslint-disable-next-line functional/no-expression-statements -- accumulate recovered count
    attachments += await recoverColumn(target).catch((error: unknown) => {
      logError(
        `[storage-bucket-backfill] recovery of ${target.relation}.${target.column} failed (non-fatal)`,
        error
      )
      return 0
    })
  }

  const recovered = avatars + attachments
  if (recovered > 0) {
    logInfo(`[storage-bucket-backfill] attributed ${recovered} stored object(s) to their bucket`)
  }
}
