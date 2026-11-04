/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reminders a signing sweep sends (`register-signature-request-sweep.ts`).
 *
 * For every flow declaring `reminders`, each signer whose turn has come, who
 * has not signed, and whose last message is at least `every` old is reminded
 * by mail at the address the send froze, at most `max` times, and never once
 * the request has ended or its deadline has passed. The invitation counts as
 * message zero.
 *
 * A link is stored only as its digest, so a reminder cannot repeat the link
 * of the invitation: each reminder carries a new one, and every earlier link
 * stops working (it answers the uniform not-found). Each reminder is a
 * `reminded` event of the chain (`data.reminder` its number), which is also
 * where its count is read from, so a restart never resends one. A reminder
 * whose mail fails is logged; it still counts, as an invitation does.
 */

import { Effect } from 'effect'
import {
  SignatureReminderRepository,
  type ReminderCandidate,
} from '@/application/ports/repositories/signatures/signature-reminder-repository'
import { EmailSender } from '@/application/ports/services/email-sender'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { durationToMs } from '@/domain/kernel/time/parse-duration'
import { displayNameOf } from '@/domain/models/app/display-name-service'
import { signatureReminderMail } from '@/domain/models/app/signatures/signature-reminder-service'
import { signingLinkPath } from '@/domain/models/app/signatures/signature-request-service'
import { nowInstant, signingPagePath, type SignatureFlowOf } from './signature-request-effects'
import type { App } from '@/domain/models/app'

/** Mail one signer her reminder with its new link; a failed send is logged, never shown. */
const mailReminder = (
  app: App,
  input: { readonly candidate: ReminderCandidate; readonly path: string; readonly token: string }
) =>
  Effect.gen(function* () {
    const { candidate } = input
    if (candidate.email === undefined) return
    const origin = yield* (yield* ServerOrigin).current
    yield* (yield* EmailSender).send({
      to: candidate.email,
      fromName: displayNameOf(app),
      ...signatureReminderMail({
        ...{ appName: displayNameOf(app), displayName: candidate.displayName ?? '' },
        link: `${origin}${signingLinkPath(input.path, input.token)}`,
        expiresAt:
          candidate.expiresAtMs === undefined
            ? undefined
            : new Date(candidate.expiresAtMs).toISOString(),
      }),
    })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logError(
        `The signing reminder of ${input.candidate.signerName} could not be mailed`,
        cause
      )
    ),
    // effect-swallow: the reminder is recorded and her clock moved; the next one goes out after `every`.
    Effect.ignoreCause
  )

/** Remind the due signers of one flow; how many were reminded. */
const remindFlow = (
  app: App,
  flow: SignatureFlowOf,
  now: { readonly ms: number; readonly iso: string }
) =>
  Effect.gen(function* () {
    const { reminders } = flow
    const everyMs = reminders === undefined ? undefined : durationToMs(reminders.every)
    const path = signingPagePath(app, flow)
    if (reminders === undefined || everyMs === undefined || path === undefined) return 0
    const repository = yield* SignatureReminderRepository
    const notifiedBeforeMs = now.ms - everyMs
    const due = yield* repository.due({ flowName: flow.name, notifiedBeforeMs, nowMs: now.ms })
    const given = yield* Effect.forEach(due, (candidate) =>
      repository
        .remind({
          ...{ candidate, max: reminders.max, notifiedBeforeMs, nowMs: now.ms },
          event: (reminder) => ({
            ...{ type: 'reminded', at: now.iso, signer: candidate.signerName },
            data: { reminder },
          }),
        })
        .pipe(
          Effect.tap((reminded) =>
            reminded === undefined
              ? Effect.void
              : mailReminder(app, { candidate, path, token: reminded.token })
          )
        )
    )
    return given.filter((one) => one !== undefined).length
  })

/** One pass of the reminders over every flow that declares them; how many signers were reminded. */
export const remindAwaitingSigners = Effect.fn('signatures.remind-awaiting-signers')(function* (
  app: App
) {
  const flows = (app.signatures ?? []).filter((flow) => flow.reminders !== undefined)
  if (flows.length === 0) return 0
  const now = yield* nowInstant
  const counts = yield* Effect.forEach(flows, (flow) => remindFlow(app, flow, now))
  return counts.reduce((total, count) => total + count, 0)
})
