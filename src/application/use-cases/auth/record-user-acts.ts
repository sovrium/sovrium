/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin audit-trail entries for privileged acts on an account: a change of
 * role or of groups, the start and stop of an impersonation, a ban and a lifted ban, and a
 * password set by an admin — and a person's own request to delete their account.
 *
 * Every door that performs one of these acts calls in here once the act has
 * STOOD — a refused, unchanged or undone write records nothing — so the trail
 * says what happened, never what was attempted. The entries go through the
 * single audit funnel (`emitAuditEvent`) into `audit_log`, the retained admin
 * trail, rather than the per-record activity feed.
 *
 * The account acted upon is named by its opaque id alone: no `resource.name`,
 * no email address, no name. The entry is the record of an admin's act, so it
 * stays when that account is erased, and what it then holds of them is an id
 * that resolves to no one.
 */

import { Effect } from 'effect'
import { EmitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { logError } from '@/infrastructure/logging/logger'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { EmitAuditInput } from '@/application/use-cases/admin/audit-log/emit'
import type { Actor } from '@/domain/models/api/admin/envelope/actor'

/**
 * Who performed a privileged act on an account: a signed-in person, or an
 * automation by name.
 */
export type UserActAuthor =
  | { readonly kind: 'user'; readonly userId: string }
  | { readonly kind: 'automation'; readonly automation: string }

/**
 * The audit actor for a person. An unreadable actor still yields an entry —
 * attributed by id with the lowest human tier — because an act that stood with
 * its author's id is worth more on the trail than no entry at all.
 */
const personActor = (userId: string): Effect.Effect<Actor, never, AuthRepository> =>
  resolveActor(userId).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[audit-log] could not resolve the actor of a privileged act', cause)
      })
    ),
    // effect-swallow: logged above; the entry is still written, attributed by id, with the lowest human tier rather than a tier nobody could read.
    Effect.orElseSucceed((): Actor => ({ id: userId, type: 'user', role: 'operator' }))
  )

/**
 * The audit actor for an act on an account. An automation is `{ id: null }`:
 * `audit_log.actor_id` references `auth.user`, so it can only ever hold an
 * account id, and the automation's name travels in the metadata instead.
 */
const authorActor = (author: UserActAuthor): Effect.Effect<Actor, never, AuthRepository> =>
  author.kind === 'user'
    ? personActor(author.userId)
    : Effect.succeed<Actor>({ id: null, type: 'automation', role: 'system' })

/**
 * Write one entry. The store's write is total — a failed write is logged and
 * absorbed there — because the act it records has already happened, and
 * failing the request now would tell the caller it had not.
 */
const emit = (input: EmitAuditInput): Effect.Effect<void, never, AuditLogRepository> =>
  EmitAuditEvent(input)

/**
 * Write the entry for an act on an account. Every act this module records is
 * the same kind of entry — the account by its id, a `warning`, a `success`
 * over the API — and differs only in its action, its actor and its metadata.
 */
const emitUserAct = (
  action: EmitAuditInput['action'],
  actor: Actor,
  userId: string,
  metadata?: Readonly<Record<string, unknown>>
): Effect.Effect<void, never, AuditLogRepository> =>
  emit({
    action,
    actor,
    resourceId: userId,
    severity: 'warning',
    result: 'success',
    transport: 'api',
    ...(metadata === undefined ? {} : { metadata }),
  })

/** The automation's name, for the metadata of an entry an automation made. */
const automationMetadata = (author: UserActAuthor): Readonly<Record<string, unknown>> =>
  author.kind === 'automation' ? { automation: author.automation } : {}

/**
 * Record a change of role that stood: `user.role.changed`, with the role the
 * account had and the one it has now.
 */
export const recordRoleChange = (input: {
  readonly author: UserActAuthor
  readonly userId: string
  readonly previousRole: string | null
  readonly role: string
}): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* authorActor(input.author)
    yield* emitUserAct(AUDIT_ACTIONS.USER_ROLE_CHANGED, actor, input.userId, {
      previousRole: input.previousRole,
      role: input.role,
      ...automationMetadata(input.author),
    })
  }).pipe(Effect.withSpan('auth.record-role-change'))

