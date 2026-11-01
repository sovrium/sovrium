/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { logError } from '@/infrastructure/logging/logger'
import { guardCreatedAccount } from './account-creation-guard'
import { writablePreferenceLanguages } from './account-preferences'
import { dispatchAuthEvent, emailVerifiedHooks } from './auth-event-hooks'
import { ensureMembership, ensureOrganization } from './org-team-seeder'
import {
  guardPlatformAccountCreate,
  refusePlatformSignUp,
  stripPlatformTokensOnUpdate,
  type PlatformAccountHookCtx,
} from './plugins/platform-sso-account-hooks'
import * as ssoPlugin from './plugins/sso'
import { buildSessionHooks } from './session-database-hooks'
import { refuseSsoOwnedDomainSelfSignUp } from './sso-owned-domain-guard'
import type { createEmailHandlers } from './email-handlers'
import type { AccountHookCtx } from './plugins/sso-account-hooks'
import type { AuthHookPolicies } from '@/application/ports/contracts/auth-hook-policies'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/domain/models/app/auth'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/**
 * Better Auth's database hooks: the organization a new user is enrolled in, the
 * session it is activated on, and the auth events dispatched to automations.
 */

/**
 * Optional app metadata used by the organization/team seeding hooks and the
 * AU-03 auth-event → automation dispatch bridge.
 *
 * Sovrium runs exactly one Better Auth organization per app. The user-create
 * hook auto-enrolls every new user into that single organization (so the
 * organization-plugin team endpoints work), and the session-create hook
 * points each session's `activeOrganizationId` at it. Only the display name
 * is needed for org seeding — the organization id/slug are fixed constants.
 *
 * The `automations` field is consumed by `dispatchAuthEvent` to find
 * matching `trigger.type === 'auth'` automations when Better Auth's
 * lifecycle hooks fire. Callers pass the full `App` (server.ts:191) so
 * structural typing gives both pieces from the same object.
 */
/**
 * What the Better Auth database hooks need beyond the config: the app they
 * belong to, and the running server's resolved services.
 *
 * The services are what let an auth-event trigger reach the ONE automation
 * runtime the server composed at boot. Before this they were rebuilt per event
 * — a second composition of a layer whose own header says there must be exactly
 * one, and the reason the automation route runner could not retire.
 */
export interface AuthHookContext {
  readonly appMeta: AppMetaForOrg | undefined
  readonly domainContext: DomainContext | undefined
  /**
   * The application's decisions the hooks consult — the last-admin rail, the
   * role and ban reads, the audit records, the auth-event dispatch — built by
   * the server (`makeAuthHookPolicies`) and handed to `createAuthInstance`.
   */
  readonly policies: AuthHookPolicies
  /**
   * The database the composition handed the instance: its adapter writes
   * through this client, and the hooks' own reads and writes go through it.
   */
  readonly database: DatabaseService
}

export type AppMetaForOrg = {
  readonly name?: string
  /** The name people read, when declared — the two-factor issuer prints it. */
  readonly displayName?: string
  readonly automations?: App['automations']
  /**
   * The app's declared languages, read by the write-door guard on
   * `auth.user.language`. Carried here rather than on `authConfig` because the
   * preference is a property of the ACCOUNT while the vocabulary that makes a
   * value legal belongs to the APP being served.
   */
  readonly languages?: App['languages']
  /** `admin: false` removes the console, and its languages, from the write door. */
  readonly admin?: App['admin']
  /** The app's tables, swept by the erasure an immediate account deletion runs. */
  readonly tables?: App['tables']
  readonly env?: App['env'] // what `$env.NAME` references in `auth.sso` resolve against
}

/**
 * What an account write may carry: the app's own SSO providers' rules first,
 * then the Sovrium Cloud binding rules (one Cloud user per account, no token).
 */
const buildAccountHooks = (authConfig: Auth | undefined) => {
  const guardSso = ssoPlugin.guardSsoAccountLink(authConfig)
  return {
    create: {
      before: async (
        account: Readonly<Record<string, unknown>>,
        ctx: (AccountHookCtx & PlatformAccountHookCtx) | null
      ) =>
        (await guardSso(account, ctx)) === false ? false : guardPlatformAccountCreate(account, ctx),
    },
    update: { before: stripPlatformTokensOnUpdate },
  }
}

