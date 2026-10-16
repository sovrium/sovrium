/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading form submissions through the body-reveal gate: a body is answered
 * only when the caller asks to reveal it, the instance allows body capture
 * (`ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`) AND the caller's ACCOUNT role is
 * admin-equivalent.
 *
 * One submission: a reveal owes the critical `form.submission.body.revealed`
 * audit event, and a failed gate is refused by name (`body-capture-disabled`),
 * on HTTP (403) and over MCP alike.
 *
 * One page of the list: a reveal owes ONE critical
 * `form.submission.bodies.revealed` event for the read, and a failed gate is
 * NOT refused — the page answers without bodies and says so
 * (`bodiesRevealed: false`), so a read-only tier keeps its inbox.
 */

import { Effect } from 'effect'
import {
  BuildSubmissionDetail,
  BuildSubmissionsList,
  type SubmissionsListInput,
} from '@/application/use-cases/admin/forms-overview'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { bodyCaptureDisabledErrorSchema } from '@/domain/models/api/admin/forms'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { AdminReadOutcome } from '@/application/use-cases/admin/admin-read-operation'
import type { App } from '@/domain/models/app'

export interface SubmissionRequest {
  readonly formName: string
  readonly submissionId: string
  readonly reveal: boolean
}

/**
 * Whether this instance lets an admin reveal submission bodies. Read per
 * request so a restart-free env change is honoured as the route always did.
 */
const bodyCaptureAllowed = (): boolean =>
  process.env['ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED'] === 'true'

const BODY_CAPTURE_DISABLED = 'body-capture-disabled'

/**
 * Whether the caller may be shown submission bodies on this instance: capture
 * allowed AND an admin-equivalent ACCOUNT role (not the audit actor's coerced
 * tier — the built-in `admin` and the app's top role both qualify).
 */
export const canRevealSubmissionBodies = Effect.fn('admin.forms.can-reveal-bodies')(function* (
  app: App,
  actorUserId: string
) {
  if (!bodyCaptureAllowed()) return false
  return isAdminEquivalent(yield* getUserRole(actorUserId), app)
})

/** One submission, its body revealed only through the reveal gate. */
export const readSubmission = (
  app: App,
  { formName, submissionId, reveal }: SubmissionRequest,
  actorUserId: string
) =>
  Effect.gen(function* () {
    // Judged on the ACCOUNT role, not the audit actor's coerced tier.
    const accountRole = yield* getUserRole(actorUserId)
    const outcome = yield* BuildSubmissionDetail({
      formName,
      submissionId,
      reveal,
      captureAllowed: bodyCaptureAllowed(),
      isAdmin: isAdminEquivalent(accountRole, app),
    })
    switch (outcome._tag) {
      case 'RevealDenied':
        return {
          _tag: 'Refused',
          status: 403,
          body: decodeOrThrow(bodyCaptureDisabledErrorSchema)({ error: BODY_CAPTURE_DISABLED }),
          reason: BODY_CAPTURE_DISABLED,
        } satisfies AdminReadOutcome
      case 'Ok':
        return {
          _tag: 'Ok',
          body: outcome.body,
          alsoAudit: outcome.bodyRevealed
            ? [{ action: AUDIT_ACTIONS.FORM_SUBMISSION_BODY_REVEALED, severity: 'critical' }]
            : [],
        } satisfies AdminReadOutcome
      case 'NotFound':
      case 'ValidationFailed':
        return outcome
    }
  }).pipe(
    Effect.withSpan('admin.forms.read-submission', {
      attributes: { 'admin.form': formName, 'admin.reveal_requested': reveal },
    })
  )

/** One page of a form's submissions, each with its body when the gate passes. */
export const readSubmissionsList = (app: App, input: SubmissionsListInput, actorUserId: string) =>
  Effect.gen(function* () {
    const revealBodies = input.reveal && (yield* canRevealSubmissionBodies(app, actorUserId))
    const outcome = yield* BuildSubmissionsList(input, revealBodies)
    if (outcome._tag !== 'Ok') return outcome
    return {
      _tag: 'Ok',
      body: outcome.body,
      alsoAudit: revealBodies
        ? [{ action: AUDIT_ACTIONS.FORM_SUBMISSION_BODIES_REVEALED, severity: 'critical' }]
        : [],
    } satisfies AdminReadOutcome
  }).pipe(
    Effect.withSpan('admin.forms.read-submissions-list', {
      attributes: { 'admin.form': input.formName, 'admin.reveal_requested': input.reveal },
    })
  )
