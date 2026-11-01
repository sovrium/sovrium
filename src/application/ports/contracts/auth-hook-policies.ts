/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the Better Auth hooks ask of the application, injected by the
 * composition root.
 *
 * Better Auth owns the writes to `user.role`, the ban columns and the account
 * row, so its `before` and `after` hooks are the only points where a last-admin
 * removal can be refused before anything changes, and where an act that stood
 * can be recorded. Those decisions are application use-cases; the hooks are
 * infrastructure. Rather than letting the hooks import the use-cases upward,
 * the server builds this record once per auth instance
 * (`infrastructure/server/auth-hook-policies.ts`) and hands it to
 * `createAuthInstance`, which threads it to every hook that needs it.
 *
 * Promise-shaped because every caller is a plain `async` callback inside the
 * auth library's own lifecycle. Each method keeps the failure contract the
 * hook relied on when it ran the use-case itself: the reads and records
 * resolve (`undefined` when unreadable), the role write REJECTS (a demotion
 * that left no admin and could not be put back must fail the request), and the
 * auth-event dispatch never rejects.
 */

import type { App } from '@/domain/models/app'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

/** The auth lifecycle events an `auth` automation trigger subscribes to. */
export type AuthTriggerEvent =
  'signUp' | 'signIn' | 'signOut' | 'passwordReset' | 'emailVerified' | 'invitationAccepted'

/** A role change that stood, as the `after` hook hands it to the audit trail. */
export type RoleChangeRecord = {
  readonly actorId: string
  readonly userId: string
  readonly previousRole: string | null
  readonly role: string
}

/** The start or stop of an impersonation, attributed to the admin. */
export type ImpersonationRecord = {
  readonly phase: 'started' | 'stopped'
  readonly adminId: string
  readonly userId: string
}

/** A ban that stood, as the `after` hook hands it to the audit trail. */
export type BanRecord = {
  readonly adminId: string
  readonly userId: string
  /** ISO timestamp the ban ends, or `null` for a ban without an end. */
  readonly expiresAt: string | null
}

/** A lifted ban or an admin-set password, attributed to the admin. */
export type AccountActRecord = {
  readonly adminId: string
  readonly userId: string
}

/** One auth event, as the hooks that observed it hand it to the app's automations. */
export interface AuthEventDispatch {
  readonly app: App
  readonly event: AuthTriggerEvent
  readonly user: Readonly<Record<string, unknown>>
  readonly userId?: string
  readonly data?: Readonly<Record<string, unknown>>
}

export interface AuthHookPolicies {
  /** How many non-banned accounts hold an admin-capable role; `undefined` when unreadable. */
  readonly countActiveAdmins: (adminRoles: readonly string[]) => Promise<number | undefined>
  /** The role an account holds now; `undefined` when unreadable or absent. */
  readonly readUserRole: (userId: string) => Promise<string | undefined>
  /** Write a role onto an account. REJECTS when it cannot. */
  readonly writeUserRole: (userId: string, role: string) => Promise<void>
  readonly recordRoleChange: (input: RoleChangeRecord) => Promise<void>
  readonly recordImpersonation: (input: ImpersonationRecord) => Promise<void>
  /** Whether the account is banned now; `undefined` when unreadable. */
  readonly isUserBanned: (userId: string) => Promise<boolean | undefined>
  readonly recordBan: (input: BanRecord) => Promise<void>
  readonly recordUnban: (input: AccountActRecord) => Promise<void>
  readonly recordPasswordSet: (input: AccountActRecord) => Promise<void>
  /** The last-admin rail's message when removing `userId` would leave no admin, `undefined` otherwise. */
  readonly refuseAccountRemoval: (
    userId: string,
    app: AdminRoleResolvable
  ) => Promise<string | undefined>
  readonly recordAccountDeletionRequest: (userId: string) => Promise<void>
  /** Start the app's `auth` automations for an event. Never rejects. */
  readonly dispatchAuthEvent: (input: AuthEventDispatch) => Promise<void>
}
