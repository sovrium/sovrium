/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The CRUD half of the page render gate: who may see a create form, and who
 * sees an update form they are allowed to submit.
 *
 * Extracted from `render-page.tsx` with its auth sibling
 * (`page-access-gating.tsx`). The two halves are separate files because they
 * answer separate questions from separate declarations — this one reads a
 * table's `permissions.create` / `permissions.update` ladder, the other reads
 * the app's `auth` block — and together they exceeded the tree's file ceiling.
 *
 * `hideComponent` lives here rather than next door because the write ladder is
 * its heaviest caller; the auth half imports it for the two strip passes.
 */

import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
  toPermissionValue,
  type PermissionCaller,
  type PermissionPolicy,
} from '@/domain/models/app/auth/permission-evaluation'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The policy the CRUD render gate evaluates the write ladder under.
 *
 * `OPEN_WHEN_UNDECLARED` — a table that declares no `create`/`update` grant
 * restricts nobody, which is what both gates already did (and what an anonymous
 * visitor sees on the bare-table create form pinned by [internal ref]).
 *
 * `admin-outranks-role-list` — the records API grants an admin the write
 * unconditionally (`hasCreatePermission`/`hasUpdatePermission` return early on
 * `isAdminRole`), so a gate WITHOUT the override hides a form from a caller the
 * API would serve — a dead end, not a security boundary.
 * The override deliberately stops at the role-list rung: it never manufactures
 * access an undeclared permission did not already grant.
 */
const CRUD_RENDER_GATE_POLICY: PermissionPolicy = {
  whenUndeclared: OPEN_WHEN_UNDECLARED,
  adminOverride: 'admin-outranks-role-list',
}

/**
 * Read one write grant off a table as a {@link PermissionValue}.
 *
 * An EMPTY role array is normalised to UNDECLARED so it keeps gating nobody —
 * the `.length === 0` escape both gates used to spell out inline. Evaluated as
 * a declared array it would match no caller and hide the form from everyone,
 * which no config author writing `create: []` can plausibly have meant.
 */
function declaredWriteGrant(
  table: Readonly<{ permissions?: Readonly<Record<string, unknown>> }> | undefined,
  operation: 'create' | 'update'
): PermissionValue | undefined {
  const value = toPermissionValue(table?.permissions?.[operation])
  return Array.isArray(value) && value.length === 0 ? undefined : value
}

/**
 * The acting caller for the render gate, or `undefined` for an anonymous
 * visitor — the state that decides `'authenticated'` and
 * that `hasCreatePermission(table, userRole: string)` cannot represent, which
 * is why the gate evaluates the ladder rather than calling the API's helper.
 *
 * `groups` is forwarded so a `group:<name>` entry in an allowlist is honoured
 * here exactly as `matchesRoleList` honours it on the write path.
 */
const gateCaller = (session: SessionInfo | undefined): PermissionCaller | undefined =>
  session === undefined ? undefined : { role: session.role, groups: session.groups }

/**
 * Checks if a caller is allowed to create records in a table.
 *
 * The declared value is the three-rung permission ladder
 * (`'all'` / `'authenticated'` / role array), NOT a role list: the two string
 * rungs are rungs, never role names, so no role comparison of any kind may be
 * performed against them.
 */
function isCrudCreateAllowed(
  tableName: string | undefined,
  tables: App['tables'],
  session: SessionInfo | undefined
): boolean {
  const table = tables?.find((t) => t.name === tableName)
  return permits(
    evaluatePermission(
      declaredWriteGrant(table, 'create'),
      gateCaller(session),
      CRUD_RENDER_GATE_POLICY
    )
  )
}

/**
 * Hides a component section by injecting `display: none` into its style prop.
 */
export function hideComponent(component: Component): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      style: {
        ...((component.props?.style as Record<string, unknown> | undefined) ?? {}),
        display: 'none',
      },
    },
  }
}

/**
 * Checks if a caller is allowed to update records in a table.
 *
 * Same ladder, same policy and same anonymous handling as
 * {@link isCrudCreateAllowed} — the two gates answer one question from one
 * declaration, so they must not drift apart.
 */
