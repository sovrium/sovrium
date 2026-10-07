/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who may run a manual-trigger automation.
 *
 * ONE decision, read by every surface that either offers or runs a manual
 * automation: the run itself (`runManualAutomation`, behind the HTTP button
 * route and the MCP `tools/call`) and the MCP `tools/list`, which offers a
 * role exactly the automations that role may run. Two copies of the rule
 * drifted once — the list withheld every automation from a viewer while the
 * call ran the one that named `viewer`, and offered a member automations the
 * call then refused — so the rule lives here and nowhere else.
 */

import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
} from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'

type Automation = NonNullable<App['automations']>[number]

/**
 * Map a connection's raw shape to its effective scope.
 *
 *  - apiKey/basic/bearer → always 'app' (no per-user variant exists in
 *    the schema for these types)
 *  - oauth2 with `props.scope === 'user'` → 'user'
 *  - oauth2 default (props.scope undefined or 'app') → 'app'
 */
const connectionScope = (conn: Readonly<Record<string, unknown>>): 'user' | 'app' => {
  if (conn['type'] !== 'oauth2') return 'app'
  const props = conn['props'] as Record<string, unknown> | undefined
  return props !== undefined && props['scope'] === 'user' ? 'user' : 'app'
}

/**
 * Extract the connection name an action references, if any. Returns
 * `undefined` for non-connection-bound actions (state, log, etc.) — these
 * don't constrain the role gate either way.
 */
const referencedConnectionName = (
  action: Readonly<Record<string, unknown>>
): string | undefined => {
  const { props } = action as { props?: Record<string, unknown> }
  if (props === undefined) return undefined
  const connName = props['connection']
  return typeof connName === 'string' && connName !== '' ? connName : undefined
}

/**
 * Detect whether ALL of an automation's connection-bound actions reference a
 * `scope: 'user'` connection. When true, the manual trigger's default
 * `requiredRole` is relaxed from `'admin'` to `'member'` — per-user-token
 * automations are intended to be invoked by individual users using their
 * own tokens, so an admin-only gate would defeat the per-user model.
 * Triggers that declare `requiredRole` explicitly retain that value (this
 * only changes the implicit default).
 *
 * MIXED-SCOPE SAFETY: If ANY connection-bound action references
 * a `scope: 'app'` connection (or a non-oauth2 connection, which is
 * implicitly app-scoped), the predicate returns false so the implicit
 * default stays at `'admin'`. Otherwise a non-admin caller could invoke a
 * flow that touches an admin-managed app-scoped resource by piggy-backing
 * on a user-scoped sibling action.
 *
 * Actions without a `connection` prop (state, record, log, etc.) are
 * ignored — they neither relax nor tighten the gate.
 *
 * Specs the automation connection specs trigger automations
 * with `scope: 'user'` connections as a regular `createAuthenticatedUser`
 * (member) and assert the run executes (or fails on the action's
 * no-token branch) rather than 403'ing at the trigger gate.
 */
export const usesUserScopedConnection = (automation: Automation, app: App): boolean => {
  const { connections } = app as { connections?: readonly Record<string, unknown>[] }
  if (connections === undefined || connections.length === 0) return false

  // Index connections by name. apiKey/basic/bearer are always app-scoped
  // (no per-user variant exists in the schema); oauth2 defaults to 'app'
  // unless props.scope === 'user'.
  const scopeByName = new Map<string, 'user' | 'app'>(
    connections
      .filter((conn) => String(conn['name'] ?? '') !== '')
      .map((conn) => [String(conn['name']), connectionScope(conn)] as const)
  )

  // Filter the action list to just the connection-bound actions, then
  // classify each. An unknown connection name (typo, deleted from
  // app.connections) is treated as 'app' — fail-closed so a stale
  // reference cannot silently relax the gate. Cast each action to the
  // record-shape `referencedConnectionName` reads — Effect Schema's
  // discriminated-union `Action` type doesn't satisfy the open
  // `Record<string, unknown>` index, but structurally each member has
  // a `props` field we can read.
  const connectionRefs = (
    automation.actions as readonly unknown[] as readonly Readonly<Record<string, unknown>>[]
  )
    .map(referencedConnectionName)
    .filter((name): name is string => name !== undefined)
    .map((name) => scopeByName.get(name) ?? 'app')

  // Mixed scope: any 'app' reference forces the gate to stay at 'admin'.
  if (connectionRefs.some((scope) => scope === 'app')) return false
  return connectionRefs.some((scope) => scope === 'user')
}
/**
 * The role a manual trigger requires. An explicit `requiredRole` always wins.
 * Omitted, it defaults to `'admin'` — relaxed to `'member'` when every
 * connection-bound action uses a `scope: 'user'` connection
 * ({@link usesUserScopedConnection}), since per-user-token automations are
 * meant to be run by individual users with their own tokens.
 */
export const requiredManualTriggerRole = (automation: Automation, app: App): string => {
  const explicitRole =
    automation.trigger.type === 'manual' ? automation.trigger.requiredRole : undefined
  return explicitRole ?? (usesUserScopedConnection(automation, app) ? 'member' : 'admin')
}

/**
 * Whether a caller holding `userRole` may run the automation: the role the
 * trigger requires, exactly, or an admin-equivalent role — the built-in
 * `admin` or the app's top role — which satisfies any requirement.
 * An absent role (an anonymous caller) satisfies nothing.
 */
export const mayRunManualAutomation = (
  automation: Automation,
  app: App,
  userRole: string | undefined
): boolean => {
  if (userRole === undefined) return false
  return userRole === requiredManualTriggerRole(automation, app) || isAdminEquivalent(userRole, app)
}

/**
 * Whether a declared `permissions.trigger` lets a caller holding `userRole`
 * start the automation by name. Undeclared, it admits; an admin-equivalent
 * caller satisfies any role list. It only ever NARROWS: a caller it admits
 * still has to pass {@link mayRunManualAutomation}.
 */
export const triggerPermissionAdmits = (
  automation: Automation,
  app: App,
  userRole: string | undefined
): boolean =>
  userRole !== undefined &&
  permits(
    evaluatePermission(
      automation.permissions?.trigger,
      { role: userRole, adminEquivalent: isAdminEquivalent(userRole, app) },
      { whenUndeclared: OPEN_WHEN_UNDECLARED, adminOverride: 'admin-outranks-role-list' }
    )
  )

/**
 * Whether a caller may start a manual automation BY NAME — the direct trigger
 * route, the MCP tool, the AI chat — and therefore whether the automation
 * listing shows it to her. Both gates, in order: the declared
 * `permissions.trigger`, then the manual trigger's own role rule.
 */
export const mayStartAutomationByName = (
  automation: Automation,
  app: App,
  userRole: string | undefined
): boolean =>
  automation.trigger.type === 'manual' &&
  triggerPermissionAdmits(automation, app, userRole) &&
  mayRunManualAutomation(automation, app, userRole)
