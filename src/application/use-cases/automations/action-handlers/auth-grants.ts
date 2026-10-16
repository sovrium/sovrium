/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `auth/grantAccess`, `auth/revokeAccess` and `auth/listGrantees` — manage who
 * sees a record of a table listed in `auth.scopeTables`, from a workflow.
 *
 * They write through the store the access-grant routes write
 * (`UserAccessRepository`) and validate as those routes do: a table
 * `auth.scopeTables` does not list, or a role `auth.roles` does not declare —
 * reachable only through a template, a literal one is refused when the app is
 * validated — FAILS the step, so the run fails, a webhook caller hears 500 and
 * nothing is written.
 *
 * - `grantAccess` adds the record to the account's grant over that table under
 *   that role, creating the grant when there is none. Granting a record the
 *   account already holds under that role succeeds with `changed: false`.
 * - `revokeAccess` takes the record out of EVERY grant the account holds over
 *   that table; a grant left naming no record is erased, not kept empty.
 *   Revoking a record the account does not hold succeeds with `changed: false`.
 * - `listGrantees` outputs `{ grantees, count }`, one `{ id, email, name, role }`
 *   per grant naming the record — ready to feed a loop that reaches each one.
 *
 * A grant or revocation closes the account's live realtime connections, as the
 * routes' writes do: the store does it on every write, so no road can skip it.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { UserAccessRepository } from '@/application/ports/repositories/auth/user-access-repository'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { validateUserAccessInput } from '@/domain/models/app/tables/user-access-validation'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { OrganizationTeamRepository } from '@/application/ports/repositories/auth/organization-team-repository'
import type { ConfigInvitationIssuer } from '@/application/ports/services/invitation-issuer'
import type { App } from '@/domain/models/app'

/**
 * The services the `auth` group, grant and invitation operators reach, beyond
 * the account store.
 */
export type AuthStepRequirements =
  OrganizationTeamRepository | UserAccessRepository | ConfigInvitationIssuer

type GrantOperator = 'grantAccess' | 'revokeAccess' | 'listGrantees'

/** The (already template-substituted) props of a step, trimmed. */
const propsOf = (action: Readonly<Record<string, unknown>>) => {
  const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
  return {
    userId: stringProp(props, 'userId').trim(),
    table: stringProp(props, 'table').trim(),
    recordId: stringProp(props, 'recordId').trim(),
    role: props['role'] === undefined ? undefined : stringProp(props, 'role').trim(),
  }
}

/** The rule a grant breaks against the app's scope tables and roles, or `undefined`. */
const grantRefusal = (
  app: App,
  grant: { readonly table: string; readonly recordId: string; readonly role: string }
): string | undefined =>
  validateUserAccessInput(
    { user_id: 'checked', table_slug: grant.table, record_ids: [grant.recordId], role: grant.role },
    {
      scopeTables: app.auth?.scopeTables ?? [],
      roleNames: app.auth?.roles?.map((role) => role.name) ?? [],
    }
  )?.message

/** A table `auth.scopeTables` does not list — the one rule a revocation or a listing can break. */
const scopeTableRefusal = (app: App, table: string): string | undefined =>
  (app.auth?.scopeTables ?? []).includes(table)
    ? undefined
    : `table '${table}' is not declared in auth.scopeTables`

const failure = (operator: GrantOperator, reason: string): ActionOutcome => ({
  status: 'failure',
  error: `auth.${operator}: ${reason}`,
})

/**
 * A store that cannot be read or written fails the step with a readable reason,
 * the cause logged first, rather than crashing the run.
 */
const failingReadably =
  (operator: GrantOperator) =>
  <R>(program: Effect.Effect<ActionOutcome, unknown, R>): Effect.Effect<ActionOutcome, never, R> =>
    program.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError(`[automations] auth.${operator} could not read or write the grants`, cause)
        )
      ),
      // effect-swallow: logged above; the step fails with a reason the run history shows, and nothing is reported as written.
      Effect.orElseSucceed(() => failure(operator, 'the access grants could not be changed'))
    )

/**
 * Add `recordId` to the account's grant over `table` under `role`; whether
 * access moved. Atomic in the store: a burst of grants and revocations of the
 * same account over the same table (one run per record of a bulk change) is
 * applied one change after the other, so none is lost.
 */
