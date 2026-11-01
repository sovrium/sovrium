/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The invitation LIFECYCLE actions — resend / revoke.
 *
 * Their read, `GET /api/admin/invitations` (what is outstanding), is an admin
 * read-registry entry (`application/use-cases/admin/people-read-operations.ts`)
 * mounted with the other people reads, so its route, OpenAPI operation and MCP
 * admin tool are one entry; it is gated by the `/api/admin/*` admin-tier guard.
 *
 *   - `POST   /api/admin/invitations/:id/resend`  — send it again
 *   - `DELETE /api/admin/invitations/:id`         — take it back
 *
 * Registered alongside issue + accept (`admin-invitation-routes.ts`) rather than
 * with the other `/api/admin/*` reads, because resend needs the same
 * `emailHandlers` / `baseURL` / inviter identity the issue path already has
 * threaded through it. They share ONE guard — `requireAdminCaller`
 * (`isAdminEquivalent`, denying with **404**, never 403) — so the whole
 * invitation surface answers a non-admin identically and none of it is
 * discoverable by probing. The `/api/admin/*` wildcard in
 * `middleware/admin-route-guards.ts` sits
 * in front as defence in depth.
 *
 * **An invitation is addressed by its row id, never by its token.** The token
 * accepts the invitation; the id merely names it. That split is what lets the
 * pending list stay token-free (a token in an operator list is a credential in a
 * log, a screenshot and a browser-history entry) while still being actionable.
 */

import { Effect } from 'effect'
import { getCookie } from 'hono/cookie'
import { Invitations } from '@/application/ports/services/invitations'
import {
  consoleLabels,
  resolveOperatorLanguage,
} from '@/application/use-cases/admin/operator-language'
import {
  resendInvitation,
  revokeInvitation,
  type InvitationActionResult,
} from '@/application/use-cases/auth/admin-invitation-lifecycle'
import {
  adminInvitationResendResponseSchema,
  adminInvitationRevokeResponseSchema,
} from '@/domain/models/api/admin/invitations/lifecycle'
import { readableName } from '@/domain/models/app/auth/readable-name-service'
import { LANGUAGE_PREFERENCE_COOKIE } from '@/domain/models/app/languages/language-detection'
import { logError } from '@/infrastructure/logging/logger'
import { requireAdminCaller } from '@/presentation/api/auth/admin-invitation-guard'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import type { InvitationServices } from '@/application/ports/contracts/invitation-services'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { Context, Hono } from 'hono'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>
type EmailHandlers = Readonly<ReturnType<typeof createEmailHandlers>>

/**
 * Map a resend/revoke FAILURE onto its HTTP response.
 *
 * `not-found` answers **404** — the same code a non-admin caller gets from the
 * guard — so an unknown id and a forbidden surface stay indistinguishable to a
 * prober. Success is shaped per-endpoint by the caller, because the two
 * mutations return meaningfully different bodies.
 */
const respondToActionFailure = (
  c: Context,
  result: Exclude<InvitationActionResult<unknown>, { readonly status: 'ok' }>
): Response =>
  result.status === 'not-found'
    ? notFound(c, 'Not Found')
    : c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)

/**
 * Whatever a program left unanswered, or a crash inside it: logged, and the
 * action's own 500.
 */
export const answerCrash = <E, R>(
  c: Context,
  program: Effect.Effect<Response, E, R>,
  action: { readonly name: string; readonly message: string }
): Effect.Effect<Response, never, R> =>
  Effect.catchCause(program, (cause) =>
    Effect.sync(() => {
      logError(`[admin-invitation] ${action.name} handler crashed`, cause)
      return c.json({ success: false, message: action.message, code: 'INTERNAL_ERROR' }, 500)
    })
  )

/**
 * What the console calls `role` for the caller, as the invitations read
 * phrases it: the app's declared label, else the console's words, else the
 * name made readable — in the operator's console language. A failed language
 * read falls back to English rather than failing a resend that already went
 * out.
 */
