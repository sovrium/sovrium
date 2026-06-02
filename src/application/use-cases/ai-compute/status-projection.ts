/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  readAiComputeStatusesForRecords,
  type AiComputeFieldStatus,
} from '@/infrastructure/database/ai-compute-status-repository'
import type { App } from '@/domain/models/app'
import type { AiComputeKind } from '@/domain/services/ai-compute/baseline'

const AI_COMPUTE_KINDS: ReadonlySet<string> = new Set<AiComputeKind>([
  'ai-summary',
  'ai-categorize',
  'ai-tag',
  'ai-translate',
  'ai-extract',
  'ai-sentiment',
  'ai-generate',
])

export type AiComputeProjection = Record<
  string,
  { readonly status: string; readonly error?: string }
>

export const tableHasAiComputeFields = (app: App, tableName: string): boolean => {
  const table = app.tables?.find((t) => t.name === tableName)
  return (table?.fields ?? []).some((f) => AI_COMPUTE_KINDS.has(f.type))
}

const toProjectionEntry = (
  status: AiComputeFieldStatus
): { readonly status: string; readonly error?: string } => ({
  status: status.status,
  ...(status.error !== undefined ? { error: status.error } : {}),
})

export const buildAiComputeProjection = (
  app: App,
  tableName: string,
  recordId: string | number
): Effect.Effect<AiComputeProjection | undefined, never> =>
  Effect.gen(function* () {
    if (!tableHasAiComputeFields(app, tableName)) return undefined
    const statuses = yield* Effect.promise(() =>
      readAiComputeStatusesForRecords(app.name, tableName, [recordId])
    )
    const forRecord = statuses.get(String(recordId))
    if (!forRecord || Object.keys(forRecord).length === 0) return undefined
    return Object.fromEntries(
      Object.entries(forRecord).map(([field, status]) => [field, toProjectionEntry(status)])
    )
  })
