/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
import type { createEmailHandlers } from './email-handlers'
import type { AccountHookCtx } from './plugins/sso-account-hooks'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/domain/models/app/auth'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/**
 * Better Auth's database hooks: the organization a new user is enrolled in, the
 * session it is activated on, and the auth events dispatched to automations.
 */

/**
 * Connection definition shape consumed by the auth user-create hook for
 * test-mode token seeding. Defined locally (rather than imported from
 * `@/domain/models/app/connections`) so this module stays decoupled from
 * the connections schema — at import time we only need the structural
 * `{ name, type, props }` triple.
 */
export type ConnectionForSeed = {
  readonly name: string
  readonly type: string
  readonly props: Record<string, unknown>
}

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
}

export type AppMetaForOrg = {
  readonly name?: string
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
 *  - `user.create.after` runs the welcome email, auto-enrolls the new user
 *    into that organization, (test-mode only) seeds OAuth tokens, AND
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
  connections: readonly ConnectionForSeed[] | undefined,
  hookContext: AuthHookContext
) {
  const refuseSsoSignUp = ssoPlugin.refuseClosedSsoSignUp(authConfig)
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
          return refuseSsoSignUp(user, ctx)
        },
        after: async (user: Readonly<{ id: string; email: string; name: string }>) => {
          await handlers.welcome({ email: user.email, name: user.name })
          // Auto-enroll the user into the single per-app organization so the
          // organization-plugin team endpoints (`/api/auth/organization/*`)
          // resolve. Best-effort: a failure here must never block sign-up.
          if (authConfig) {
            try {
              await ensureOrganization(hookContext.appMeta?.name ?? 'sovrium')
              await ensureMembership(user.id)
            } catch {
              // Non-fatal: org enrollment is best-effort.
            }
          }
          // Test-mode auto-seed: production no-ops (the seeder checks
          // NODE_ENV internally) so this stays safe in real deployments.
          // Lazy-imported so the seeder's dependency graph (repositories
          // + crypto) doesn't pull at module load time when no
          // connections are configured.
          if (connections !== undefined && connections.length > 0) {
            const { runSeedTestConnectionTokens } =
              await import('@/infrastructure/connections/test-token-seeder')
            await runSeedTestConnectionTokens({
              userId: user.id,
              userEmail: user.email,
              connections,
            })
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

/**
 * Create Better Auth instance with dynamic configuration.
 *
 * When `connections` is provided, the user-create hook also seeds
 * per-user OAuth tokens for every `oauth2` connection. The seeder
 * no-ops in production (see `test-token-seeder.ts`); it exists so E2E
 * specs can assert against an "as if authorized" database state without
 * driving a real provider round-trip.
 *
 * When `authConfig` is set, the organization plugin is enabled and the
 * user/session database hooks auto-enroll users into the single per-app
 * organization so the native team endpoints (`/api/auth/organization/*`)
 * resolve against an active organization.
 */