/**
 * Build the Better Auth `databaseHooks` block.
 *
 * Hooks installed when auth is configured:
 *  - `session.create.before` points every session's `activeOrganizationId`
 *    at the single per-app organization so the organization-plugin team
 *    endpoints (`/api/auth/organization/*`) resolve.
 *  - `session.delete.after` closes the realtime connections opened with the
 *    deleted session — every session Better Auth deletes: sign-out, a
 *    revocation, a ban, an admin-set password, an expired session cleaned up
 *    on read.
 *  - `user.create.before` refuses what no road may create (a closed sign-up
 *    through a federated or passwordless door, a client-chosen avatar, an
 *    undeclared language, an operator-email switch) and strips markup from
 *    the name (`account-creation-guard.ts`).
 *  - `user.create.after` runs the welcome email, auto-enrolls the new user
 *    into that organization, AND
 *    (AU-03) fires any `trigger.type === 'auth'` automations that
 *    subscribe to the `signUp` event.
 *  - `user.update.before`/`after` fire `emailVerified` auth-event
 *    automations when an update makes the address verified — and only then:
 *    a later update of an already verified account (a rename) leaves the row's
 *    `emailVerified` at `true` without being a verification.
 *
 * `signIn`, `signOut` and `passwordReset` are dispatched from the request
 * hooks and `onPasswordReset` instead (see `auth-event-hooks.ts`): a session
 * row alone does not say whether a person signed in or out.
 *
 * Extracted from `createAuthInstance` to keep that function under the
 * project-wide `max-lines-per-function` limit.
 */
export function buildDatabaseHooks(
  handlers: Readonly<ReturnType<typeof createEmailHandlers>>,
  authConfig: Auth | undefined,
  hookContext: AuthHookContext
) {
  const refuseSsoSignUp = ssoPlugin.refuseClosedSsoSignUp(authConfig)
  const languages = writablePreferenceLanguages(hookContext.appMeta)
  return {
    session: buildSessionHooks(authConfig),
    account: buildAccountHooks(authConfig),
    user: {
      create: {
        before: async (
          user: Readonly<Record<string, unknown>>,
          ctx: { readonly path?: string; readonly params?: unknown } | null
        ) => {
          await refusePlatformSignUp(ctx)
          refuseSsoOwnedDomainSelfSignUp(authConfig, user, ctx)
          // The avatar, name, language and operator-email rules, on every
          // creating road, the passwordless ones included.
          return refuseSsoSignUp(guardCreatedAccount(user, ctx, languages), ctx)
        },
        after: async (
          user: Readonly<{ id: string; email: string; name: string; role?: string | null }>
        ) => {
          await handlers.welcome({ email: user.email, name: user.name })
          // Auto-enroll the user into the single per-app organization so the
          // organization-plugin team endpoints (`/api/auth/organization/*`)
          // resolve. Best-effort: a failure here must never block sign-up.
          if (authConfig) {
            try {
              await ensureOrganization(
                hookContext.database.client,
                hookContext.appMeta?.name ?? 'sovrium'
              )
              await ensureMembership(
                hookContext.database.client,
                user.id,
                typeof user.role === 'string' && isAdminEquivalent(user.role, { auth: authConfig })
              )
            } catch (error) {
              // Non-fatal: org enrollment is best-effort, and an administrator
              // left out is enrolled as owner on their first group change.
              logError('[auth] organization enrollment failed after sign-up', error)
            }
          }
          // AU-03: fire any `trigger.type === 'auth'` automations that
          // subscribe to the `signUp` event. The user object Better Auth
          // hands us already has `id`/`email`/`name` so action templates
          // can read `{{trigger.data.user.email}}` without a DB lookup.
          // Fire-and-forget at the hook boundary — the use case absorbs
          // its own errors so a misconfigured automation never blocks
          // sign-up. AWAIT it here (not bare promise) so the response
          // body the spec asserts (`/api/tables/activity-log/records`
          // already populated) doesn't race the automation dispatch.
          await dispatchAuthEvent('signUp', user, hookContext)
        },
      },
      update: emailVerifiedHooks(hookContext),
    },
  }
}
