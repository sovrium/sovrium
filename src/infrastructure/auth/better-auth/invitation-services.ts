/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  deleteCredentialAccountForUser,
  deleteInvitationToken,
  deletePendingInvitationsForUser,
  findInvitationById,
  findInvitationToken,
  findUserByEmail,
  findUserById,
  insertCredentialAccount,
  insertInvitationToken,
  listPendingInvitations,
  markUserEmailVerified,
  refreshInvitationExpiry,
  userHasCredentialPassword,
} from './invitation-queries'
import { inheritScopeAssignments } from './invitation-scope-queries'
import type { createAuthInstance } from './auth'
import type {
  InvitationAuthEngine,
  InvitationServices,
  InvitationStore,
} from '@/application/ports/contracts/invitation-services'

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/** {@link InvitationStore} over the invitation and account queries. */
export const invitationStore: InvitationStore = {
  insertInvitationToken,
  findInvitationToken,
  findInvitationById,
  refreshInvitationExpiry,
  deleteInvitationToken,
  deletePendingInvitationsForUser,
  listPendingInvitations,
  findUserByEmail,
  findUserById,
  userHasCredentialPassword,
  insertCredentialAccount,
  markUserEmailVerified,
  deleteCredentialAccountForUser,
  inheritScopeAssignments,
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
  createUser: async (input) => {
    const created = await authInstance.api.createUser({
      body: {
        email: input.email,
        name: input.name,
        role: input.role as 'user' | 'admin',
        password: input.password,
      },
    })
    return 'user' in created && created.user?.id ? created.user.id : undefined
  },
  hashPassword: async (password) => {
    const ctx = await authInstance.$context
    return ctx.password.hash(password)
  },
})

/**
 * The invitation store and engine the composition root hands to the invitation
 * routes — `undefined` exactly when there is no auth instance, which is when the
 * routes are not mounted at all.
 */
export function createInvitationServices(authInstance: AuthInstance): InvitationServices
export function createInvitationServices(
  authInstance: AuthInstance | undefined
): InvitationServices | undefined
export function createInvitationServices(
  authInstance: AuthInstance | undefined
): InvitationServices | undefined {
  return authInstance === undefined
    ? undefined
    : { store: invitationStore, engine: createInvitationAuthEngine(authInstance) }
}
