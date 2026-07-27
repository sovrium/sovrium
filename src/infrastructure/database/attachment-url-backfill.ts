/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from './lookup/lookup-view-generators'
import { executeRaw } from './sql/dialect-execute'
import { jsonbLiteral } from './sql/sql-utils'
import { shouldCreateDatabaseColumn } from './table-queries/shared/field-utils'
import type { App, Table } from '@/domain/models/app'

const DEFAULT_BUCKET_URL_PREFIX = '/api/buckets/default/files/'

const DEFAULT_BUCKET = 'default'

export interface RepairTarget {
  readonly relation: string
  readonly primaryKey: string
  readonly column: string
  readonly bucket: string
}

export const rebindDefaultBucketUrl = (
  value: unknown,
  bucket: string
): Record<string, unknown> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const { url } = record
  if (typeof url !== 'string' || !url.startsWith(DEFAULT_BUCKET_URL_PREFIX)) return undefined
  const key = url.slice(DEFAULT_BUCKET_URL_PREFIX.length)
  return { ...record, url: `/api/buckets/${bucket}/files/${key}` }
}

const parseStoredCell = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

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
      const bucket = resolveFieldBucket(app, table.name, field.name)
      if (bucket === undefined || bucket === DEFAULT_BUCKET) return []
      return [{ relation, primaryKey, column: field.name, bucket }]
    })
}

export const collectRepairTargets = (app: Readonly<App>): readonly RepairTarget[] =>
  (app.tables ?? []).flatMap((table) => collectTableTargets(app, table))

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

export const runAttachmentUrlBackfill = async (app: Readonly<App>): Promise<void> => {
  const targets = collectRepairTargets(app)
  if (targets.length === 0) return

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
