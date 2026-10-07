/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The AI-compute refinement store: one status row per (app, table, record,
 * field), plus the read and origin-marked write-back of the refined column.
 *
 * The status row is what makes refinement best-effort with respect to the
 * PROVIDER — a provider that is down or answers prose is recorded there and the
 * deterministic baseline stands. It is not best-effort with respect to this
 * store: a failure here is exactly what the row cannot record, so every method
 * declares {@link AiComputeStoreError} and names the step that failed.
 */

import { Context, Data, type Effect } from 'effect'

export type AiComputeStatusValue = 'pending' | 'refined' | 'failed' | 'skipped'

export interface AiComputeStatusKey {
  readonly appId: string
  readonly tableName: string
  readonly recordId: string
  readonly fieldName: string
}

export interface AiComputeFieldStatus {
  readonly status: AiComputeStatusValue
  readonly attempt: number
  readonly error?: string
}

/**
 * A database operation backing a refinement failed.
 *
 * `step` names which operation failed, because they mean different things to an
 * operator: a failed status write is a stuck refinement, while a failed
 * write-back is a refinement that was computed and then lost.
 */
export class AiComputeStoreError extends Data.TaggedError('AiComputeStoreError')<{
  readonly step: 'read-status' | 'write-status' | 'read-value' | 'write-value'
  readonly cause: unknown
}> {}

export class AiComputeStatusRepository extends Context.Service<
  AiComputeStatusRepository,
  {
    readonly readStatus: (
      key: Readonly<AiComputeStatusKey>
    ) => Effect.Effect<AiComputeFieldStatus | undefined, AiComputeStoreError>
    /** Every field status of the given records, keyed by record id then field name. */
    readonly readStatusesForRecords: (
      appId: string,
      tableName: string,
      recordIds: readonly (string | number)[]
    ) => Effect.Effect<
      ReadonlyMap<string, Readonly<Record<string, AiComputeFieldStatus>>>,
      AiComputeStoreError
    >
    readonly upsertStatus: (
      key: Readonly<AiComputeStatusKey>,
      status: AiComputeStatusValue,
      options?: { readonly attempt?: number; readonly error?: string }
    ) => Effect.Effect<void, AiComputeStoreError>
    /** The column's current raw stored value — the override re-check reads it. */
    readonly readFieldValue: (
      tableName: string,
      recordId: string,
      fieldName: string
    ) => Effect.Effect<unknown, AiComputeStoreError>
    /** Write the refined value back, origin-marked; no automation or webhook fires. */
    readonly writeBack: (params: {
      readonly appId: string
      readonly tableName: string
      readonly recordId: string
      readonly fieldName: string
      readonly value: unknown
    }) => Effect.Effect<void, AiComputeStoreError>
  }
>()('AiComputeStatusRepository') {}