function isCrudUpdateAllowed(
  tableName: string | undefined,
  tables: App['tables'],
  session: SessionInfo | undefined
): boolean {
  const table = tables?.find((t) => t.name === tableName)
  return permits(
    evaluatePermission(
      declaredWriteGrant(table, 'update'),
      gateCaller(session),
      CRUD_RENDER_GATE_POLICY
    )
  )
}

/**
 * Applies CRUD create permission filtering to page components.
 *
 * For each component that has a `crud` create action, checks if the table has
 * restricted create permissions (`permissions.create`). If the current session
 * role is not in the allowed roles (or the user is unauthenticated), the component
 * is hidden via `display: none` style injection — matching the `applyVisibilityToSection`
 * pattern — so it is present in the DOM but not visible.
 */
export function applyCrudCreatePermissions(
  components: Page['components'],
  tables: App['tables'],
  session: SessionInfo | undefined
): Page['components'] {
  if (!components) return components

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item

    const component = item as Component
    const action = component.action as { type?: string; operation?: string; table?: string }

    if (action?.type !== 'crud' || action?.operation !== 'create') return component
    if (isCrudCreateAllowed(action.table, tables, session)) return component

    return hideComponent(component)
  })
}

/**
 * Marks a component as read-only by injecting `_readOnly: true` into its
 * `props`. Used for PG-04 synthesized CRUD update forms (a `form` with
 * `dataSource: { mode: 'single' }`) when the current session role is not
 * permitted to update the bound table. `renderCrudUpdateForm` reads the flag
 * and propagates `disabled: true` to every field skeleton + omits the Save
 * button.
 *
 * Distinct from `hideComponent` (which uses `display: none`) because the spec
 * requires the form to remain visible with
 * disabled inputs — preventing edits while still showing the record values.
 */
function markComponentReadOnly(component: Component): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _readOnly: true,
    },
  }
}

/**
 * Detects the PG-04 synthesized CRUD update case: a `form` component with
 * `dataSource: { mode: 'single', table: <string> }` and no
 * explicit `action`. The runtime synthesizes a `{ type: 'crud',
 * operation: 'update' }` action at `renderForm` time (see
 * `maybeSynthesizeCrudUpdateAction` in interactive-renderers.tsx), so the
 * page-level permission filter needs to reach into the dataSource to know
 * which table to check.
 */
function getSynthesizedUpdateTable(component: Component): string | undefined {
  if (component.type !== 'form') return undefined
  const action = component.action as { readonly type?: string } | undefined
  if (action?.type !== undefined) return undefined
  const dataSource = component.dataSource as
    { readonly table?: string; readonly mode?: string } | undefined
  if (!dataSource || dataSource.mode !== 'single' || typeof dataSource.table !== 'string') {
    return undefined
  }
  return dataSource.table
}

/**
 * Applies CRUD update permission filtering to page components.
 *
 * For each component that has a `crud` update action, checks if the table has
 * restricted update permissions (`permissions.update`). If the current session
 * role is not in the allowed roles (or the user is unauthenticated), the component
 * is hidden via `display: none` style injection — matching the `applyVisibilityToSection`
 * pattern — so it is present in the DOM but not visible.
 *
 * PG-04: also handles the `form`
 * + `dataSource: { mode: 'single' }` case where the CRUD update action is
 * synthesized at render time. For those components, denial does NOT hide the
 * component — the form remains visible with `_readOnly: true` so all fields
 * render as disabled and the Save button is suppressed.
 */
export function applyCrudUpdatePermissions(
  components: Page['components'],
  tables: App['tables'],
  session: SessionInfo | undefined
): Page['components'] {
  if (!components) return components

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item

    const component = item as Component
    const action = component.action as { type?: string; operation?: string; table?: string }

    if (action?.type === 'crud' && action?.operation === 'update') {
      if (isCrudUpdateAllowed(action.table, tables, session)) return component
      return hideComponent(component)
    }

    const synthesizedTable = getSynthesizedUpdateTable(component)
    if (synthesizedTable !== undefined && !isCrudUpdateAllowed(synthesizedTable, tables, session)) {
      return markComponentReadOnly(component)
    }

    return component
  })
}
