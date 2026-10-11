/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The render-time WRITE gates of a table grid — create, inline edit, and the
 * per-relationship create of a related record — stamped where the session is
 * known and the island's is not. Shared by every place a grid is resolved
 * (`data-source-modes.ts`, `data-source-resolver.ts`).
 */

import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import {
  hasCreatePermissionForRoles,
  hasInlineEditDefaultForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The per-field answer to "may this caller create in the table this
 * `relationship` column points at?", keyed by field name.
 *
 * the relationship-field `allowCreate`/`maxLinked` design's picker may create a missing related record inline. Whether the
 * affordance is DRAWN follows the same anti-enumeration rule the toolbar's own
 * create button already follows: absent, never disabled — a disabled control
 * still tells the caller the related table exists and what it would accept.
 *
 * It is the SAME `hasCreatePermission` the bound table is gated by, called a
 * second time against `relatedTable`. A second permission model in the client
 * bundle is exactly what the `Permission Evaluator Drift` gate exists to
 * prevent, and the island never receives the session role, so it could not
 * answer `create: ['admin']` at all.
 */
function relatedCreateGates(ctx: {
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
}): Record<string, boolean> {
  const roles = writeGateRoles(ctx.session)
  return Object.fromEntries(
    ctx.table.fields.flatMap((field) => {
      if (field.type !== 'relationship') return []
      const { relatedTable } = field as { readonly relatedTable?: string }
      if (relatedTable === undefined) return []
      const related = ctx.app.tables?.find((t) => t.name === relatedTable)
      return [[field.name, hasCreatePermissionForRoles(related, roles, ctx.app)] as const]
    })
  )
}

/**
 * The caller's account role first, then a `group:<name>` entry per membership —
 * the shape the records API's `*ForRoles` write evaluators read, so an
 * affordance follows their rules exactly: a viewer is offered no write a group
 * grant would give her, because the API refuses it.
 */
function writeGateRoles(session: SessionInfo | undefined): readonly string[] {
  return [session?.role ?? '', ...(session?.groups ?? []).map(toGroupReference)]
}

type WriteGateContext = {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
}

/**
 * The three gates for a caller WITH a session. A visitor without one gets none
 * of them: the records API answers an anonymous create or update with 401
 * whatever the grant says, and the gates mirror what the API accepts from THIS
 * caller.
 */
function signedInWriteGates(ctx: WriteGateContext, session: SessionInfo) {
  const roles = writeGateRoles(session)
  return {
    _canCreate: hasCreatePermissionForRoles(ctx.table, roles, ctx.app),
    _canUpdate: hasInlineEditDefaultForRoles(ctx.table, roles, ctx.app),
    // Per-relationship-field create gates. Stamped alongside the two
    // table-level gates because this is the one layer holding BOTH the session
    // and `app.tables` — the picker's create affordance needs the second
    // table's permissions, which no other seam can see.
    _canCreateRelated: relatedCreateGates(ctx),
  }
}

/**
 * Stamp the render-time write-permission gates into a table component's
 * props, where the session role is known and the island's is not.
 *
 * `_canCreate` (a pages datatable spec) offers the toolbar "Nouvel
 * enregistrement" affordance only when the current role may create — absent,
 * not disabled, otherwise: anti-enumeration.
 *
 * `_canUpdate` is the permission-derived default
 * behind a column's `editable`, the one its schema annotation has always
 * promised ("default: from table permissions") and never delivered. It is
 * computed from {@link hasInlineEditDefault} rather than re-derived in the
 * browser for two reasons: the island never receives the session role, so it
 * could not answer `update: ['engineer']` at all; and a second permission
 * model in the client bundle is exactly what the `Permission Evaluator Drift`
 * gate exists to prevent.
 *
 * Both are a no-op for non-data-tables and when auth is not configured. The two
 * absent-value defaults differ, deliberately: create is OFFERED when unknown
 * (full-access model), edit is WITHHELD when unknown (fail-closed, and the
 * behaviour every grid has today).
 *
 * Both carry the caller's GROUPS as well as their role. A grant naming a group
 * (`create: ['group:ops']`) is matched against memberships and never against
 * the role string, so passing the role alone left every group-granted member
 * silently un-offered a button they were entitled to press — while the CRUD
 * form gate in this same layer (`render-page.tsx` → `gateCaller`) already
 * forwarded them. One page, two treatments.
 */
export function withWritePermissionGates(ctx: WriteGateContext): Component {
  if (ctx.component.type !== 'table' || !ctx.app.auth) return ctx.component
  const gates =
    ctx.session !== undefined
      ? signedInWriteGates(ctx, ctx.session)
      : {
          _canCreate: false,
          _canUpdate: false,
          _canCreateRelated: Object.fromEntries(
            Object.keys(relatedCreateGates(ctx)).map((name) => [name, false])
          ),
        }
  return { ...ctx.component, props: { ...(ctx.component.props ?? {}), ...gates } }
}
