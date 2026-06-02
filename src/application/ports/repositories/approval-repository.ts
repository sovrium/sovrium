/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export interface ApprovalMirrorRecord {
  readonly id: string
  readonly status: string
  readonly agentName: string
  readonly actionPayload: Readonly<Record<string, unknown>>
  readonly actionExecuted: boolean
  readonly timeoutSeconds: number
  readonly escalated: boolean
  readonly executedAs: string | undefined
  readonly escalatedTo: string | undefined
  readonly expiresAtMs: number
}

export class ApprovalDatabaseError extends Data.TaggedError('ApprovalDatabaseError')<{
  readonly cause: unknown
}> {}

export class ApprovalRepository extends Context.Tag('ApprovalRepository')<
  ApprovalRepository,
  {
    readonly insertApprovalRow: (
      record: ApprovalMirrorRecord
    ) => Effect.Effect<void, ApprovalDatabaseError>

    readonly updateApprovalRow: (
      record: ApprovalMirrorRecord
    ) => Effect.Effect<void, ApprovalDatabaseError>

    readonly lookupUserEmail: (userId: string) => Effect.Effect<string, ApprovalDatabaseError>
  }
>() {}
