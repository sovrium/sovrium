/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export class AdminFormsDatabaseError extends Data.TaggedError('AdminFormsDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AdminFormAggregateRow {
  readonly submissionCount: number | string
  readonly lastSubmissionAt: Date | string | null
}

export interface AdminFormSubmissionRow {
  readonly id: string
  readonly formName: string | null
  readonly submittedAt: Date | string
  readonly status: string | null
  readonly deletedAt: Date | string | null
}

export interface AdminFormSubmissionDetailRow extends AdminFormSubmissionRow {
  readonly data: unknown
}

export interface AdminSubmissionsListFilters {
  readonly formName: string
  readonly includeDeleted: boolean
  readonly status?: string | undefined
  readonly from?: Date | undefined
  readonly to?: Date | undefined
  readonly cursorBefore?: Date | undefined
  readonly limit: number
}

export class AdminFormsRepository extends Context.Tag('AdminFormsRepository')<
  AdminFormsRepository,
  {
    readonly aggregateForForm: (
      formName: string
    ) => Effect.Effect<AdminFormAggregateRow, AdminFormsDatabaseError>

    readonly listSubmissions: (
      filters: AdminSubmissionsListFilters
    ) => Effect.Effect<readonly AdminFormSubmissionRow[], AdminFormsDatabaseError>

    readonly findSubmissionDetail: (
      formName: string,
      submissionId: string
    ) => Effect.Effect<AdminFormSubmissionDetailRow | undefined, AdminFormsDatabaseError>

    readonly findSubmissionsByIds: (
      formName: string,
      ids: readonly string[]
    ) => Effect.Effect<readonly AdminFormSubmissionRow[], AdminFormsDatabaseError>
  }
>() {}
