/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  nowEpochMsSqlLiteral,
  qualifiedSystemTable,
} from '@/infrastructure/database/sql/dialect-ddl'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import type { AppVersionSource } from '@/domain/models/system/app-version'


export type Snapshot = Record<string, unknown>

export interface DraftRow {
  readonly snapshot: Snapshot
  readonly baseVersion: number
  readonly updatedAt: string
  readonly updatedByUserId: string
}


export const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''")


export const readActiveVersionNumber = async (): Promise<number> => {
  try {
    const result = await db.execute(
      sql.raw(
        `SELECT version_number FROM ${qualifiedSystemTable('sovrium_app_versions')} ORDER BY version_number DESC LIMIT 1`
      )
    )
    const rows = extractRows(result)
    return rows.length > 0 ? Number(rows[0]?.['version_number'] ?? 0) : 0
  } catch {
    return 0
  }
}

export const readActiveVersionSnapshot = async (): Promise<Snapshot | undefined> => {
  try {
    const result = await db.execute(
      sql.raw(
        `SELECT snapshot FROM ${qualifiedSystemTable('sovrium_app_versions')} ORDER BY version_number DESC LIMIT 1`
      )
    )
    const row = extractRows(result)[0]
    if (row === undefined) return undefined
    const { snapshot } = row
    return typeof snapshot === 'object' && snapshot !== null ? (snapshot as Snapshot) : undefined
  } catch {
    return undefined
  }
}

export const readAllVersionRows = async (): Promise<ReadonlyArray<Record<string, unknown>>> => {
  try {
    const result = await db.execute(
      sql.raw(
        `SELECT * FROM ${qualifiedSystemTable('sovrium_app_versions')} ORDER BY version_number DESC`
      )
    )
    return extractRows(result)
  } catch {
    return []
  }
}

export const readVersionRow = async (
  versionNumber: number
): Promise<Record<string, unknown> | undefined> => {
  try {
    const result = await db.execute(
      sql.raw(
        `SELECT * FROM ${qualifiedSystemTable('sovrium_app_versions')} WHERE version_number = ${Math.floor(versionNumber)} LIMIT 1`
      )
    )
    return extractRows(result)[0]
  } catch {
    return undefined
  }
}


const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const insertVersionRow = async (input: {
  readonly snapshot: unknown
  readonly message: string
  readonly userId: string
  readonly source: AppVersionSource
  readonly fileChecksum?: string
  readonly restoredFromVersion?: number
}): Promise<number> => {
  const snapJson = escapeSqlLiteral(JSON.stringify(input.snapshot))
  const message = escapeSqlLiteral(input.message)
  const userId = escapeSqlLiteral(input.userId)
  const source = escapeSqlLiteral(input.source)
  const checksum = `sha256:${await sha256Hex(snapJson)}`

  const restored = input.restoredFromVersion
  const restoredColumn = restored !== undefined ? ', restored_from_version' : ''
  const restoredValue = restored !== undefined ? `, ${Math.floor(restored)}` : ''

  const { fileChecksum } = input
  const fileChecksumColumn = fileChecksum !== undefined ? ', file_checksum' : ''
  const fileChecksumValue =
    fileChecksum !== undefined ? `, '${escapeSqlLiteral(fileChecksum)}'` : ''

  const versionsTable = qualifiedSystemTable('sovrium_app_versions')
  const result = await db.execute(
    sql.raw(
      `INSERT INTO ${versionsTable} (version_number, snapshot, checksum, created_at, created_by_user_id, message, source${fileChecksumColumn}${restoredColumn}) SELECT COALESCE(MAX(version_number), 0) + 1, '${snapJson}', '${checksum}', ${nowEpochMsSqlLiteral()}, '${userId}', '${message}', '${source}'${fileChecksumValue}${restoredValue} FROM ${versionsTable} RETURNING version_number`
    )
  )
  const row = extractRows(result)[0]
  return row !== undefined ? Number(row['version_number'] ?? 0) : 0
}

export const insertVersion = (input: {
  readonly snapshot: unknown
  readonly message: string
  readonly userId: string
  readonly source: AppVersionSource
  readonly fileChecksum?: string
}): Promise<number> => insertVersionRow(input)

export const insertRestoredVersion = (input: {
  readonly snapshot: unknown
  readonly message: string
  readonly userId: string
  readonly restoredFromVersion: number
}): Promise<number> => insertVersionRow({ ...input, source: 'restore' })


export const readLatestDraft = async (): Promise<DraftRow | undefined> => {
  try {
    const result = await db.execute(
      sql.raw(
        `SELECT snapshot, base_version, updated_at, updated_by_user_id FROM ${qualifiedSystemTable('sovrium_app_drafts')} ORDER BY updated_at DESC LIMIT 1`
      )
    )
    const row = extractRows(result)[0]
    if (row === undefined) return undefined
    const { snapshot, updated_at: updatedAt } = row
    return {
      snapshot: typeof snapshot === 'object' && snapshot !== null ? (snapshot as Snapshot) : {},
      baseVersion: Number(row['base_version'] ?? 0),
      updatedAt: updatedAt !== undefined ? String(updatedAt) : new Date().toISOString(),
      updatedByUserId: String(row['updated_by_user_id'] ?? ''),
    }
  } catch {
    return undefined
  }
}

export const writeDraft = (input: {
  readonly snapshot: unknown
  readonly baseVersion: number
  readonly userId: string
}): Promise<void> => {
  const snapJson = escapeSqlLiteral(JSON.stringify(input.snapshot))
  const userId = escapeSqlLiteral(input.userId)
  const draftsTable = qualifiedSystemTable('sovrium_app_drafts')
  return db
    .execute(sql.raw(`DELETE FROM ${draftsTable}`))
    .then(() =>
      db.execute(
        sql.raw(
          `INSERT INTO ${draftsTable} (id, snapshot, base_version, updated_at, updated_by_user_id) VALUES ('singleton', '${snapJson}', ${Math.floor(input.baseVersion)}, ${nowEpochMsSqlLiteral()}, '${userId}')`
        )
      )
    )
    .then(() => undefined)
}
