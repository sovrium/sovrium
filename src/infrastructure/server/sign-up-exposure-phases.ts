/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The open sign-up boot warning: what a stranger reaches by registering —
 * each table and each bucket the role new accounts receive is admitted to.
 */

import {
  classifyPermissionRung,
  matchesRoleList,
  toPermissionValue,
} from '@/domain/models/app/auth/permission-evaluation'
import {
  hasCreatePermission,
  hasDeletePermission,
  hasReadPermission,
  hasUpdatePermission,
  resolveInheritedPermissions,
} from '@/domain/models/app/auth/permission-evaluator-service'
import type { App, Table } from '@/domain/models/app'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

const SIGN_UP_EXPOSURE_CHECKS = [
  ['read', hasReadPermission],
  ['create', hasCreatePermission],
  ['update', hasUpdatePermission],
  ['delete', hasDeletePermission],
] as const

type TableOperation = (typeof SIGN_UP_EXPOSURE_CHECKS)[number][0]

/**
 * An operation the table already grants to anonymous visitors (`'all'`),
 * read through `inherit` the way the evaluator reads it. A chain that does not
 * resolve falls back to the table's own declaration, so a broken `inherit`
 * can only add a line, never hide one.
 */
const isOpenToEveryone = (
  table: Table,
  operation: TableOperation,
  allTables: readonly Table[]
): boolean => {
  const permissions = resolveInheritedPermissions(table, allTables) ?? table.permissions
  return classifyPermissionRung(toPermissionValue(permissions?.[operation])) === 'everyone'
}

/**
 * Whether a new account (holding `role`) reaches one bucket file action. An
 * undeclared action falls back to "any signed-in caller" on the bucket routes,
 * so it is reached; `'all'` is open to everyone already, so sign-up adds
 * nothing and it is not counted.
 */
const bucketActionReached = (permission: unknown, role: string): boolean => {
  const value = toPermissionValue(permission)
  const rung = classifyPermissionRung(value)
  if (rung === 'everyone') return false
  if (rung === 'roles') return matchesRoleList(value as readonly string[], { role })
  return true
}

/**
 * Each declared bucket a new account reaches, with the operations it reaches:
 * `upload`, and `download` on a private bucket (a public bucket's reads are open
 * to everyone, account or not). Delete is not listed: an undeclared delete
 * reaches only the caller's own files.
 */
const bucketsReachedBySignUp = (app: Readonly<App>, role: string): readonly string[] =>
  (app.buckets ?? []).flatMap((bucket) => {
    const operations = [
      ...(bucketActionReached(bucket.permissions?.upload, role) ? ['upload'] : []),
      ...(!bucket.public && bucketActionReached(bucket.permissions?.download, role)
        ? ['download']
        : []),
    ]
    return operations.length === 0 ? [] : [`${bucket.name} (${operations.join(', ')})`]
  })

/**
 * Warn when open sign-up hands every new account access to tables or buckets.
 *
 * A self-registered account receives `auth.defaultRole` (`member` unless set),
 * so any table whose permissions admit `authenticated`, that role by name, or
 * leave an operation undeclared (open by default) is reachable by anyone who
 * fills in the sign-up form. That can be the intended design of a community
 * app, so it is a warning and never a refusal — but it is said at every boot,
 * naming the role, each reachable table and its operations, evaluated by the
 * SHARED permission evaluator the records API uses.
 *
 * Silent when the app has no auth, when `allowSignUp` is `false`, and for any
 * operation already open to anonymous visitors (`'all'`, declared or
 * inherited): sign-up changes nothing there.
 */
export const collectSignUpExposurePhases = (app: Readonly<App>): readonly StartupPhase[] => {
  if (!app.auth || app.auth.allowSignUp === false) return []
  const role = app.auth.defaultRole ?? 'member'
  const tables = app.tables ?? []
  const reachable = tables.flatMap((table) => {
    const operations = SIGN_UP_EXPOSURE_CHECKS.filter(
      ([operation, admits]) =>
        !isOpenToEveryone(table, operation, tables) && admits(table, role, tables)
    ).map(([operation]) => operation)
    return operations.length === 0 ? [] : [`${table.name} (${operations.join(', ')})`]
  })
  const buckets = bucketsReachedBySignUp(app, role)
  if (reachable.length === 0 && buckets.length === 0) return []
  return [
    {
      label:
        `Open sign-up — anyone can create an account as '${role}' and reach ${[...reachable, ...buckets].join(', ')}. ` +
        'Set auth.allowSignUp: false, or restrict those permissions to roles new accounts do not receive',
      type: 'warning' as const,
    },
  ]
}