const roleLabelForCaller = (
  c: Context,
  app: Readonly<App> | undefined,
  actorUserId: string,
  role: string
) => {
  if (app === undefined) return Effect.succeed(readableName(role))
  const preferredLanguage = getCookie(c, LANGUAGE_PREFERENCE_COOKIE)
  return resolveOperatorLanguage({
    actorUserId,
    ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[admin-invitation] operator language read failed', cause))
    ),
    // Swallowed on purpose: the label is presentation, the resend is done.
    Effect.orElseSucceed(() => 'en' as const),
    Effect.map((language) => consoleLabels(app, language).role(role))
  )
}

/**
 * POST /api/admin/invitations/:id/resend
 *
 * Delivers the SAME invitation again and re-arms its expiry. The token is
 * reused rather than rotated and never appears in the response — see
 * `resendInvitation` for why.
 */
const createResendInvitationHandler =
  ({
    authInstance,
    emailHandlers,
    app,
    resolveBaseURL,
    invitations,
  }: InvitationLifecycleRouteDeps) =>
  (c: Context) =>
    runHandlerEffect(
      c,
      answerCrash(
        c,
        Effect.gen(function* () {
          const authorized = yield* requireAdminCaller(authInstance, c, app)
          if (authorized instanceof Response) return authorized

          const resend = resendInvitation({
            authConfig: app?.auth,
            emailHandlers,
            baseURL: resolveBaseURL(c),
            inviterName: authorized.session.user.name ?? 'An administrator',
            id: c.req.param('id') ?? '',
            pages: [...(app?.pages ?? []), ...(invitations.linkPages ?? [])],
          })
          const result = yield* Effect.provideService(resend, Invitations, invitations)
          if (result.status !== 'ok') return respondToActionFailure(c, result)
          const roleLabel = yield* roleLabelForCaller(
            c,
            app,
            authorized.session.user.id,
            result.value.role
          )
          return yield* respondWith(
            c,
            Effect.succeed({ invitation: { ...result.value, roleLabel } }),
            adminInvitationResendResponseSchema
          )
        }),
        { name: 'resend-invitation', message: 'Failed to resend invitation' }
      )
    )

/**
 * DELETE /api/admin/invitations/:id
 *
 * Takes the invitation back. Deleting the stored row is what makes the emailed
 * link INERT — the accept flow resolves a token by looking that row up, so once
 * it is gone the link fails closed rather than merely disappearing from the
 * operator's list.
 */
const createRevokeInvitationHandler =
  ({ authInstance, app, invitations }: InvitationLifecycleRouteDeps) =>
  (c: Context) =>
    runHandlerEffect(
      c,
      answerCrash(
        c,
        Effect.gen(function* () {
          const authorized = yield* requireAdminCaller(authInstance, c, app)
          if (authorized instanceof Response) return authorized

          const result = yield* Effect.provideService(
            revokeInvitation(c.req.param('id') ?? ''),
            Invitations,
            invitations
          )
          if (result.status !== 'ok') return respondToActionFailure(c, result)
          return yield* respondWith(
            c,
            Effect.succeed({ id: result.value, revoked: true }),
            adminInvitationRevokeResponseSchema
          )
        }),
        { name: 'revoke-invitation', message: 'Failed to revoke invitation' }
      )
    )

/** Everything the three lifecycle routes need to be constructed. */
export interface InvitationLifecycleRouteDeps {
  readonly authInstance: AuthInstance
  readonly emailHandlers: EmailHandlers
  /** The invitation store, built at the composition root. */
  readonly invitations: InvitationServices
  /**
   * Passed in rather than re-derived so the accept link a resend delivers is
   * built exactly the way the original issue path built it.
   */

  readonly resolveBaseURL: (c: Context) => string
  readonly app?: Readonly<App> | undefined
}

/**
 * Chain the two lifecycle actions onto a Hono app.
 */
export const chainAdminInvitationLifecycleRoutes = (
  honoApp: Readonly<Hono>,
  deps: InvitationLifecycleRouteDeps
): Readonly<Hono> =>
  honoApp
    .post('/api/admin/invitations/:id/resend', createResendInvitationHandler(deps))
    .delete('/api/admin/invitations/:id', createRevokeInvitationHandler(deps))
