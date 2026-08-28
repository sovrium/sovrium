/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Record-API `_aiCompute` projection ([internal ref] Phase 2, design §3 Option C).
 *
 * The read surface for the observable refinement signal: a top-level
 * `_aiCompute: { <field>: { status, error? } }` block on a record response,
 * backed by a read of `system.ai_compute_status`. Specs poll this for an
 * EXPLICIT terminal state (never racing on the stored value).
 *
 * GATED: a table with zero AI-compute fields produces `undefined` (the block is
 * omitted entirely) and never touches the status table — non-AI tables pay
 * nothing.
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

/** The `_aiCompute` projection value: a status entry per AI-compute field. */
export type AiComputeProjection = Record<
  string,
  { readonly status: string; readonly error?: string }
>

/** Whether a table declares ANY AI-compute field (the projection gate). */
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

const toProjection = (
  forRecord: Readonly<Record<string, AiComputeFieldStatus>> | undefined
): Readonly<AiComputeProjection> | undefined => {
  if (!forRecord || Object.keys(forRecord).length === 0) return undefined
  return Object.fromEntries(
    Object.entries(forRecord).map(([field, status]) => [field, toProjectionEntry(status)])
  )
}

/**
 * Build the `_aiCompute` projection for a BATCH of records in ONE status read.
 * Returns a `String(recordId) → projection` map holding an entry only for the
 * records that actually have status rows; a record absent from the map carries
 * no block at all (the same "omit rather than send an empty object" contract
 * the single-record path has always had).
 *
 * GATED FIRST: a table with no AI-compute field returns an empty map without
 * touching `system.ai_compute_status`, so a non-AI list page costs nothing.
 * The read itself is a single `WHERE record_id IN (…)` — the repository has
 * always accepted a batch, it was simply only ever called with one id.
 *
 * The returned Effect never fails (best-effort read).
 */
export const buildAiComputeProjections = (
  app: App,
  tableName: string,
  recordIds: readonly (string | number)[]
): Effect.Effect<ReadonlyMap<string, AiComputeProjection>, never> =>
  Effect.gen(function* () {
    if (recordIds.length === 0) return new Map()
    if (!tableHasAiComputeFields(app, tableName)) return new Map()
    const statuses = yield* Effect.promise(() =>
      readAiComputeStatusesForRecords(app.name, tableName, recordIds)
    )
    return new Map(
      [...statuses.entries()].flatMap(([recordId, forRecord]) => {
        const projection = toProjection(forRecord)
        return projection ? [[recordId, projection] as const] : []
      })
    )
  })

/**
 * Build the `_aiCompute` projection for ONE record. Returns `undefined` when
 * the table has no AI-compute fields (gated — skips the status read), or when
 * no status rows exist yet (the worker has not enqueued — caller omits the
 * block). The returned Effect never fails (best-effort read).
 *
 * A thin specialization of {@link buildAiComputeProjections} so the single- and
 * list-record paths cannot drift apart on the gate or on the omit contract.
 */
export const buildAiComputeProjection = (
  app: App,
  tableName: string,
  recordId: string | number
): Effect.Effect<AiComputeProjection | undefined, never> =>
  Effect.map(buildAiComputeProjections(app, tableName, [recordId]), (byRecord) =>
    byRecord.get(String(recordId))
  )
