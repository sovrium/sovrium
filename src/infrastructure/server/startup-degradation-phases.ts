/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { resolveAdminRole } from '@/domain/models/app/auth/roles'
import { parseStorageEnvConfig, type StorageEnvConfig } from '@/domain/models/env/storage/storage'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { formatPathForDisplay } from '@/infrastructure/logging/format-path'
import { formatDuration } from '@/infrastructure/logging/logger'
import { collectInsecureEnvWarning, getNodeEnv } from '@/infrastructure/utils/env'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import type { StartupPhase } from '@/infrastructure/logging/logger'


export const collectStoragePhases = (): readonly StartupPhase[] => {
  const config = parseStorageEnvConfig()
  if (config === undefined) {
    return [
      {
        label: 'Storage: Not configured (attachment fields will be disabled)',
        type: 'warning' as const,
      },
    ]
  }
  return [{ label: storageStartupLabel(config), type: 'success' as const }]
}

export const databaseStartupLabel = (config: DatabaseDialectConfig): string =>
  config.dialect === 'sqlite'
    ? `Database: SQLite (${formatPathForDisplay(config.path)})`
    : 'Database: PostgreSQL'

const storageStartupLabel = (config: StorageEnvConfig): string => {
  switch (config.provider) {
    case 'local':
      return `Storage: Local (${formatPathForDisplay(config.directory)})`
    case 's3':
      return `Storage: S3 (${config.bucket})`
    case 'bytea':
      return 'Storage: PostgreSQL (bytea)'
  }
}

export const collectAiListenerPhases = (app: Readonly<App>): readonly StartupPhase[] => {
  if (!isSqliteRuntime()) return []
  const tables = app.tables ?? []
  const hasAiComputeField = tables.some((table) =>
    table.fields.some((field) => isAiComputeFieldType(field.type))
  )
  const hasRagAgents = (app.agents ?? []).length > 0
  if (!hasAiComputeField && !hasRagAgents) return []
  return [
    {
      label: 'AI knowledge listener disabled — requires PostgreSQL',
      type: 'warning' as const,
    },
  ]
}

export const collectPublicDirPhases = async (
  publicDir: string | undefined
): Promise<readonly StartupPhase[]> => {
  if (!publicDir) return []
  const exists = await stat(publicDir)
    .then((s) => s.isDirectory())
    .catch(() => false)
  if (!exists) return []
  return [
    {
      label: `Public directory: ${formatPathForDisplay(publicDir)}`,
      type: 'success' as const,
    },
  ]
}

export const collectAdminPhases = (app: Readonly<App>): Promise<readonly StartupPhase[]> => {
  if (!app.auth) return Promise.resolve([])
  const adminRole = resolveAdminRole(app)
  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    const admin = yield* repo.findFirstAdmin(adminRole)
    if (admin) {
      return [{ label: `Admin: ${admin.email}`, type: 'success' as const }] as const
    }
    const userCount = yield* repo.countHumanUsers()
    if (userCount === 0) return [] as const
    return [
      {
        label: "No admin user — provision one via 'sovrium admin create'",
        type: 'warning' as const,
      },
    ] as const
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    Effect.catchAll(() => Effect.succeed([] as readonly StartupPhase[]))
  )
  return Effect.runPromise(program)
}

export const buildStartupPhases = (params: {
  readonly infraPhases: readonly StartupPhase[]
  readonly cssLabel: string
  readonly durationMs: number
  readonly bindHost?: string
}): readonly StartupPhase[] => {
  const insecureEnvPhase = collectInsecureEnvWarning(params.bindHost)
  const mode = getNodeEnv() === 'production' ? 'production' : 'development'
  return [
    ...(insecureEnvPhase ? [insecureEnvPhase] : []),
    { label: `Mode: ${mode}`, type: 'success' as const },
    ...params.infraPhases,
    { label: params.cssLabel, type: 'success' as const },
    { label: `Server ready in ${formatDuration(params.durationMs)}`, type: 'success' as const },
  ]
}
