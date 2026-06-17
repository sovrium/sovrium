/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export interface AutomationApprovalRow {
  readonly id: string
  readonly runId: string | null
  readonly stepIndex: number
  readonly status: string
}

export class AutomationApprovalDatabaseError extends Data.TaggedError(
  'AutomationApprovalDatabaseError'
)<{
  readonly cause: unknown
}> {}

export class AutomationApprovalRepository extends Context.Tag('AutomationApprovalRepository')<
  AutomationApprovalRepository,
  {
    readonly findById: (
      id: string
    ) => Effect.Effect<AutomationApprovalRow | undefined, AutomationApprovalDatabaseError>

    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
    }) => Effect.Effect<string | undefined, AutomationApprovalDatabaseError>
  }
>() {}