const grantRecord = (input: {
  readonly userId: string
  readonly table: string
  readonly recordId: string
  readonly role: string
}) =>
  Effect.gen(function* () {
    const repo = yield* UserAccessRepository
    return yield* repo.grantRecord(
      {
        userId: input.userId,
        tableSlug: input.table,
        recordId: input.recordId,
        role: input.role,
      },
      // An automation grants with the system's authority, as its record writes do.
      SYSTEM_USER_ID
    )
  })

/**
 * Take `recordId` out of every grant the account holds over `table`; whether
 * access moved. Atomic in the store, as {@link grantRecord}: a concurrent grant
 * never brings the record back.
 */
const revokeRecord = (input: {
  readonly userId: string
  readonly table: string
  readonly recordId: string
}) =>
  Effect.gen(function* () {
    const repo = yield* UserAccessRepository
    return yield* repo.revokeRecord({
      userId: input.userId,
      tableSlug: input.table,
      recordId: input.recordId,
    })
  })

/** The accounts granted `recordId` of `table`, one entry per grant, with their contact. */
const granteesOf = (input: {
  readonly table: string
  readonly recordId: string
  readonly role: string | undefined
}) =>
  Effect.gen(function* () {
    const grants = yield* (yield* UserAccessRepository).list({
      tableSlug: input.table,
      recordId: input.recordId,
    })
    const held = grants.filter((row) => input.role === undefined || row.role === input.role)
    const contacts = yield* (yield* AuthRepository).findUserContactsByIds([
      ...new Set(held.map((row) => row.userId)),
    ])
    // A grant for an id no account holds reaches no one, and is left out.
    return held.flatMap((row) => {
      const contact = contacts.get(row.userId)
      return contact === undefined
        ? []
        : [{ id: row.userId, email: contact.email, name: contact.name, role: row.role }]
    })
  })

/** `auth/grantAccess` — give an account one record of a scope table under a role. */
export const handleAuthGrantAccess: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const { userId, table, recordId, role = '' } = propsOf(action)
    if (userId === '' || recordId === '') {
      return failure('grantAccess', 'requires a non-empty `userId` and `recordId`')
    }
    const refused = grantRefusal(app, { table, recordId, role })
    if (refused !== undefined) return failure('grantAccess', refused)
    return yield* grantRecord({ userId, table, recordId, role }).pipe(
      Effect.map((changed): ActionOutcome => ({
        status: 'success',
        output: { userId, table, recordId, role, changed },
      })),
      failingReadably('grantAccess')
    )
  }).pipe(
    Effect.withSpan('automations.handle-auth-grant-access', {
      attributes: actionAttributes(action),
    })
  )

/** `auth/revokeAccess` — take one record of a scope table away from an account. */
export const handleAuthRevokeAccess: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const { userId, table, recordId } = propsOf(action)
    if (userId === '' || recordId === '') {
      return failure('revokeAccess', 'requires a non-empty `userId` and `recordId`')
    }
    const refused = scopeTableRefusal(app, table)
    if (refused !== undefined) return failure('revokeAccess', refused)
    return yield* revokeRecord({ userId, table, recordId }).pipe(
      Effect.map((changed): ActionOutcome => ({
        status: 'success',
        output: { userId, table, recordId, changed },
      })),
      failingReadably('revokeAccess')
    )
  }).pipe(
    Effect.withSpan('automations.handle-auth-revoke-access', {
      attributes: actionAttributes(action),
    })
  )

/** `auth/listGrantees` — the accounts granted one record of a scope table. */
export const handleAuthListGrantees: ActionHandler = (action, app) =>
  Effect.gen(function* () {
    const { table, recordId, role } = propsOf(action)
    if (recordId === '') return failure('listGrantees', 'requires a non-empty `recordId`')
    const refused = scopeTableRefusal(app, table)
    if (refused !== undefined) return failure('listGrantees', refused)
    return yield* granteesOf({ table, recordId, role }).pipe(
      Effect.map((grantees): ActionOutcome => ({
        status: 'success',
        output: { grantees, count: grantees.length },
      })),
      failingReadably('listGrantees')
    )
  }).pipe(
    Effect.withSpan('automations.handle-auth-list-grantees', {
      attributes: actionAttributes(action),
    })
  )
