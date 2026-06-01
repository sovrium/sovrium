/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { desc, max as sqlMax } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { sovriumAppVersions as sovriumAppVersionsPg } from '@/infrastructure/database/drizzle/schema/app-versioning'
import { sovriumAppVersions as sovriumAppVersionsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/app-versioning'
import type { AppVersionSource } from '@/domain/models/system/app-version'

const sovriumAppVersions = resolveDialectSchema(sovriumAppVersionsPg, sovriumAppVersionsSqlite)


const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}


const readLatestVersionChecksum = async (): Promise<string | undefined> => {
  try {
    const rows = await db
      .select({ checksum: sovriumAppVersions.checksum })
      .from(sovriumAppVersions)
      .orderBy(desc(sovriumAppVersions.versionNumber))
      .limit(1)
    const checksum = rows[0]?.checksum
    return typeof checksum === 'string' ? checksum : undefined
  } catch {
    return undefined
  }
}


const DEFAULT_MESSAGE: Readonly<Record<'config-file' | 'env', string>> = {
  'config-file': 'Initial config from app.yaml',
  env: 'Initial config from APP_SCHEMA',
}

const readMaxVersionNumber = async (): Promise<number> => {
  const [row] = await db
    .select({ max: sqlMax(sovriumAppVersions.versionNumber) })
    .from(sovriumAppVersions)
  return Math.max(Number(row?.max ?? 0), 0)
}

const insertBootVersion = async (input: {
  readonly snapshot: unknown
  readonly checksum: string
  readonly source: Extract<AppVersionSource, 'config-file' | 'env'>
}): Promise<void> => {
  const nextVersionNumber = (await readMaxVersionNumber()) + 1
  await db.insert(sovriumAppVersions).values({
    versionNumber: nextVersionNumber,
    snapshot: input.snapshot as never,
    checksum: input.checksum,
    createdByUserId: 'system',
    source: input.source,
    fileChecksum: input.checksum,
    message: DEFAULT_MESSAGE[input.source],
  } as never)
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
  return sha256Hex(snapJson)
    .then((hex) => `sha256:${hex}`)
    .then(async (checksum) => {
      const latest = await readLatestVersionChecksum()
      if (latest === checksum) return
      return insertBootVersion({
        snapshot: validatedApp,
        checksum,
        source: resolveBootSource(process.env),
      })
    })
    .catch(() => undefined)
}


const RELOAD_DEFAULT_MESSAGE = 'Reloaded from app.yaml'

const insertReloadVersion = async (input: {
  readonly snapshot: unknown
  readonly checksum: string
  readonly message: string
}): Promise<void> => {
  const nextVersionNumber = (await readMaxVersionNumber()) + 1
  await db.insert(sovriumAppVersions).values({
    versionNumber: nextVersionNumber,
    snapshot: input.snapshot as never,
    checksum: input.checksum,
    createdByUserId: 'system',
    source: 'config-file',
    fileChecksum: input.checksum,
    message: input.message,
  } as never)
}

export const appendReloadVersionIfChanged = async (
  validatedApp: Readonly<{ readonly name: string; readonly [key: string]: unknown }>,
  message?: string
): Promise<void> => {
  const snapJson = JSON.stringify(validatedApp)
  return sha256Hex(snapJson)
    .then((hex) => `sha256:${hex}`)
    .then(async (checksum) => {
      const latest = await readLatestVersionChecksum()
      if (latest === checksum) return
      return insertReloadVersion({
        snapshot: validatedApp,
        checksum,
        message: message && message.length > 0 ? message : RELOAD_DEFAULT_MESSAGE,
      })
    })
    .catch(() => undefined)
}
