/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import { storesSubmission } from '@/domain/models/app/forms/submission-ledger-service'
import type { Form } from '@/domain/models/app/forms'
import type { SubmissionSurface } from '@/domain/models/app/forms/submission-ledger-service'

/**
 * Optionally write the audit ledger row in `system.form_submissions`, the row
 * the console's Submissions inbox reads.
 *
 * Whether it is written depends on WHERE the submission was made
 * (`storesSubmission`): the form's own route stores unless the form says
 * `storeSubmission: false`; a `formRef` embed on an app page stores only when
 * the form says `storeSubmission: true`. Returns the row id when written,
 * `undefined` otherwise — which leaves `$submission.id` empty. (A capped form
 * reserves its row before the table write, `reserveLedgerSlot`, and never
 * reaches here.)
 */
export const writeLedgerRow = (input: {
  readonly form: Readonly<Form>
  readonly surface: SubmissionSurface
  readonly mapped: Readonly<Record<string, unknown>>
  readonly linkedRecordId: string | undefined
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, linkedRecordId, submitterIpHash, userAgent, submitterUserId } = input
    if (!storesSubmission(form, input.surface)) return undefined
    const repo = yield* FormSubmissionRepository
    const ledger = yield* repo.createTopLevel({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(linkedRecordId !== undefined ? { linkedRecordId } : {}),
      ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    })
    return ledger.id
  }).pipe(Effect.withSpan('forms.write-ledger-row', { attributes: { form: input.form.name } }))

/**
 * Statuses that count toward `availability.maxSubmissions`. Spam-flagged
 * (`spam`) and failed (`failed`) submissions never consume a cap slot — only
 * "real" submissions in the `received → processing → done` lifecycle do.
 */
const CAP_COUNTED_STATUSES = ['received', 'processing', 'done'] as const

/**
 * Submission rejected because the form reached its `availability.maxSubmissions`
 * cap. Surfaces as 403 `{ error: 'submission limit reached', maxSubmissions,
 * currentCount }`.
 */
export class FormSubmissionLimitError extends Data.TaggedError('FormSubmissionLimitError')<{
  readonly maxSubmissions: number
  readonly currentCount: number
}> {}

/**
 * Atomically reserve a cap slot in the ledger. Returns the ledger row id on
 * success, or fails with {@link FormSubmissionLimitError} when the cap is
 * already reached. Used in place of {@link writeLedgerRow} when the form
 * declares `availability.maxSubmissions`.
 *
 * The bound-table write happens AFTER the slot is reserved so a successful
 * reservation owns exactly one ledger row; a failed reservation never writes
 * the bound table (so `received|processing|done` rows never exceed the cap).
 */
export const reserveLedgerSlot = (input: {
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly maxSubmissions: number
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, maxSubmissions, submitterIpHash, userAgent, submitterUserId } = input
    const repo = yield* FormSubmissionRepository
    const reserved = yield* repo.reserveTopLevelSlot({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      maxSubmissions,
      countStatuses: CAP_COUNTED_STATUSES,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    })
    if (reserved === undefined) {
      const currentCount = yield* repo.countByFormNameAndStatus({
        formName: form.name,
        statuses: CAP_COUNTED_STATUSES,
      })
      return yield* new FormSubmissionLimitError({ maxSubmissions, currentCount })
    }
    return reserved.id
  }).pipe(Effect.withSpan('forms.reserve-ledger-slot', { attributes: { form: input.form.name } }))
