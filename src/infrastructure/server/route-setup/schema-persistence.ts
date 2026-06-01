/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { desc, eq, inArray, max as sqlMax } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  sovriumAppDrafts as sovriumAppDraftsPg,
  sovriumAppVersions as sovriumAppVersionsPg,
} from '@/infrastructure/database/drizzle/schema/app-versioning'
import {
  sovriumAppDrafts as sovriumAppDraftsSqlite,
  sovriumAppVersions as sovriumAppVersionsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/app-versioning'
import type { AppVersionSource } from '@/domain/models/system/app-version'

const sovriumAppVersions = resolveDialectSchema(sovriumAppVersionsPg, sovriumAppVersionsSqlite)
const sovriumAppDrafts = resolveDialectSchema(sovriumAppDraftsPg, sovriumAppDraftsSqlite)


export type Snapshot = Record<string, unknown>

export interface DraftRow {
  readonly snapshot: Snapshot
  readonly baseVersion: number
  readonly updatedAt: string
  readonly updatedByUserId: string
}


export const escapeSqlLiteral = (value: string): string => value.replace(/'/g, "''")


const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

const projectVersionRow = (row: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  version_number: row['versionNumber'],
  snapshot: row['snapshot'],
  checksum: row['checksum'],
  created_at: toIsoString(row['createdAt']),
  created_by_user_id: row['createdByUserId'],
  source: row['source'],
  file_checksum: row['fileChecksum'],
  message: row['message'],
  restored_from_version: row['restoredFromVersion'],
})


export const readActiveVersionNumber = async (): Promise<number> => {
  try {
    const rows = await db
      .select({ versionNumber: sovriumAppVersions.versionNumber })
      .from(sovriumAppVersions)
      .orderBy(desc(sovriumAppVersions.versionNumber))
      .limit(1)
    return rows.length > 0 ? Number(rows[0]?.versionNumber ?? 0) : 0
  } catch {
    return 0
  }
}

export const readActiveVersionSnapshot = async (): Promise<Snapshot | undefined> => {
  try {
    const rows = await db
      .select({ snapshot: sovriumAppVersions.snapshot })
      .from(sovriumAppVersions)
      .orderBy(desc(sovriumAppVersions.versionNumber))
      .limit(1)
    const snapshot = rows[0]?.snapshot
    return typeof snapshot === 'object' && snapshot !== null ? (snapshot as Snapshot) : undefined
  } catch {
    return undefined
  }
}

export const readAllVersionRows = async (): Promise<ReadonlyArray<Record<string, unknown>>> => {
  try {
    const rows = await db
      .select()
      .from(sovriumAppVersions)
      .orderBy(desc(sovriumAppVersions.versionNumber))
    return rows.map((r) => projectVersionRow(r as Record<string, unknown>))
  } catch {
    return []
  }
}

export const readVersionRow = async (
  versionNumber: number
): Promise<Record<string, unknown> | undefined> => {
  try {
    const rows = await db
      .select()
      .from(sovriumAppVersions)
      .where(eq(sovriumAppVersions.versionNumber, Math.floor(versionNumber)))
      .limit(1)
    const row = rows[0]
    return row !== undefined ? projectVersionRow(row as Record<string, unknown>) : undefined
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
  const snapJson = JSON.stringify(input.snapshot)
  const checksum = `sha256:${await sha256Hex(snapJson)}`

  const [maxRow] = await db
    .select({ max: sqlMax(sovriumAppVersions.versionNumber) })
    .from(sovriumAppVersions)
  const rawMax = maxRow?.max
  const nextVersionNumber = Math.max(Number(rawMax ?? 0), 0) + 1

  const inserted = await db
    .insert(sovriumAppVersions)
    .values({
      versionNumber: nextVersionNumber,
      snapshot: input.snapshot as never,
      checksum,
      createdByUserId: input.userId,
      source: input.source,
      message: input.message,
      ...(input.fileChecksum !== undefined ? { fileChecksum: input.fileChecksum } : {}),
      ...(input.restoredFromVersion !== undefined
        ? { restoredFromVersion: input.restoredFromVersion }
        : {}),
    } as never)
    .returning({ versionNumber: sovriumAppVersions.versionNumber })
  const row = inserted[0]
  return row !== undefined ? Number(row.versionNumber ?? nextVersionNumber) : nextVersionNumber
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

export const deleteVersionsByNumbers = async (
  versionNumbers: ReadonlyArray<number>
): Promise<number> => {
  if (versionNumbers.length === 0) return 0
  const floored = versionNumbers.map((n) => Math.floor(n))
  await db.delete(sovriumAppVersions).where(inArray(sovriumAppVersions.versionNumber, floored))
  return floored.length
}


export const readLatestDraft = async (): Promise<DraftRow | undefined> => {
  try {
    const rows = await db
      .select()
      .from(sovriumAppDrafts)
      .orderBy(desc(sovriumAppDrafts.updatedAt))
      .limit(1)
    const row = rows[0]
    if (row === undefined) return undefined
    const { snapshot } = row as Record<string, unknown>
    return {
      snapshot: typeof snapshot === 'object' && snapshot !== null ? (snapshot as Snapshot) : {},
      baseVersion: Number((row as Record<string, unknown>)['baseVersion'] ?? 0),
      updatedAt: toIsoString((row as Record<string, unknown>)['updatedAt']),
      updatedByUserId: String((row as Record<string, unknown>)['updatedByUserId'] ?? ''),
    }
  } catch {
    return undefined
  }
}

export const writeDraft = async (input: {
  readonly snapshot: unknown
  readonly baseVersion: number
  readonly userId: string
}): Promise<void> => {
  await db.delete(sovriumAppDrafts)
  await db.insert(sovriumAppDrafts).values({
    id: 'singleton',
    snapshot: input.snapshot as never,
    baseVersion: Math.floor(input.baseVersion),
    updatedByUserId: input.userId,
  } as never)
}
