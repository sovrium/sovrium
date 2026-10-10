/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure decisions behind every change of an account's groups.
 *
 * Three doors change a membership — the console's set-the-whole-list route and
 * the `auth/addToGroup` / `auth/removeFromGroup` automation operators — and all
 * three ask the same two questions of the same config: is every named group
 * declared, and what does the change add and remove against what the account
 * already holds. Answering them here, once, is what keeps the three doors from
 * disagreeing about a typo or about what counts as "nothing changed".
 */

/** The slice of the app config a membership decision reads. */
export interface GroupMembershipConfig {
  readonly auth?:
    | {
        readonly groups?:
          | ReadonlyArray<{
              readonly name: string
              readonly description?: string | undefined
              readonly maxMembers?: number | undefined
            }>
          | undefined
      }
    | undefined
}

/** A change of one account's membership, by group name. */
export type GroupMembershipPlan =
  | { readonly mode: 'set'; readonly groups: readonly string[] }
  | { readonly mode: 'add'; readonly group: string }
  | { readonly mode: 'remove'; readonly group: string }

/** What a plan does against a held membership, each list sorted and unique. */
export interface GroupMembershipDiff {
  /** The membership after the change. */
  readonly groups: readonly string[]
  readonly added: readonly string[]
  readonly removed: readonly string[]
}

/** Unique and sorted, the order every membership list is answered in. */
const sortedUnique = (names: Iterable<string>): readonly string[] =>
  [...new Set(names)].toSorted((a, b) => a.localeCompare(b))

/** The groups the config declares, by name. */
export const declaredGroupNames = (app: GroupMembershipConfig): ReadonlySet<string> =>
  new Set((app.auth?.groups ?? []).map((group) => group.name))

/** The groups a plan names — every one of them must be declared. */
export const groupsNamedBy = (plan: GroupMembershipPlan): readonly string[] =>
  plan.mode === 'set' ? plan.groups : [plan.group]

/** The first group a plan names that the config does not declare, if any. */
export const firstUndeclaredGroup = (
  app: GroupMembershipConfig,
  plan: GroupMembershipPlan
): string | undefined => {
  const declared = declaredGroupNames(app)
  return groupsNamedBy(plan).find((name) => !declared.has(name))
}

/** The `maxMembers` a declared group sets, or `undefined` when it sets none. */
export const groupMemberCap = (app: GroupMembershipConfig, group: string): number | undefined =>
  app.auth?.groups?.find((candidate) => candidate.name === group)?.maxMembers

/**
 * What a plan adds and removes against the groups the account holds now.
 *
 * Adding a group already held, or removing one not held, contributes nothing —
 * which is what makes every door idempotent and what lets a write that changed
 * nothing record nothing.
 */
export const planMembershipDiff = (
  held: readonly string[],
  plan: GroupMembershipPlan
): GroupMembershipDiff => {
  const current = new Set(held)
  const desired =
    plan.mode === 'set'
      ? new Set(plan.groups)
      : plan.mode === 'add'
        ? new Set([...current, plan.group])
        : new Set([...current].filter((name) => name !== plan.group))
  return {
    groups: sortedUnique(desired),
    added: sortedUnique([...desired].filter((name) => !current.has(name))),
    removed: sortedUnique([...current].filter((name) => !desired.has(name))),
  }
}
