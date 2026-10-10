/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SESSION half of a component's `visibility`: whether a node is on the
 * page for a given caller, judged from who the caller is and nothing else.
 *
 * Four gates, every one a pure function of `(session, app)`:
 *
 *   - `when` — `authenticated` / `unauthenticated`, i.e. whether there is a session;
 *   - `roles` — the session role, an overlay role, a `group:<name>` membership,
 *     or an admin-equivalent role when the list names `admin`;
 *   - `condition` — a `$user.*` field compared with `eq` / `neq`;
 *   - `capability` — a power the caller's role holds (`admin-console`, the
 *     `admin-editor` tier for `edit-operations`, an admin-equivalent role for
 *     `administer-accounts`). An anonymous caller holds none.
 *
 * The renderer prunes a page with these (`render/resolve/visibility-filter.ts`)
 * and a page press judges a button with them
 * (`page-automation-binding-service.ts`), so the page a caller is shown and the
 * buttons that caller may press are decided by one rule. The other halves of
 * `visibility` — `record`, `query`, `declares`, `runtime` — read a bound row, the
 * URL or the deployment, none of which is the caller, and are not judged here.
 *
 * A declaration is read off `props.visibility` FIRST, then the component root:
 * the schema spreads `visibilityFields` at the root while the long-standing
 * runtime convention nested it under `props`, and reading only one made a gate
 * written in the other position silently inert.
 */

import { splitGroupReferences } from '@/domain/models/app/auth/groups/group-reference'
import { canEditOperations, isAdminEquivalent, isAdminTier } from '@/domain/models/app/auth/roles'
import { CALLER_CAPABILITIES } from '@/domain/models/app/pages/components/visibility'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * A `$user.*` comparison, as authored. The comparison keeps the type: the
 * string `'true'` never equals the boolean `true`.
 */
interface VisibilityCondition {
  readonly field: string
  readonly operator: 'eq' | 'neq'
  readonly value: string | boolean
}

/** The session gates of a `visibility` block, duck-typed off the authored node. */
export interface SessionVisibility {
  readonly when?: 'authenticated' | 'unauthenticated'
  readonly roles?: readonly string[]
  readonly condition?: VisibilityCondition
  readonly capability?: CallerCapability
}

/**
 * The `visibility` block a node declares — `props.visibility` first, then the
 * root — or `undefined`. Typed as `T` so the renderer can read its other halves
 * off the same object.
 */
export function visibilityOf<T extends object = SessionVisibility>(node: unknown): T | undefined {
  if (typeof node !== 'object' || node === null) return undefined
  const obj = node as { readonly props?: Record<string, unknown>; readonly visibility?: unknown }
  const fromProps = obj.props?.visibility
  if (typeof fromProps === 'object' && fromProps !== null) return fromProps as T
  if (typeof obj.visibility === 'object' && obj.visibility !== null) return obj.visibility as T
  return undefined
}

/** True when a `$user.*` comparison holds for the session; any other field resolves to nothing. */
function conditionHolds(condition: VisibilityCondition, session: SessionInfo | undefined): boolean {
  const { field, operator, value } = condition
  const fieldValue =
    field.startsWith('$user.') && session !== undefined
      ? Object.entries(session).find(([key]) => key === field.slice('$user.'.length))?.[1]
      : undefined
  if (operator === 'eq') return fieldValue === value
  if (operator === 'neq') return fieldValue !== value
  return false
}

/** True when the session role, an overlay role, or the admin bypass matches `roles`. */
function holdsListedRole(roles: readonly string[], session: SessionInfo, app: App): boolean {
  if (roles.includes(session.role)) return true
  if ((session.effectiveRoles ?? []).some((role) => roles.includes(role))) return true
  return roles.includes('admin') && isAdminEquivalent(session.role, app)
}

/**
 * True when the session satisfies a `roles` list. Unlike page `access`, an
 * admin-equivalent session passes only a list that NAMES `admin`: a block gated
 * `roles: [auditor]` is for auditors.
 */
function rolesAdmit(
  roles: readonly string[] | undefined,
  session: SessionInfo | undefined,
  app: App
): boolean {
  if (!roles || roles.length === 0) return true
  if (session === undefined) return false
  const split = splitGroupReferences(roles)
  if (holdsListedRole(split.roles, session, app)) return true
  const userGroups = session.groups ?? []
  return split.groups.some((group) => userGroups.includes(group))
}

/**
 * True when the `condition` / `when` / `roles` gates of `visibility` admit the
 * session — the renderer's visibility pass.
 */
export function sessionGatesAdmit(
  visibility: SessionVisibility,
  session: SessionInfo | undefined,
  app: App
): boolean {
  if (visibility.condition !== undefined && !conditionHolds(visibility.condition, session)) {
    return false
  }
  if (visibility.when === 'authenticated' && session === undefined) return false
  if (visibility.when === 'unauthenticated' && session !== undefined) return false
  return rolesAdmit(visibility.roles, session, app)
}

/**
 * True when a caller whose powers are DERIVED from the session holds
 * `capability`. An anonymous caller holds nothing.
 */
export function sessionHoldsCapability(
  capability: CallerCapability,
  session: SessionInfo | undefined,
  app: App
): boolean {
  if (session === undefined) return false
  if (capability === 'admin-console') return isAdminTier(session.role, app)
  if (capability === 'edit-operations') return canEditOperations(session.role, app)
  return isAdminEquivalent(session.role, app)
}

/**
 * Every capability of the closed set the session holds — the powers a route
 * that has ALREADY resolved the caller hands a session-less render (a mounted
 * console page). Derived through {@link sessionHoldsCapability}, so the stated
 * set and the derived answer can never disagree.
 */
export const grantedCallerCapabilities = (
  session: SessionInfo | undefined,
  app: App
): readonly CallerCapability[] =>
  CALLER_CAPABILITIES.filter((capability) => sessionHoldsCapability(capability, session, app))

/**
 * True when every session gate of `node` — `capability`, `condition`, `when`,
 * `roles` — admits the caller. A node declaring no `visibility` is shown.
 */
export function isShownToSession(
  node: unknown,
  session: SessionInfo | undefined,
  app: App
): boolean {
  const visibility = visibilityOf(node)
  if (visibility === undefined) return true
  const { capability } = visibility
  if (capability !== undefined && !sessionHoldsCapability(capability, session, app)) return false
  return sessionGatesAdmit(visibility, session, app)
}
