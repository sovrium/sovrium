/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements, RunAutomationResult } from './run-automation'
import type { App } from '@/domain/models/app'

export interface TriggerFormSubmissionInput {
  readonly app: App
  readonly formName: string
  readonly submissionData: Readonly<Record<string, unknown>>
  readonly submissionId: string | null
  readonly formId: number | null
  readonly linkedRecord?: { readonly table: string; readonly id: string } | null
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly userId?: string
}

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

const buildFormTriggerData = (input: TriggerFormSubmissionInput): TriggerData => {
  const { formName, submissionData, submissionId, formId, linkedRecord } = input
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

export const triggerFormSubmissionAutomations = (
  input: TriggerFormSubmissionInput
): Effect.Effect<void, never, ExecuteAutomationRunRequirements | FormSubmissionRepository> =>
  Effect.gen(function* () {
    const { app, formName, processEnv, userId, submissionId } = input
    const matching = findMatchingFormAutomations(app, formName)

    if (matching.length === 0) {
      yield* advanceLedgerStatus(submissionId, 'done')
      return
    }

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
