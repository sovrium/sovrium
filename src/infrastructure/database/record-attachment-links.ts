/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which stored files are linked to a record, and where.
 *
 * The built-in `system` bucket's listing is the console's view of every file an
 * attachment cell references, whichever bucket holds it. The link is READ from
 * the cells on each listing rather than written beside the file at record-write
 * time, on purpose: a record can let go of a file through a create, an update, a
 * batch write, a delete, a soft delete, a restore, an automation or an import,
 * and a link persisted on the file would have to be kept in step by every one of
 * those paths. Reading the cells cannot go stale — a cleared cell, a deleted
 * record and a soft-deleted record all simply stop naming the key.
 *
 * Soft-deleted records are excluded (`deleted_at IS NULL`): every declared
 * table carries the column on its physical relation, which is the relation read
 * here — the `_base` table when the table is served through a view.
 */

import { sql } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { db } from '@/infrastructure/database'
import { logError } from '@/infrastructure/logging/logger'
import { executeRaw } from './sql/dialect-execute'
import {
  collectAttachmentColumns,
  recoverBinding,
  type AttachmentColumn,
} from './storage-bucket-backfill'
import type { App } from '@/domain/models/app'

/** One stored file referenced by one attachment cell of one live record. */
export interface RecordAttachmentLink {
  readonly key: string
  /** The bucket the cell's URL names, or the column's own bucket for a bare key. */
  readonly bucket: string
  /** The table's config name. */
  readonly table: string
  /** The record's primary key, as a string. */
  readonly recordId: string
  /** The attachment field that references the file. */
  readonly field: string
}

/**
 * Normalize a stored cell, whichever dialect wrote it: Postgres hands back a
 * parsed `jsonb`, SQLite the JSON verbatim as TEXT. A string that is not a JSON
 * array or object is a bare storage key.
 */
const parseCell = (raw: unknown): unknown => {
  if (typeof raw !== 'string' || !(raw.startsWith('[') || raw.startsWith('{'))) return raw
  try {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * Every `{ key, bucket }` one attachment cell references: a bare key, a stored
 * metadata object, or — for `multiple-attachments` — an array of either.
 */
export const bindingsOfCell = (
  raw: unknown,
  columnBucket: string
): readonly { readonly key: string; readonly bucket: string }[] => {
  const parsed = parseCell(raw)
  const entries: readonly unknown[] = Array.isArray(parsed) ? parsed : [parsed]
  return entries.flatMap((entry) => {
    const binding = recoverBinding(entry, columnBucket)
    return binding === undefined ? [] : [binding]
  })
}

/** The links one attachment column holds across its live records. */
const linksOfColumn = async (
  target: Readonly<AttachmentColumn>
): Promise<readonly RecordAttachmentLink[]> => {
  const rows = await executeRaw(
    db,
    sql`SELECT ${sql.identifier(target.primaryKey)} AS row_id, ${sql.identifier(target.column)} AS value
        FROM ${sql.identifier(target.relation)}
        WHERE ${sql.identifier(target.column)} IS NOT NULL
          AND deleted_at IS NULL`
  )
  return rows.flatMap((row) =>
    bindingsOfCell(row['value'], target.bucket).map((binding) => ({
      key: binding.key,
      bucket: binding.bucket,
      table: target.table,
      recordId: String(row['row_id']),
      field: target.column,
    }))
  )
}

/** One attachment column's relation could not be read. */
class AttachmentColumnReadError extends Data.TaggedError('AttachmentColumnReadError')<{
  readonly cause: unknown
}> {}

/**
 * How many attachment columns are read at once.
 *
 * Every column read takes a slot from the SHARED pool (`db`), on a request path,
 * and the column count is config-bounded rather than small — an app with ten
 * attachment fields would otherwise hold all ten default slots for the length of
 * one listing, starving every other request behind it, the admin session lookup
 * included. Two is the shared-pool default of
 * `[internal ref]`.
 */
const ATTACHMENT_COLUMN_READ_CONCURRENCY = 2

/**
 * Every file linked to a live record, across every attachment column the app
 * declares. A column whose relation cannot be read is logged and skipped rather
 * than failing the listing: one broken table must not hide every other file.
 */
export const listRecordAttachmentLinks = (
  app: Readonly<App>
): Effect.Effect<readonly RecordAttachmentLink[]> =>
  Effect.forEach(
    collectAttachmentColumns(app),
    (target) =>
      Effect.tryPromise({
        try: () => linksOfColumn(target),
        catch: (cause) => new AttachmentColumnReadError({ cause }),
      }).pipe(
        Effect.catch(({ cause }) =>
          Effect.sync((): readonly RecordAttachmentLink[] => {
            // Swallowed on purpose (see above), and logged with its cause first.
            logError(
              `[record-attachment-links] could not read ${target.relation}.${target.column}`,
              cause
            )
            return []
          })
        )
      ),
    { concurrency: ATTACHMENT_COLUMN_READ_CONCURRENCY }
  ).pipe(Effect.map((perColumn) => perColumn.flat()))
