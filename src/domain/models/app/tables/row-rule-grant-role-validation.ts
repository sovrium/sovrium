/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A row rule naming a grant role the app does not declare is refused before
 * the app starts.
 *
 * `$currentUser.assignments.<table>.<role>` keeps the records granted under one
 * role, and a grant can only be made under a role `auth.roles` declares. A rule
 * naming any other role could never match a record — a typo that silently
 * hides every row — so `sovrium validate` and the boot refuse it, naming the
 * table, the role and the roles that are declared.
 */

import { assignmentScopeKeysOfRule, parseAssignmentScopeKey } from './row-level-evaluator-service'
import type { RowLevelWhen } from './row-level-permissions'

type RuleOperation = 'read' | 'write' | 'create' | 'delete'

const OPERATIONS: readonly RuleOperation[] = ['read', 'write', 'create', 'delete']

interface GrantRoleCheckedApp {
  readonly auth?: { readonly roles?: ReadonlyArray<{ readonly name: string }> } | undefined
  readonly tables?:
    | ReadonlyArray<{
        readonly name: string
        readonly rowLevelPermissions?: Readonly<
          Partial<Record<RuleOperation, { readonly when: RowLevelWhen } | undefined>>
        >
      }>
    | undefined
}

/** The grant roles a table's row rules name, each once. */
const grantRolesOf = (
  table: NonNullable<GrantRoleCheckedApp['tables']>[number]
): readonly string[] => [
  ...new Set(
    OPERATIONS.flatMap((operation) =>
      assignmentScopeKeysOfRule(table.rowLevelPermissions?.[operation]?.when)
    )
      .map((key) => parseAssignmentScopeKey(key).role)
      .filter((role): role is string => role !== undefined)
  ),
]

/** The first row rule of the app naming an undeclared grant role, or `undefined`. */
export const validateRowRuleGrantRoles = (app: GrantRoleCheckedApp): string | undefined => {
  const declared = (app.auth?.roles ?? []).map((role) => role.name)
  const label = declared.length === 0 ? 'none' : declared.join(', ')
  return (app.tables ?? [])
    .flatMap((table) =>
      grantRolesOf(table)
        .filter((role) => !declared.includes(role))
        .map(
          (role) =>
            `Table "${table.name}": row rule names the grant role "${role}", which auth.roles does not declare (declared: ${label}) — a grant is only ever made under a declared role`
        )
    )
    .find((message) => message !== undefined)
}
