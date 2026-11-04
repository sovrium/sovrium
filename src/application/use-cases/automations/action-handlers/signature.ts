/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { cancelSignatureRequest } from '@/application/use-cases/signatures/end-signature-request'
import {
  sendSignatureRequest,
  SignatureSendRefusal,
} from '@/application/use-cases/signatures/send-signature-request'
import { buildSystemSession } from '../build-guest-session'
import { updateEngineValuesAndAnnounce } from './record/events'
import { actionAttributes } from './shared'
import type { ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import type { SignatureDocumentIntake } from '@/application/ports/services/signature-document-intake'
import type { SignaturePdf } from '@/application/ports/services/signature-pdf'
import type { FlowRecordWrite } from '@/application/use-cases/signatures/signature-request-effects'
import type { App } from '@/domain/models/app'

/**
 * `signature/send` and `signature/cancel` — start and withdraw a signing
 * request from a workflow.
 *
 * A send that cannot start fails the step with `output.error: { code,
 * message }` (`document-missing`, `request-open`, a document refusal…), which
 * a later step reads after `continueOnError`; the same refusal comes back on
 * every try, so no retry policy retries it. A started send outputs exactly
 * `{ requestId, status }`: never a link, a token or an address, since a run's
 * output is read by people the signers never chose.
 *
 * A cancel outputs `{ cancelled: true, requestId, status }` when it ended a
 * request and `{ cancelled: false }` when the record had none open, which is
 * not a failure. Each move starts the flow's signature automations.
 */

/** The services the signature steps reach beyond every step's: the requests, and the document intake. */
export type SignatureStepRequirements =
  SignatureRequestRepository | SignatureDocumentIntake | SignaturePdf

/** A prop as text; a number, or a template answering one, is read as its text. */
const textProp = (props: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = props[key]
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** The record a step acts on: the one it names, else the record that started the run. */
const recordIdOf = (
  props: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): string | undefined => {
  const named = textProp(props, 'recordId')
  if (named !== undefined) return named
  const record = runContext?.triggerData['record']
  const id =
    typeof record === 'object' && record !== null ? (record as { id?: unknown }).id : undefined
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
}

/** A step writes the flow's status through its run's channel, as the engine. */
const stepWriter = (runContext: ActionRunContext | undefined) => (write: FlowRecordWrite) =>
  updateEngineValuesAndAnnounce({ ...write, session: buildSystemSession(), runContext })

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Readonly<Record<string, unknown>> | undefined) ?? {}

/** A step that cannot act, with the code a later step reads. */
const refusedStep = (code: string, message: string): ActionOutcome => ({
  status: 'failure',
  error: message,
  output: { error: { code, message } },
  retryable: false,
})

export const handleSignatureSend = (
  action: Readonly<Record<string, unknown>>,
  app: App,
  _automation: AutomationContext,
  runContext?: ActionRunContext
) =>
  Effect.gen(function* () {
    const props = propsOf(action)
    const recordId = recordIdOf(props, runContext)
    if (recordId === undefined) {
      return refusedStep('record-missing', 'signature/send names no record to send for')
    }
    const flowName = textProp(props, 'flow') ?? ''
    const sent = yield* Effect.result(
      sendSignatureRequest({ app, flowName, recordId, writer: stepWriter(runContext) })
    )
    if (sent._tag === 'Failure') {
      const { failure } = sent
      return failure instanceof SignatureSendRefusal
        ? refusedStep(failure.code, failure.message)
        : ({ status: 'failure', error: String(failure) } satisfies ActionOutcome)
    }
    const { requestId, status, flow, trigger } = sent.success
    yield* Effect.sync(() =>
      runContext?.recordEvents?.signatures?.dispatch({ flow, recordId, signature: trigger })
    )
    return { status: 'success', output: { requestId, status } } satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-signature-send', { attributes: actionAttributes(action) })
  )

export const handleSignatureCancel = (
  action: Readonly<Record<string, unknown>>,
  app: App,
  _automation: AutomationContext,
  runContext?: ActionRunContext
) =>
  Effect.gen(function* () {
    const props = propsOf(action)
    const recordId = recordIdOf(props, runContext)
    if (recordId === undefined) {
      return { status: 'success', output: { cancelled: false } } satisfies ActionOutcome
    }
    const outcome = yield* Effect.result(
      cancelSignatureRequest({
        ...{
          app,
          flowName: textProp(props, 'flow') ?? '',
          recordId,
          writer: stepWriter(runContext),
        },
        reason: textProp(props, 'reason'),
      })
    )
    if (outcome._tag === 'Failure') {
      return { status: 'failure', error: String(outcome.failure) } satisfies ActionOutcome
    }
    const cancelled = outcome.success
    if (!cancelled.cancelled) {
      return { status: 'success', output: { cancelled: false } } satisfies ActionOutcome
    }
    yield* Effect.sync(() =>
      runContext?.recordEvents?.signatures?.dispatch({
        ...{ flow: cancelled.move.flow, recordId },
        signature: cancelled.move.trigger,
      })
    )
    return {
      status: 'success',
      output: { cancelled: true, requestId: cancelled.requestId, status: cancelled.status },
    } satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-signature-cancel', { attributes: actionAttributes(action) })
  )
