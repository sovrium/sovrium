/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { DatabaseError } from '@/domain/errors'
import { LIKE_ESCAPE_CHARACTER, escapeLikeMetacharacters } from '@/domain/kernel/sql/sql-formatting'
import { parseBucketFileUrl } from '@/domain/kernel/url/bucket-file-url'
import { db } from '@/infrastructure/database'
import { executeRaw } from '../../sql/dialect-execute'
import { collectAttachmentColumns, type AttachmentColumn } from '../../storage-bucket-backfill'
import type { FileReferenceExclusion } from '@/application/ports/repositories/tables/table-file-references'
import type { App } from '@/domain/models/app'

/**
 * Whether a stored file is still named by a record: any attachment column of
 * any table, a single cell or a list, a bare key or a metadata object, trashed
 * records included. Read as the system — the question is about the file, not
 * about what one person may see.
 *
 * Each column is narrowed in SQL by a text match on the key (`CAST … AS TEXT`
 * reads a PostgreSQL `jsonb` list and a SQLite JSON text alike), then every
 * candidate cell is parsed and compared exactly, so a key that merely contains
 * another one is not a match.
 */

// sql-literal: keyword -- the escape character is a module constant
const LIKE_ESCAPE = sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)

/** Candidates read per column; a column with more cells containing the text answers "named". */
const CANDIDATE_LIMIT = 50

/** The key a metadata object names: its bucket URL's, else its own `key`. */
const keyOfObject = (cell: Readonly<Record<string, unknown>>): readonly string[] => {
  const fromUrl = typeof cell['url'] === 'string' ? parseBucketFileUrl(cell['url'])?.key : undefined
  if (fromUrl !== undefined) return [fromUrl]
  return typeof cell['key'] === 'string' ? [cell['key']] : []
}

/** The storage keys one attachment cell names, whatever shape it was stored in. */
const keysInCell = (value: unknown): readonly string[] => {
  const parsed = typeof value === 'string' ? parseJson(value) : value
  if (Array.isArray(parsed)) return parsed.flatMap(keysInCell)
  if (typeof parsed === 'string') return parsed === '' ? [] : [parsed]
  return parsed !== null && typeof parsed === 'object'
    ? keyOfObject(parsed as Readonly<Record<string, unknown>>)
    : []
}

const parseJson = (text: string): unknown => {
  if (!text.startsWith('[') && !text.startsWith('{')) return text
  try {
    // @effect-diagnostics effect/preferSchemaOverJson:off
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** A key JSON would escape could miss the text match, so it is never answered "not named". */
const isJsonVerbatim = (key: string): boolean => !/["\\\p{Cc}]/u.test(key)

/** The attachment columns of one table: what one reference query reads. */
interface TableColumns {
  readonly table: string
  readonly relation: string
  readonly primaryKey: string
  readonly columns: readonly string[]
}

const byTable = (targets: readonly AttachmentColumn[]): readonly TableColumns[] =>
  Object.values(
    targets.reduce<Readonly<Record<string, TableColumns>>>((groups, target) => {
      const group = groups[target.table]
      const columns = [...(group?.columns ?? []), target.column]
      return { ...groups, [target.table]: { ...target, columns } }
    }, {})
  )

/** `AND <primary key> <> <id>` on the table a check leaves a record out of; empty elsewhere. */
const exclusionOf = (group: TableColumns, except: FileReferenceExclusion | undefined) =>
  except === undefined || except.tableName !== group.table
    ? sql``
    : sql` AND CAST(${sql.identifier(group.primaryKey)} AS TEXT) <> ${except.recordId}`

/** The rows of `group` whose attachment cells contain the key's text, any column. */
const candidatesOf = (
  group: TableColumns,
  pattern: string,
  except: FileReferenceExclusion | undefined
) => {
  const matches = group.columns.map(
    (column) => sql`CAST(${sql.identifier(column)} AS TEXT) LIKE ${pattern} ESCAPE ${LIKE_ESCAPE}`
  )
  return executeRaw(
    db,
    sql`SELECT ${sql.join(
      group.columns.map((column) => sql.identifier(column)),
      sql`, `
    )}
        FROM ${sql.identifier(group.relation)}
        WHERE (${sql.join(matches, sql` OR `)})${exclusionOf(group, except)}
        LIMIT ${CANDIDATE_LIMIT}`
  )
}

export function isFileNamedByAnyRecord(
  app: App,
  key: string,
  except?: FileReferenceExclusion
): Effect.Effect<boolean, DatabaseError> {
  if (!isJsonVerbatim(key)) return Effect.succeed(true)
  const pattern = `%${escapeLikeMetacharacters(key)}%`
  return Effect.tryPromise({
    // One table at a time — every attachment column of it in one query —
    // stopping at the first that names the key: a check pays one pooled
    // query per table holding attachments at most, whatever their width.
    try: async () => {
      for (const group of byTable(collectAttachmentColumns(app))) {
        const rows = await candidatesOf(group, pattern, except)
        const named =
          rows.length >= CANDIDATE_LIMIT ||
          rows.some((row) => group.columns.some((column) => keysInCell(row[column]).includes(key)))
        if (named) return true
      }
      return false
    },
    catch: (error) => new DatabaseError('Failed to check which records name a stored file', error),
  })
}
