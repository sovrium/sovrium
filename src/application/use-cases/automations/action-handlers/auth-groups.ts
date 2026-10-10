/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `auth/addToGroup` and `auth/removeFromGroup` — put an account in, or take it
 * out of, a group declared in `auth.groups`, by the group's NAME.
 *
 * Both resolve their (already template-substituted) `userId` and `group`
 * props, confirm the account exists, and hand the change to
 * `changeUserGroups`, the program the console's account-groups route runs too.
 * Both are idempotent: adding a member or removing a non-member succeeds with
 * `changed: false` and records nothing. Their output is `{ userId, group,
 * changed }`.
 *
 * A step FAILS — so the run fails and a webhook caller hears 500 — when the
 * account does not exist, when the group is not declared (only reachable with
 * a templated name: a literal one is refused when the app is validated), and
 * when an add would take the group past its `maxMembers`. A refused step moves
 * no membership and creates no team.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import {
  changeUserGroups,
  describeMembershipRefusal,
  type GroupMembershipOutcome,
} from '@/application/use-cases/auth/group-membership'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/** Whether the account exists; an unreadable answer counts as "no such account". */
const accountExists = (userId: string): Effect.Effect<boolean, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.userExists(userId)
  }).pipe(
    // effect-swallow: "cannot tell" fails the step as "no user found" — the conservative direction, the one `auth/assignRole` takes: no membership moves for an account that could not be confirmed.
    Effect.orElseSucceed(() => false)
  )

/** The step outcome for a change that ran, or the refusal that stopped it. */
const changeOutcome = (
  label: string,
  userId: string,
  group: string,
  result: GroupMembershipOutcome
): ActionOutcome =>
  result._tag === 'Changed'
    ? {
        status: 'success',
        output: { userId, group, changed: result.added.length + result.removed.length > 0 },
      }
    : { status: 'failure', error: `${label}: ${describeMembershipRefusal(result)}` }

/** Move one existing account in or out of one group, attributed to the automation. */
const moveMembership = (input: {
  readonly label: string
  readonly mode: 'add' | 'remove'
  readonly userId: string
  readonly group: string
  readonly app: App
  readonly automation: AutomationContext
}) =>
  changeUserGroups({
    app: input.app,
    userId: input.userId,
    plan: { mode: input.mode, group: input.group },
    author: { kind: 'automation', automation: input.automation.name },
  }).pipe(
    Effect.map((result) => changeOutcome(input.label, input.userId, input.group, result)),
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError(`[automations] ${input.label} could not read or write the membership`, cause)
      )
    ),
    // effect-swallow: logged above; a store that cannot be read or written fails the step with a readable reason rather than crashing the run.
    Effect.orElseSucceed((): ActionOutcome => ({
      status: 'failure',
      error: `${input.label}: the group membership could not be changed`,
    }))
  )

/** Run one group operator, `mode` saying which way the membership moves. */
const handleGroupOperator =
  (mode: 'add' | 'remove', operator: 'addToGroup' | 'removeFromGroup'): ActionHandler =>
  (action, app, automation) =>
    Effect.gen(function* () {
      const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
      const userId = stringProp(props, 'userId').trim()
      const group = stringProp(props, 'group').trim()
      const label = `auth.${operator}`

      if (userId === '' || group === '') {
        return {
          status: 'failure',
          error: `${label} requires a non-empty \`userId\` and \`group\``,
        } as const satisfies ActionOutcome
      }
      if (!(yield* accountExists(userId))) {
        return {
          status: 'failure',
          error: `${label}: no user found with id '${userId}'`,
        } as const satisfies ActionOutcome
      }
      return yield* moveMembership({ label, mode, userId, group, app, automation })
    }).pipe(
      Effect.withSpan(`automations.handle-auth-${mode}-group`, {
        attributes: actionAttributes(action),
      })
    )

/** `auth/addToGroup` — add an existing account to a declared group. */
export const handleAuthAddToGroup: ActionHandler = handleGroupOperator('add', 'addToGroup')

/** `auth/removeFromGroup` — take an existing account out of a declared group. */
export const handleAuthRemoveFromGroup: ActionHandler = handleGroupOperator(
  'remove',
  'removeFromGroup'
)
