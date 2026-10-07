/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the admin-invitation use-cases need from the outside, injected by the
 * composition root the same way `AvatarProfileStore` is.
 *
 * Three capabilities, deliberately narrow: the invitation rows and the
 * invitee's account rows (`InvitationStore`), the two things only the auth
 * engine can do (`InvitationAuthEngine` — create a user, hash a password the
 * way its own sign-in will verify it), and the one email the flow sends
 * (`InvitationMailer`). The use-cases hold none of the engine's own types.
 *
 * Promise-shaped rather than Effect-shaped because the invitation flow is an
 * async orchestration called from Hono handlers; every method rejects on a
 * driver failure and the use-cases decide which rejections are best-effort.
 */

/** The invitee's account, as the flow reads it. */
export interface InvitationUser {
  readonly id: string
  readonly email: string
  readonly name: string
}

/** One persisted invitation token row. */
export interface InvitationTokenRow {
  readonly id: string
  readonly token: string
  readonly userId: string
  readonly expiresAt: Date
}

/**
 * One pending invitation, joined with the invitee's account.
 *
 * `invitedBy` is the INVITER'S EMAIL, resolved from the inviter id the token
 * stores (undefined when no inviter was recorded, or when that account no
 * longer exists). The token is deliberately absent: this row feeds
 * operator surfaces that end up in logs and screenshots.
 */
export interface PendingInvitationRow {
  readonly id: string
  readonly userId: string
  readonly email: string
  readonly role: string | null
  readonly invitedBy: string | undefined
  readonly expiresAt: Date
  readonly createdAt: Date
}

export interface InvitationStore {
  readonly insertInvitationToken: (params: {
    readonly id: string
    readonly token: string
    readonly userId: string
    readonly expiresAt: Date
    readonly invitedBy?: string | undefined
  }) => Promise<void>
  readonly findInvitationToken: (token: string) => Promise<InvitationTokenRow | undefined>
  readonly findInvitationById: (id: string) => Promise<InvitationTokenRow | undefined>
  readonly refreshInvitationExpiry: (id: string, expiresAt: Readonly<Date>) => Promise<void>
  readonly deleteInvitationToken: (id: string) => Promise<void>
  readonly deletePendingInvitationsForUser: (userId: string) => Promise<void>
  readonly listPendingInvitations: () => Promise<readonly PendingInvitationRow[]>
  readonly findUserByEmail: (email: string) => Promise<InvitationUser | undefined>
  readonly findUserById: (userId: string) => Promise<InvitationUser | undefined>
  readonly userHasCredentialPassword: (userId: string) => Promise<boolean>
  readonly insertCredentialAccount: (params: {
    readonly id: string
    readonly userId: string
    readonly hashedPassword: string
  }) => Promise<void>
  readonly markUserEmailVerified: (userId: string) => Promise<void>
  readonly deleteCredentialAccountForUser: (userId: string) => Promise<void>
  /** Copy a scoped inviter's table grants onto the invitee; answers how many. */
  readonly inheritScopeAssignments: (params: {
    readonly inviterId: string
    readonly inviteeId: string
    readonly role: string
  }) => Promise<number>
}

export interface InvitationAuthEngine {
  /**
   * Create a user through the engine's admin API and answer its id, or
   * `undefined` when the engine answered without one. Rejects when the engine
   * refuses. `role` is any role the app declares.
   */
  readonly createUser: (input: {
    readonly email: string
    readonly name: string
    readonly role: string
    readonly password: string
  }) => Promise<string | undefined>
  /** Hash with the engine's configured hasher, so its own sign-in verifies the result. */
  readonly hashPassword: (password: string) => Promise<string>
}

export interface InvitationMailer {
  readonly invitation: (params: {
    readonly email: string
    readonly name: string
    readonly url: string
    readonly inviterName: string
  }) => Promise<void>
}

/** The store and engine an invitation route hands to the use-cases. */
export interface InvitationServices {
  readonly store: InvitationStore
  readonly engine: InvitationAuthEngine
}
