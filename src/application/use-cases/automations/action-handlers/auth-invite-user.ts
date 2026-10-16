/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `auth/inviteUser` — invite a person by email.
 *
 * Runs the console's own invitation (`inviteUser`, the use-case behind
 * `POST /api/auth/admin/invite-user`) in-process: the same address and role
 * checks, an account with no password, a single-use link, and the app's
 * invitation email — written to the server log when no SMTP server is set.
 *
 * What differs from the console is decided here:
 *
 * - An address that already signs in is SKIPPED by default (`ifExists: skip`):
 *   the step succeeds, sends nothing and leaves the account as it is. A record
 *   trigger re-fires on edits and imports replay, so failing the run there would
 *   abort every later step for a situation that is usually fine. `fail` restores
 *   the console's refusal. A pending account is invited again either way.
 * - The sender is the person behind the run — whoever created the record,
 *   submitted the form or started the run by hand — and nobody for a webhook or
 *   a schedule. The sender never bounds the invitation: the role is the one the
 *   configuration wrote, and no scope assignment is passed on.
 * - `expiresIn` overrides `auth.invitationTokenExpiry` for this step's links.
 */

import { Data, Effect } from 'effect'
import { ConfigInvitationIssuer } from '@/application/ports/services/invitation-issuer'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { inviteUser } from '@/application/use-cases/auth/admin-invitation'
import { parseDuration } from '@/domain/kernel/time/parse-duration'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { InvitationKit } from '@/application/ports/services/invitation-issuer'
import type { App } from '@/domain/models/app'

/** The invitation use-case rejected — the store, the engine or the mailer threw. */
class InviteUserStepError extends Data.TaggedError('InviteUserStepError')<{
  readonly cause: unknown
}> {}

/** The trigger types a person's own action starts, so a run of one has a sender. */
const PERSON_TRIGGERS: ReadonlySet<string> = new Set(['record', 'form', 'comment', 'manual'])

/** The name the email gives a sender when nobody is behind the run, as the console does. */
const NO_SENDER_NAME = 'An administrator'

/** The type of the trigger entry that started the run, as the run records it. */
const startedByType = (runContext: ActionRunContext | undefined): string | undefined => {
  const startedBy = runContext?.triggerData['startedBy']
  if (startedBy === null || typeof startedBy !== 'object') return undefined
  const { type } = startedBy as { readonly type?: unknown }
  return typeof type === 'string' ? type : undefined
}

/**
 * The account of the person behind the run, or `undefined` when nobody is: a
 * webhook caller and a schedule are not senders, even with a session attached.
 */
const senderOf = (
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
): string | undefined => {
  if (automation.userId === undefined) return undefined
  if (automation.startedByHand === true) return automation.userId
  const type = startedByType(runContext)
  return type !== undefined && PERSON_TRIGGERS.has(type) ? automation.userId : undefined
}

/** The link lifetime `expiresIn` names, in milliseconds, or `undefined` to use the app's. */
const lifetimeOf = (raw: unknown): number | undefined => {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : undefined
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  const parsed = parseDuration(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * The sender's display name. A lookup that cannot answer is logged and the
 * email falls back to the no-sender wording; the sender is still recorded.
 */
const senderNameOf = (kit: InvitationKit, senderId: string | undefined) =>
  senderId === undefined
    ? Effect.succeed(NO_SENDER_NAME)
    : Effect.tryPromise({
        try: () => kit.services.store.findUserById(senderId),
        catch: (cause) => new InviteUserStepError({ cause }),
      }).pipe(
        Effect.map((user) => user?.name ?? NO_SENDER_NAME),
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logError('[automations] auth.inviteUser could not read the sender name', cause)
          })
        ),
        // effect-swallow: logged above; the name only words the email, and the sender id is still recorded on the invitation.
        Effect.orElseSucceed(() => NO_SENDER_NAME)
      )

const failure = (error: string): ActionOutcome => ({ status: 'failure', error })

/** Issue the invitation with the step's props, through the console's use-case. */
const issue = (
  kit: InvitationKit,
  app: App,
  props: Readonly<Record<string, unknown>>,
  context: {
    readonly senderId: string | undefined
    readonly senderName: string
    readonly baseURL: string
  }
) =>
  Effect.tryPromise({
    try: () =>
      inviteUser({
        services: kit.services,
        authConfig: app.auth,
        emailHandlers: kit.mailer,
        baseURL: context.baseURL,
        inviterName: context.senderName,
        inviterId: context.senderId,
        expiresInMs: lifetimeOf(props['expiresIn']),
        app,
        body: {
          email: stringProp(props, 'email'),
          name: stringProp(props, 'name'),
          role: stringProp(props, 'role'),
        },
      }),
    catch: (cause) => new InviteUserStepError({ cause }),
  })

/** `auth/inviteUser` — invite a person by email, reporting whether an invitation was sent. */
export const handleAuthInviteUser: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const ifExists = props['ifExists'] === 'fail' ? 'fail' : 'skip'

    const kit = yield* Effect.result((yield* ConfigInvitationIssuer).kitFor(app))
    if (kit._tag === 'Failure') {
      logError('[automations] auth.inviteUser could not reach the auth engine', kit.failure.cause)
      return failure('auth.inviteUser: the invitation services are unavailable')
    }

    // No request to read a host from: the link is built on BASE_URL, else the
    // origin this server bound, as every other background email's link is.
    const baseURL = yield* (yield* ServerOrigin).current
    const senderId = senderOf(automation, runContext)
    const senderName = yield* senderNameOf(kit.success, senderId)
    const issued = yield* Effect.result(
      issue(kit.success, app, props, { senderId, senderName, baseURL })
    )
    if (issued._tag === 'Failure') {
      logError('[automations] auth.inviteUser failed', issued.failure.cause)
      return failure('auth.inviteUser: the invitation could not be issued')
    }

    const result = issued.success
    if (result.status === 'invited') {
      return {
        status: 'success',
        output: { invitationSent: true, userId: result.user.id, alreadyExists: result.existed },
      } as const satisfies ActionOutcome
    }
    if (result.status === 'already-onboarded' && ifExists === 'skip') {
      return {
        status: 'success',
        output: { invitationSent: false, userId: result.userId ?? null, alreadyExists: true },
      } as const satisfies ActionOutcome
    }
    return failure(
      result.status === 'already-onboarded'
        ? 'auth.inviteUser: ALREADY_EXISTS — this address already belongs to an account that signs in'
        : `auth.inviteUser: ${result.message}`
    )
  }).pipe(
    Effect.withSpan('automations.handle-auth-invite-user', { attributes: actionAttributes(action) })
  )
