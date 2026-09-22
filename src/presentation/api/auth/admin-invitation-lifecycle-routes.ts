/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The invitation LIFECYCLE endpoints — list / resend / revoke.
 *
 *   - `GET    /api/admin/invitations`             — what is outstanding
 *   - `POST   /api/admin/invitations/:id/resend`  — send it again
 *   - `DELETE /api/admin/invitations/:id`         — take it back
 *
 * Registered alongside issue + accept (`admin-invitation-routes.ts`) rather than
 * with the other `/api/admin/*` reads, because resend needs the same
 * `emailHandlers` / `baseURL` / inviter identity the issue path already has
 * threaded through it. They share ONE guard — `requireAdminCaller`
 * (`isAdminEquivalent`, denying with **404**, never 403) — so the whole
 * invitation surface answers a non-admin identically and none of it is
 * discoverable by probing. The `/api/admin/*` wildcard in `api-routes.ts` sits
 * in front as defence in depth.
 *
 * **An invitation is addressed by its row id, never by its token.** The token
 * accepts the invitation; the id merely names it. That split is what lets the
 * pending list stay token-free (a token in an operator list is a credential in a
 * log, a screenshot and a browser-history entry) while still being actionable.
 */

import {
  listInvitations,
  resendInvitation,
  revokeInvitation,
  type InvitationActionResult,
} from '@/application/use-cases/auth/admin-invitation-lifecycle'
import {
  adminInvitationResendResponseSchema,
  adminInvitationRevokeResponseSchema,
  adminInvitationsListResponseSchema,
} from '@/domain/models/api/admin/invitations/lifecycle'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { logError } from '@/infrastructure/logging/logger'
import { requireAdminCaller } from '@/presentation/api/auth/admin-invitation-guard'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { Schema } from 'effect'
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
    ? c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
    : c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)

/**
 * The response-schema surface this module needs, described STRUCTURALLY.
 *
 * Zod is restricted to `domain/models/api` and `presentation` (see
 * `[internal ref]`), and this route module lives in
 * infrastructure — so the gate is typed by the one method it calls rather than
 * by importing Zod's types across that boundary.
 */

/**
 * Gate an assembled body through its response schema before it goes on the
 * wire, answering 500 rather than shipping a body that violates the contract.
 *
 * The schemas are `.strict()`, so this is the boundary that would catch a stray
 * key — a token above all — smuggled into an invitation payload.
 */
const respondValidated = (
  c: Context,
  schema: Schema.Top,
  body: unknown,
  what: string
): Response => {
  const parsed = decodeSafe(schema)(body)
  if (!parsed.success) {
    logError(`[admin-invitation] ${what} response validation failed`, parsed.error)
    return c.json({ success: false, message: `Failed to ${what}`, code: 'INTERNAL_ERROR' }, 500)
  }
  return c.json(parsed.data as Record<string, unknown>, 200)
}

/**
 * GET /api/admin/invitations
 *
 * Every outstanding invitation, each with the address, role, issuer, issue date
 * and expiry an operator needs to act on — and an explicit `status`.
 *
 * EXPIRED invitations are listed AS expired rather than omitted: "it expired"
 * and "it was never sent" are different problems with different next actions,
 * and a list that drops expired rows makes them look identical.
 */
const createListInvitationsHandler =
  (authInstance: AuthInstance, app: Readonly<App> | undefined) => async (c: Context) => {
    try {
      const authorized = await requireAdminCaller(authInstance, c, app)
      if (authorized instanceof Response) return authorized

      const items = await listInvitations()
      c.header('Cache-Control', 'no-store')
      return respondValidated(c, adminInvitationsListResponseSchema, { items }, 'list invitations')
    } catch (error) {
      logError('[admin-invitation] list-invitations handler crashed', error)
      return c.json(
        { success: false, message: 'Failed to list invitations', code: 'INTERNAL_ERROR' },
        500
      )
    }
  }

/**
 * POST /api/admin/invitations/:id/resend
 *
 * Delivers the SAME invitation again and re-arms its expiry. The token is
 * reused rather than rotated and never appears in the response — see
 * `resendInvitation` for why.
 */
const createResendInvitationHandler =
  (
    authInstance: AuthInstance,
    emailHandlers: EmailHandlers,
    app: Readonly<App> | undefined,

    resolveBaseURL: (c: Context) => string
  ) =>
  async (c: Context) => {
    try {
      const authorized = await requireAdminCaller(authInstance, c, app)
      if (authorized instanceof Response) return authorized

      const result = await resendInvitation({
        authConfig: app?.auth,
        emailHandlers,
        baseURL: resolveBaseURL(c),
        inviterName: authorized.session.user.name ?? 'An administrator',
        id: c.req.param('id') ?? '',
      })
      if (result.status !== 'ok') return respondToActionFailure(c, result)
      return respondValidated(
        c,
        adminInvitationResendResponseSchema,
        { invitation: result.value },
        'resend invitation'
      )
    } catch (error) {
      logError('[admin-invitation] resend-invitation handler crashed', error)
      return c.json(
        { success: false, message: 'Failed to resend invitation', code: 'INTERNAL_ERROR' },
        500
      )
    }
  }

/**
 * DELETE /api/admin/invitations/:id
 *
 * Takes the invitation back. Deleting the stored row is what makes the emailed
 * link INERT — the accept flow resolves a token by looking that row up, so once
 * it is gone the link fails closed rather than merely disappearing from the
 * operator's list.
 */
const createRevokeInvitationHandler =
  (authInstance: AuthInstance, app: Readonly<App> | undefined) => async (c: Context) => {
    try {
      const authorized = await requireAdminCaller(authInstance, c, app)
      if (authorized instanceof Response) return authorized

      const result = await revokeInvitation(c.req.param('id') ?? '')
      if (result.status !== 'ok') return respondToActionFailure(c, result)
      return respondValidated(
        c,
        adminInvitationRevokeResponseSchema,
        { id: result.value, revoked: true },
        'revoke invitation'
      )
    } catch (error) {
      logError('[admin-invitation] revoke-invitation handler crashed', error)
      return c.json(
        { success: false, message: 'Failed to revoke invitation', code: 'INTERNAL_ERROR' },
        500
      )
    }
  }

/** Everything the three lifecycle routes need to be constructed. */
export interface InvitationLifecycleRouteDeps {
  readonly authInstance: AuthInstance
  readonly emailHandlers: EmailHandlers
  /**
   * Passed in rather than re-derived so the accept link a resend delivers is
   * built exactly the way the original issue path built it.
   */

  readonly resolveBaseURL: (c: Context) => string
  readonly app?: Readonly<App> | undefined
}

/**
 * Chain the three lifecycle routes onto a Hono app.
 */
export const chainAdminInvitationLifecycleRoutes = (
  honoApp: Readonly<Hono>,
  deps: InvitationLifecycleRouteDeps
): Readonly<Hono> =>
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- `.delete()` here is Hono's HTTP route registrar, not a Drizzle query builder; the rule matches on the method name alone
  honoApp
    .get('/api/admin/invitations', createListInvitationsHandler(deps.authInstance, deps.app))
    .post(
      '/api/admin/invitations/:id/resend',
      createResendInvitationHandler(
        deps.authInstance,
        deps.emailHandlers,
        deps.app,
        deps.resolveBaseURL
      )
    )
    .delete(
      '/api/admin/invitations/:id',
      createRevokeInvitationHandler(deps.authInstance, deps.app)
    )
