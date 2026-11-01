/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { Invitations } from '@/application/ports/services/invitations'
import { logError } from '@/infrastructure/logging/logger'
import {
  deleteCredentialAccountForUser,
  findUserByEmail,
  findUserById,
  insertCredentialAccount,
  markUserEmailVerified,
  userHasCredentialPassword,
} from './invitation-account-queries'
import {
  deleteInvitationToken,
  deletePendingInvitationsForUser,
  findInvitationById,
  findInvitationToken,
  insertInvitationToken,
  listPendingInvitations,
  refreshInvitationExpiry,
} from './invitation-queries'
import { inheritScopeAssignments } from './invitation-scope-queries'
import type { createAuthInstance } from './auth'
import type { AuthHookContext } from './auth-database-hooks'
import type {
  InvitationAuthEngine,
  InvitationServices,
  InvitationStore,
} from '@/application/ports/contracts/invitation-services'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/**
 * {@link InvitationStore} over the invitation and account queries, run through
 * `client` — the client the auth instance's adapter writes through.
 */
export const invitationStoreOver = (
  client: PortableDb,
  dialect: DatabaseDialect
): InvitationStore => ({
  insertInvitationToken: (...args) => insertInvitationToken(client, ...args),
  findInvitationToken: (...args) => findInvitationToken(client, ...args),
  findInvitationById: (...args) => findInvitationById(client, ...args),
  refreshInvitationExpiry: (...args) => refreshInvitationExpiry(client, ...args),
  deleteInvitationToken: (...args) => deleteInvitationToken(client, ...args),
  deletePendingInvitationsForUser: (...args) => deletePendingInvitationsForUser(client, ...args),
  listPendingInvitations: () => listPendingInvitations(client),
  findUserByEmail: (...args) => findUserByEmail(client, ...args),
  findUserById: (...args) => findUserById(client, ...args),
  userHasCredentialPassword: (...args) => userHasCredentialPassword(client, ...args),
  insertCredentialAccount: (...args) => insertCredentialAccount(client, ...args),
  markUserEmailVerified: (...args) => markUserEmailVerified(client, ...args),
  deleteCredentialAccountForUser: (...args) => deleteCredentialAccountForUser(client, ...args),
  inheritScopeAssignments: (...args) => inheritScopeAssignments({ db: client, dialect }, ...args),
})

/**
 * The engine's account creation over one Better Auth API: the role is widened
 * here because Better Auth types it as its closed `'user' | 'admin'` union while
 * Sovrium permits custom roles via `auth.roles[]`.
 */
export const createUserThrough =
  (api: Pick<AuthInstance['api'], 'createUser'>): InvitationAuthEngine['createUser'] =>
  async (input) => {
    const created = await api.createUser({
      body: {
        email: input.email,
        name: input.name,
        role: input.role as 'user' | 'admin',
        password: input.password,
      },
    })
    return 'user' in created && created.user?.id ? created.user.id : undefined
  }

/**
 * {@link InvitationAuthEngine} over one Better Auth instance.
 *
 * The role is widened at this boundary because Better Auth's plugin types
 * insist on its closed `'user' | 'admin'` union while Sovrium permits custom
 * roles via `auth.roles[]`. The hasher is `auth.$context.password.hash`, the
 * same one `/sign-up/email` uses, so the credential row the accept flow links
 * is verifiable by the engine's standard sign-in.
 */
const createInvitationAuthEngine = (authInstance: AuthInstance): InvitationAuthEngine => ({
  createUser: createUserThrough(authInstance.api),
  hashPassword: async (password) => {
    const ctx = await authInstance.$context
    return ctx.password.hash(password)
  },
})

/**
 * The invitation store and engine the composition root hands to the invitation
 * routes — `undefined` exactly when there is no auth instance, which is when the
 * routes are not mounted at all.
 *
 * `linkPages` is a thunk read on first access: the console's invitation pages
 * come from its preset, which is decoded on first use rather than at start.
 * `hookContext` reaches the app's auth automations, which an acceptance starts
 * (`emailVerified`, `invitationAccepted`); absent, it starts none.
 */
/** What the composition hands the invitation services. */
export interface InvitationWiring {
  /** The database the invitation store reads and writes. */
  readonly database: DatabaseService
  readonly linkPages?: () => NonNullable<InvitationServices['linkPages']>
  readonly hookContext?: AuthHookContext
}

export function createInvitationServices(
  authInstance: AuthInstance,
  wiring: InvitationWiring
): InvitationServices
export function createInvitationServices(
  authInstance: AuthInstance | undefined,
  wiring: InvitationWiring
): InvitationServices | undefined
export function createInvitationServices(
  authInstance: AuthInstance | undefined,
  { database: { client, dialect }, linkPages, hookContext }: InvitationWiring
): InvitationServices | undefined {
  if (authInstance === undefined) return undefined
  const services: InvitationServices = {
    store: invitationStoreOver(client, dialect.kind),
    engine: createInvitationAuthEngine(authInstance),
    // The composition seam for a Promise-shaped caller: the program runs on
    // this very bundle, read at call time so the `linkPages` getter below is
    // part of it.
    run: (program) => Effect.runPromise(Effect.provideService(program, Invitations, services)),
    ...(hookContext === undefined
      ? {}
      : {
          // Imported on first use: the hooks module loads the auth engine, which
          // an app without auth must never load at boot. The dispatcher never
          // rejects (its contract): a module that fails to load is logged, and
          // the acceptance it reacts to still answers as accepted.
          dispatchAuthEvent: (event, user, data) =>
            import('./auth-event-hooks').then(
              (hooks) => hooks.dispatchAuthEvent(event, user, hookContext, data),
              (error: unknown) => {
                logError('[admin-invitation] the auth automations could not be started', error)
              }
            ),
        }),
  }
  // A getter on the object itself, never spread in: spreading would call it.
  return linkPages === undefined
    ? services
    : Object.defineProperty(services, 'linkPages', { get: linkPages, enumerable: true })
}
