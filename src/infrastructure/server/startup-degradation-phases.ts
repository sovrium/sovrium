/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseStorageEnvConfig } from '@/domain/models/env/storage'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { App } from '@/domain/models/app'
import type { StartupPhase } from '@/infrastructure/logging/logger'


export const collectStoragePhases = (): readonly StartupPhase[] => {
  if (parseStorageEnvConfig() !== undefined) return []
  return [
    {
      label: 'Storage: Not configured (attachment fields will be disabled)',
      type: 'warning' as const,
    },
  ]
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
