/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rule of an app with no `auth` block: nobody can sign in, so a visitor
 * holds exactly the table operations a table opens to everyone ({@link
 * anonymousGrant}). The table evaluators (`permission-evaluator-service`) answer
 * the no-auth visitor through it, and every render or use-case gate that serves
 * such a visitor asks it directly.
 */

import { GUEST_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  classifyPermissionRung,
  toPermissionValue,
} from '@/domain/models/app/auth/permission-evaluation'
import {
  getEffectivePermissions,
  inheritanceFailed,
  type TableGateScope,
} from '@/domain/models/app/auth/permission-inheritance-service'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'

/** The five table operations a grant can open. */
export type TableOperation = 'read' | 'create' | 'update' | 'delete' | 'comment'

/**
 * Does the scope say the app has sign-in?
 *
 * Only an APP scope can say so. A bare table list, or no scope at all, says
 * nothing about sign-in, and is read as an app without it (below).
 */
const scopeDeclaresAuth = (scope: TableGateScope | undefined): boolean =>
  scope !== undefined &&
  !Array.isArray(scope) &&
  (scope as AdminRoleResolvable & Readonly<{ auth?: unknown }>).auth !== undefined

/**
 * Is this caller the visitor of an app with no `auth` block?
 *
 * Such an app has no accounts, so every caller of its records API is the same
 * placeholder principal, whose role is the guest sentinel (`'guest'`, the
 * records API's guest context). In an app WITH `auth` the same string may be a
 * role the app declares for its own members, and a member signed in under it
 * is judged as any member: that is why the test needs the scope to say the app
 * has no sign-in, and never reads the role name alone. A scope that does not
 * name the app (a bare table list, or none) is read as an app without sign-in,
 * so an evaluator that cannot tell fails closed for the placeholder.
 */
export function isNoAuthVisitor(userRole: string, scope: TableGateScope | undefined): boolean {
  return userRole === GUEST_USER_ID && !scopeDeclaresAuth(scope)
}

/**
 * Does `app` judge its visitors by the no-auth rule ({@link anonymousGrant})?
 *
 * True for an app that declares no `auth` block — EXCEPT the operator console
 * mounted into another app. The console preset declares no `auth` either, but
 * it renders the host app's tables for a caller the host app's sign-in has
 * already admitted, and the mount narrows each table to what she may read
 * before the render sees it. A mounted app carries the base path it is served
 * at (`mountBasePath`, stamped by the mount; `MountedApp` in the CSS mount
 * identity), which no config can set, so the property is read here by name.
 */
export const servesNoAuthVisitor = (app: Readonly<{ auth?: unknown }>): boolean =>
  app.auth === undefined &&
  (app as Readonly<{ mountBasePath?: string }>).mountBasePath === undefined

/**
 * THE rule of an app with no `auth` block: may a visitor perform `operation`
 * on `table`?
 *
 * Nobody can sign in to such an app, so a visitor holds exactly the operations
 * a table opens to everyone: the table's RESOLVED grant (after `inherit` and
 * `override`) for that operation must be the literal `'all'`. An omitted
 * grant, `'authenticated'` and a list of roles admit nobody, and an
 * inheritance chain that does not resolve keeps the table shut.
 *
 * Pure: it reads the config alone and never needs an authentication instance,
 * so an app with no `auth` block keeps the authentication library unloaded.
 * The five evaluators below answer through it for the no-auth visitor
 * ({@link isNoAuthVisitor}), and every render or use-case gate that serves a
 * visitor of such an app asks it directly.
 */
export function anonymousGrant(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  operation: TableOperation,
  scope?: TableGateScope
): boolean {
  if (table === undefined) return false
  const effective = getEffectivePermissions(table, scope) as
    Readonly<Record<string, unknown>> | undefined
  if (
    inheritanceFailed(
      table as Readonly<{ permissions?: Readonly<{ inherit?: string }> }>,
      scope,
      effective
    )
  ) {
    return false
  }
  if (
    operation === 'delete' &&
    (table as Readonly<{ permissions?: { override?: { admin?: { delete?: unknown } } } }>)
      .permissions?.override?.admin?.delete !== undefined
  ) {
    return false
  }
  return classifyPermissionRung(toPermissionValue(effective?.[operation])) === 'everyone'
}
