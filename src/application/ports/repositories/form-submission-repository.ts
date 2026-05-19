/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class FormSubmissionDatabaseError extends Data.TaggedError('FormSubmissionDatabaseError')<{
  readonly cause: unknown
}> {}

export interface TopLevelFormSubmissionRow {
  readonly id: string
  readonly formName: string
  readonly formId: number
  readonly status: string
  readonly data: Record<string, unknown>
  readonly linkedRecordTable: string | null
  readonly linkedRecordId: string | null
}

export class FormSubmissionRepository extends Context.Tag('FormSubmissionRepository')<
  FormSubmissionRepository,
  {
    readonly create: (input: {
      readonly pageName: string
      readonly shareToken: string
      readonly tableName: string
      readonly submittedData: Record<string, unknown>
      readonly guestEmail?: string
      readonly ipAddress?: string
    }) => Effect.Effect<Record<string, unknown>, FormSubmissionDatabaseError>
    readonly countRecentByIp: (input: {
      readonly ipAddress: string
      readonly windowSeconds: number
    }) => Effect.Effect<number, FormSubmissionDatabaseError>
    readonly createTopLevel: (input: {
      readonly formName: string
      readonly formId: number
      readonly status: string
      readonly data: Record<string, unknown>
      readonly linkedRecordTable?: string
      readonly linkedRecordId?: string
      readonly ipAddress?: string
      readonly userAgent?: string
    }) => Effect.Effect<TopLevelFormSubmissionRow, FormSubmissionDatabaseError>
    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
      readonly statusReason?: string | null
    }) => Effect.Effect<void, FormSubmissionDatabaseError>
  }
>() {}
