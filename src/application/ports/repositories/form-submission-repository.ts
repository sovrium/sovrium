/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for form-submission operations.
 */
export class FormSubmissionDatabaseError extends Data.TaggedError('FormSubmissionDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Top-level form submission row shape returned by `createTopLevel`.
 */
export interface TopLevelFormSubmissionRow {
  readonly id: string
  readonly formName: string
  readonly formId: number
  readonly status: string
  readonly data: Record<string, unknown>
  readonly linkedRecordTable: string | null
  readonly linkedRecordId: string | null
}

/**
 * Form Submission Repository Port.
 *
 * Backs `system.form_submissions` — supports two coexisting submission
 * shapes:
 *
 *   1. **Share-link forms** (`create`): public forms exposed via a share
 *      token. Keyed by (pageName, shareToken, tableName, submittedData).
 *
 *   2. **Top-level forms** (`createTopLevel`): first-class forms defined
 *      under `app.forms[]`. Keyed by (formName, formId, status, data,
 *      linkedRecordTable, linkedRecordId).
 *
 * `countRecentByIp` is the rate-limit primitive: returns the number of
 * non-deleted submissions from `ipAddress` within the last
 * `windowSeconds`. Spec contract: 10 per IP per minute.
 */
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
    /**
     * Update the lifecycle status (and optional reason) on a previously
     * inserted top-level form submission. Used by the form-trigger pipeline
     * to advance `received → processing → done | failed` after the bound
     * automation completes (or returns a non-success outcome).
     *
     * Returns void; submitters never see the status change directly. When
     * `id` does not match an existing row the call is a no-op.
     */
    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
      readonly statusReason?: string | null
    }) => Effect.Effect<void, FormSubmissionDatabaseError>
  }
>() {}
