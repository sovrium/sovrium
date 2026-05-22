/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseStorageEnvConfig, type StorageEnvConfig } from '@/domain/models/env/storage'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { formatPathForDisplay } from '@/infrastructure/logging/format-path'
import { formatDuration } from '@/infrastructure/logging/logger'
import { collectInsecureEnvWarning, getNodeEnv } from '@/infrastructure/utils/env'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/env/database-dialect'
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

export const buildStartupPhases = (params: {
  readonly infraPhases: readonly StartupPhase[]
  readonly cssLabel: string
  readonly durationMs: number
}): readonly StartupPhase[] => {
  const insecureEnvPhase = collectInsecureEnvWarning()
  const mode = getNodeEnv() === 'production' ? 'production' : 'development'
  return [
    ...(insecureEnvPhase ? [insecureEnvPhase] : []),
    { label: `Mode: ${mode}`, type: 'success' as const },
    ...params.infraPhases,
    { label: params.cssLabel, type: 'success' as const },
    { label: `Server ready in ${formatDuration(params.durationMs)}`, type: 'success' as const },
  ]
}