/**
 * Record the start or the stop of an impersonation. The actor is the
 * impersonating admin in both — never the account being acted as.
 */
export const recordImpersonation = (input: {
  readonly phase: 'started' | 'stopped'
  readonly adminId: string
  readonly userId: string
}): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* personActor(input.adminId)
    yield* emitUserAct(
      input.phase === 'started'
        ? AUDIT_ACTIONS.USER_IMPERSONATION_STARTED
        : AUDIT_ACTIONS.USER_IMPERSONATION_STOPPED,
      actor,
      input.userId
    )
  }).pipe(Effect.withSpan('auth.record-impersonation'))

/**
 * Record a ban that stood: `user.banned`, with when it ends (`null` for a ban
 * without an end).
 *
 * The ban REASON is never written: it is free text an admin wrote about the
 * person, it stays on the account row, and the account row is what an erasure
 * deletes. The entry outlives that erasure, so it must not carry it.
 */
export const recordBan = (input: {
  readonly author: UserActAuthor
  readonly userId: string
  readonly expiresAt: string | null
}): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* authorActor(input.author)
    yield* emitUserAct(AUDIT_ACTIONS.USER_BANNED, actor, input.userId, {
      expiresAt: input.expiresAt,
      ...automationMetadata(input.author),
    })
  }).pipe(Effect.withSpan('auth.record-ban'))

/**
 * Record a lifted ban: `user.unbanned`. The caller records only a ban that was
 * really lifted — clearing the ban of an account that was not banned changes
 * nothing, and records nothing.
 */
export const recordUnban = (input: {
  readonly author: UserActAuthor
  readonly userId: string
}): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* authorActor(input.author)
    yield* emitUserAct(
      AUDIT_ACTIONS.USER_UNBANNED,
      actor,
      input.userId,
      input.author.kind === 'automation' ? automationMetadata(input.author) : undefined
    )
  }).pipe(Effect.withSpan('auth.record-unban'))

/**
 * Record a change of the groups an account belongs to: `user.groups.changed`,
 * with the group NAMES it joined and left, each sorted. The caller records only
 * a change that moved something — a write that changed nothing records nothing.
 */
export const recordGroupsChange = (input: {
  readonly author: UserActAuthor
  readonly userId: string
  readonly added: readonly string[]
  readonly removed: readonly string[]
}): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* authorActor(input.author)
    yield* emitUserAct(AUDIT_ACTIONS.USER_GROUPS_CHANGED, actor, input.userId, {
      added: input.added,
      removed: input.removed,
      ...automationMetadata(input.author),
    })
  }).pipe(Effect.withSpan('auth.record-groups-change'))

/**
 * Record a password an admin set on an account: `user.password.set`. Nothing
 * derived from the password is written — not its length, not a hash.
 */
export const recordPasswordSet = (input: {
  readonly adminId: string
  readonly userId: string
}): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* personActor(input.adminId)
    yield* emitUserAct(AUDIT_ACTIONS.USER_PASSWORD_SET, actor, input.userId)
  }).pipe(Effect.withSpan('auth.record-password-set'))

/**
 * Record a person's own request to delete their account at once:
 * `account.deletion.requested`, the counterpart of `account.deletion.scheduled`
 * on the scheduled door. The account is both actor and subject, and the entry
 * is `info` — the erasure itself is recorded when the mailed link is followed.
 * Only a request that stood (the link was mailed) is recorded.
 */
export const recordAccountDeletionRequest = (
  userId: string
): Effect.Effect<void, never, AuthRepository | AuditLogRepository> =>
  Effect.gen(function* () {
    const actor = yield* personActor(userId)
    yield* emit({
      action: AUDIT_ACTIONS.ACCOUNT_DELETION_REQUESTED,
      actor,
      resourceId: userId,
      severity: 'info',
      result: 'success',
      transport: 'api',
    })
  }).pipe(Effect.withSpan('auth.record-account-deletion-request'))
