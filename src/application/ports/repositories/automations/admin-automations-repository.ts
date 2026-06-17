/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export class AdminAutomationsDatabaseError extends Data.TaggedError(
  'AdminAutomationsDatabaseError'
)<{
  readonly cause: unknown
}> {}

export interface AdminAutomationOverviewRow {
  readonly startedAt: Date | string | null
  readonly createdAt: Date | string
  readonly status: string | null
}

export interface AdminAutomationRunRow {
  readonly id: string
  readonly automationName: string
  readonly status: string | null
  readonly triggerData: unknown
  readonly startedAt: Date | string | null
  readonly completedAt: Date | string | null
  readonly durationMs: number | null
  readonly error: string | null
  readonly createdAt: Date | string
}

export interface AdminRunsListFilters {
  readonly status?: string | undefined
  readonly automationName?: string | undefined
  readonly automationId?: string | undefined
  readonly from?: Date | undefined
  readonly to?: Date | undefined
  readonly cursorBefore?: Date | undefined
  readonly limit: number
}

export class AdminAutomationsRepository extends Context.Tag('AdminAutomationsRepository')<
  AdminAutomationsRepository,
  {
    readonly listOverviewRowsSince: (
      since: Date
    ) => Effect.Effect<readonly AdminAutomationOverviewRow[], AdminAutomationsDatabaseError>

    readonly listOverviewStatusesSince: (
      since: Date
    ) => Effect.Effect<readonly { readonly status: string | null }[], AdminAutomationsDatabaseError>

    readonly listAdminRuns: (
      filters: AdminRunsListFilters
    ) => Effect.Effect<readonly AdminAutomationRunRow[], AdminAutomationsDatabaseError>

    readonly findAdminRunById: (
      runId: string
    ) => Effect.Effect<AdminAutomationRunRow | undefined, AdminAutomationsDatabaseError>
  }
>() {}
