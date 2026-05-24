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
import { escapeSqlLiteral } from '@/infrastructure/server/route-setup/schema-persistence'
import type { AppVersionSource } from '@/domain/models/system/app-version'


const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}


const readLatestVersionChecksum = async (): Promise<string | undefined> => {
  try {
    const result = await db.execute(
      sql.raw(
        `SELECT checksum FROM ${qualifiedSystemTable('sovrium_app_versions')} ORDER BY version_number DESC LIMIT 1`
      )
    )
    const row = extractRows(result)[0]
    if (row === undefined) return undefined
    const raw = row['checksum']
    return typeof raw === 'string' ? raw : undefined
  } catch {
    return undefined
  }
}


const DEFAULT_MESSAGE: Readonly<Record<'config-file' | 'env', string>> = {
  'config-file': 'Initial config from app.yaml',
  env: 'Initial config from APP_SCHEMA',
}

const insertBootVersion = async (input: {
  readonly snapshot: unknown
  readonly snapJson: string
  readonly checksum: string
  readonly source: Extract<AppVersionSource, 'config-file' | 'env'>
}): Promise<void> => {
  const snapJsonEscaped = escapeSqlLiteral(input.snapJson)
  const message = escapeSqlLiteral(DEFAULT_MESSAGE[input.source])
  const source = escapeSqlLiteral(input.source)
  const fileChecksum = escapeSqlLiteral(input.checksum)
  const versionsTable = qualifiedSystemTable('sovrium_app_versions')
  return db
    .execute(
      sql.raw(
        `INSERT INTO ${versionsTable} (version_number, snapshot, checksum, created_at, created_by_user_id, message, source, file_checksum) SELECT COALESCE(MAX(version_number), 0) + 1, '${snapJsonEscaped}', '${input.checksum}', ${nowEpochMsSqlLiteral()}, 'system', '${message}', '${source}', '${fileChecksum}' FROM ${versionsTable}`
      )
    )
    .then(() => undefined)
}

const resolveBootSource = (
  env: Readonly<NodeJS.ProcessEnv>
): Extract<AppVersionSource, 'config-file' | 'env'> =>
  env['APP_SCHEMA'] !== undefined && env['APP_SCHEMA'] !== '' ? 'env' : 'config-file'

const isBootSeederEnabled = (env: Readonly<NodeJS.ProcessEnv>): boolean =>
  env['SOVRIUM_BOOT_SEED_VERSION'] === 'true'

export const seedConfigFileVersionIfChanged = async (
  validatedApp: Readonly<{ readonly name: string; readonly [key: string]: unknown }>
): Promise<void> => {
  if (!isBootSeederEnabled(process.env)) return
  const snapJson = JSON.stringify(validatedApp)
  const escapedForChecksum = escapeSqlLiteral(snapJson)
  return sha256Hex(escapedForChecksum)
    .then((hex) => `sha256:${hex}`)
    .then(async (checksum) => {
      const latest = await readLatestVersionChecksum()
      if (latest === checksum) return
      return insertBootVersion({
        snapshot: validatedApp,
        snapJson,
        checksum,
        source: resolveBootSource(process.env),
      })
    })
    .catch(() => undefined)
}
