/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/form-submission-repository'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements, RunAutomationResult } from './run-automation'
import type { App } from '@/domain/models/app'

/**
 * Inputs to the form-submission trigger.
 *
 * `formName` is the kebab-case `app.forms[].name` of the form that just
 * accepted a submission. `submissionData` is the validated/mapped payload
 * (post `submitTo.mapping`) — this is what surfaces to actions via
 * `{{trigger.data.<fieldName>}}`. `submissionId` is the
 * `system.form_submissions.id` (UUID) when the ledger row was written,
 * or `null` when the form opted out via `submitTo.storeSubmission: false`;
 * `linkedRecord`, when present, is the row that `submitTo.table` produced.
 */
export interface TriggerFormSubmissionInput {
  readonly app: App
  readonly formName: string
  readonly submissionData: Readonly<Record<string, unknown>>
  readonly submissionId: string | null
  readonly formId: number | null
  readonly linkedRecord?: { readonly table: string; readonly id: string } | null
  /**
   * Process env captured at the route boundary — threaded through to
   * `executeAutomationRun` so action handlers can resolve `$env.VAR_NAME`
   * references and so secrets get redacted from run-history. Mirrors the
   * pattern used by the record-event trigger.
   */
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** The user who submitted the form (null for public/guest submissions). */
  readonly userId?: string
}

/**
 * Filter `app.automations` down to form-triggered automations whose
 * `trigger.form` matches the submitted form name. Disabled automations
 * are excluded so an admin can pause a misbehaving workflow.
 */
const findMatchingFormAutomations = (
  app: App,
  formName: string
): readonly NonNullable<App['automations']>[number][] =>
  (app.automations ?? []).filter((automation) => {
    if (automation.enabled === false) return false
    const { trigger } = automation
    if (trigger.type !== 'form') return false
    return trigger.form === formName
  })

/**
 * Build the trigger-data envelope passed to actions. Submission field
 * values are flattened into `trigger.data.<fieldName>` (via the `body` key
 * that `buildAutomationContext` spreads), and the auxiliary metadata
 * (`form` name, `submissionId`, `formId`, `linkedRecord`) appears alongside
 * them under `trigger.data` — so spec assertions like
 * `{{trigger.data.form}}` and `{{trigger.data.linkedRecord.id}}` resolve
 * correctly.
 *
 * `body` carries the submission data (flattened through the same code path
 * webhook triggers use); the envelope additions are pass-through keys on
 * `TriggerData` that `buildAutomationContext` exposes alongside the body
 * fields.
 */
const buildFormTriggerData = (input: TriggerFormSubmissionInput): TriggerData => {
  const { formName, submissionData, submissionId, formId, linkedRecord } = input
  // Envelope additions surface at `{{trigger.data.<key>}}` because
  // `buildAutomationContext` flattens every TriggerData key alongside the
  // body. Using a structural cast (TriggerData has no first-class fields
  // for these names) keeps the new keys backwards-compatible — the
  // dynamic builder threads them through unchanged.
  // eslint-disable-next-line unicorn/no-null -- public template contract: linkedRecord is null when absent
  const linkedRecordValue = linkedRecord ?? null
  const envelope = {
    body: submissionData,
    form: formName,
    submissionId,
    formId,
    linkedRecord: linkedRecordValue,
  }
  return envelope as unknown as TriggerData
}

/**
 * Combine multiple per-automation results into a single ledger lifecycle
 * outcome. The ledger has a single status column (`received | processing
 * | done | failed | spam`), so when multiple automations are bound to one
 * form-submit event we collapse to the worst observed outcome:
 *
 *   - any `failed` -> `failed` (with the first non-empty error as reason)
 *   - all `success` -> `done`
 *   - empty list -> `done` (no automation, but the post-write hook still
 *     marks the lifecycle terminal)
 */
const collapseToLedgerOutcome = (
  results: ReadonlyArray<RunAutomationResult | undefined>
): { readonly status: 'done' | 'failed'; readonly reason?: string } => {
  const firstFailure = results.find((r) => r !== undefined && r.status === 'failure')
  if (firstFailure !== undefined) {
    const reason = firstFailure.error ?? 'automation reported failure status'
    return { status: 'failed', reason }
  }
  return { status: 'done' }
}

/**
 * Update the submission ledger lifecycle status. Skipped silently when no
 * `submissionId` is present (the form opted out via
 * `submitTo.storeSubmission: false`). Failures are absorbed — the
 * automation already ran, so a ledger-update glitch must not turn a 201
 * into a 5xx.
 */
const advanceLedgerStatus = (
  submissionId: string | null,
  status: 'processing' | 'done' | 'failed',
  reason?: string
): Effect.Effect<void, never, FormSubmissionRepository> => {
  if (submissionId === null) return Effect.void
  return Effect.gen(function* () {
    const repo = yield* FormSubmissionRepository
    yield* repo
      .updateStatus({
        id: submissionId,
        status,
        // eslint-disable-next-line unicorn/no-null -- writing null clears the column
        statusReason: reason ?? null,
      })
      .pipe(
        Effect.catchAllCause((cause) =>
          Effect.sync(() => {
            console.error('[automation:form-submission] ledger updateStatus failure', cause)
          })
        )
      )
  })
}

/**
 * Fire all form-triggered automations matching the submitted form, then
 * advance the submission ledger lifecycle.
 *
 * Lifecycle:
 *   1. Ledger row is inserted with `received` upstream (in `submitFormProgram`)
 *   2. If at least one matching automation: ledger -> `processing` BEFORE
 *      dispatch.
 *   3. After all automations complete: ledger -> `done` (all success) or
 *      `failed` (any terminal failure, with `status_reason` populated from
 *      the engine's error string).
 *   4. If no matching automation: ledger -> `done` directly (the
 *      submission has no remaining work).
 *
 * Errors are absorbed at the boundary: a form-submission endpoint returns
 * 201 regardless of automation outcome (the run row records the failure,
 * and the submission ledger row reflects the terminal status).
 */
export const triggerFormSubmissionAutomations = (
  input: TriggerFormSubmissionInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements | FormSubmissionRepository> =>
  Effect.gen(function* () {
    const { app, formName, processEnv, userId, submissionId } = input
    const matching = findMatchingFormAutomations(app, formName)

    if (matching.length === 0) {
      // No automation: lifecycle is `received` -> `done` directly.
      yield* advanceLedgerStatus(submissionId, 'done')
      return
    }

    // Transition: `received` -> `processing` BEFORE dispatch so an
    // observer querying mid-run sees the in-flight state.
    yield* advanceLedgerStatus(submissionId, 'processing')

    const triggerData = buildFormTriggerData(input)

    const results = yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchAutomationOnce({
          automation,
          app,
          processEnv,
          triggerData,
          userId,
        }),
      { concurrency: 1 }
    )

    const outcome = collapseToLedgerOutcome(results)
    yield* advanceLedgerStatus(submissionId, outcome.status, outcome.reason)
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[automation:form-submission] dispatch failure', cause)
      })
    )
  )
