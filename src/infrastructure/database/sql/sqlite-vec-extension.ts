/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { existsSync } from 'node:fs'
import { Database as BunSqlite } from 'bun:sqlite'
import { getLoadablePath } from 'sqlite-vec'
import { resolveRagAcceleration } from '@/domain/services/rag/rag-acceleration'
import { logInfo, logWarning } from '@/infrastructure/logging/logger'
import { isCompiled } from '@/infrastructure/utils/package-paths'

let accelerationClient: BunSqlite | undefined

let resolved = false

const CUSTOM_SQLITE_CANDIDATES = [
  '/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib',
  '/usr/local/opt/sqlite/lib/libsqlite3.dylib',
] as const

const openAndLoad = (dbPath: string, extensionPath: string): BunSqlite | undefined => {
  const client = new BunSqlite(dbPath, { create: true })
  try {
    client.loadExtension(extensionPath)
    client.exec('PRAGMA busy_timeout = 5000')
    return client
  } catch {
    try {
      client.close()
    } catch {
    }
    return undefined
  }
}

const loadWithCustomSqlite = (dbPath: string, extensionPath: string): BunSqlite | undefined => {
  const candidate = CUSTOM_SQLITE_CANDIDATES.find((c) => existsSync(c))
  if (candidate === undefined) return undefined
  try {
    BunSqlite.setCustomSQLite(candidate)
  } catch {
    return undefined
  }
  return openAndLoad(dbPath, extensionPath)
}

const resolveLoadablePath = (): string | undefined => {
  try {
    return getLoadablePath()
  } catch {
    return undefined
  }
}

const resolveAvailableExtensionPath = (dbPath: string): string | undefined => {
  if (!resolveRagAcceleration(process.env).sqliteVec) return undefined

  const forcedUnavailable = process.env['RAG_SQLITE_VEC_FORCE_UNAVAILABLE'] === '1'
  if (isCompiled || forcedUnavailable) {
    logInfo(
      'RAG_SQLITE_VEC=on requested but native SQLite extension loading is unavailable ' +
        `${isCompiled ? '(compiled binary, Bun #30717)' : '(RAG_SQLITE_VEC_FORCE_UNAVAILABLE=1)'} — ` +
        'falling back to app-side cosine (Phase 1).'
    )
    return undefined
  }

  if (dbPath === ':memory:') {
    logWarning(
      'RAG_SQLITE_VEC=on requested on an in-memory SQLite database — acceleration needs a ' +
        'file-backed database; falling back to app-side cosine (Phase 1).'
    )
    return undefined
  }

  const extensionPath = resolveLoadablePath()
  if (extensionPath === undefined) {
    logWarning(
      'RAG_SQLITE_VEC=on requested but the sqlite-vec extension binary could not be resolved ' +
        '(unsupported platform or not installed) — falling back to app-side cosine (Phase 1).'
    )
  }
  return extensionPath
}

export const primeSqliteVec = (dbPath: string): void => {
  if (resolved) return
  resolved = true

  const extensionPath = resolveAvailableExtensionPath(dbPath)
  if (extensionPath === undefined) return

  const client = openAndLoad(dbPath, extensionPath) ?? loadWithCustomSqlite(dbPath, extensionPath)
  if (client === undefined) {
    logWarning(
      'RAG_SQLITE_VEC=on requested but the sqlite-vec extension could not be loaded — ' +
        'falling back to app-side cosine (Phase 1).'
    )
    return
  }

  accelerationClient = client
  logInfo('RAG_SQLITE_VEC=on — sqlite-vec acceleration enabled (ANN index over RAG embeddings).')
}

export const getSqliteVecClient = (): BunSqlite | undefined => accelerationClient

export const resetSqliteVecCache = (): void => {
  if (accelerationClient !== undefined) {
    try {
      accelerationClient.close()
    } catch {
    }
  }
  resolved = false
  accelerationClient = undefined
}
