/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read gates of `read-plan-gates.ts` and the write gates of
 * `write-permission-gates.ts`, applied to a record
 * component NESTED inside a layout container, where the page walk reaches it
 * without the plan the top-level resolution builds: the plan is resolved here
 * from the component's own table, then the same gate functions answer.
 */

import { tableBindingOf } from './component-rewrite'
import { denyWhenUnreadable, gateInheritedRecord, resolveRenderPlan } from './read-plan-gates'
import { isWithheldOverUnreadableTable } from './withheld-component'
import { withWritePermissionGates } from './write-permission-gates'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { TableLike } from '@/domain/models/app/tables/read-access-plan-service'

/**
 * {@link gateInheritedRecord} for a form nested inside a layout container,
 * where the plan is not yet built: the one nested pass holding the session
 * resolves it from the form's own table. A form naming no declared table keeps
 * nothing it was handed.
 */
export function gateNestedInheritedRecord(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  const tableName = tableBindingOf(component)?.table
  const table = (ctx.app.tables ?? []).find((t) => t.name === tableName)
  const plan = resolveRenderPlan({
    matchedTable: table as TableLike | undefined,
    app: ctx.app,
    session: ctx.session,
  })
  return gateInheritedRecord(component, plan)
}

/**
 * The declared table a component reads directly, or `undefined` for one that
 * reads through a view (gated by the view's own grant on its own route) or
 * names no declared table (a system source).
 */
function directlyBoundTable(component: Component, app: App) {
  const binding = tableBindingOf(component)
  if (binding?.view !== undefined) return undefined
  const tableName = binding?.table
  return typeof tableName === 'string'
    ? (app.tables ?? []).find((t) => t.name === tableName)
    : undefined
}

/**
 * The read and write gates for a table grid NESTED inside a layout container.
 *
 * `resolveComponent` gates a grid at the top level of a page, but a grid one
 * container down never reaches it: the page walk only stamps nested bindings
 * for their islands (`stampNestedIslands`), and the island reads a missing
 * `canCreate` as permission. So a blog's home page, whose posts grid sits
 * inside a section, offered `+ New record`, Import and the add-row line to
 * every visitor — and a grid over a table the caller may not read mounted and
 * printed its columns. This applies the same two gates, from the same
 * functions, wherever the grid sits: the read plan first
 * ({@link denyWhenUnreadable}), then the write stamp.
 *
 * Only the GATES are shared, not the rest of `resolveByMode`: a grid's island
 * fetches its own rows through the records API, which enforces read and field
 * permissions itself, so the server-side list query and the child-template
 * filter have nothing to do for it. A binding naming no declared table (a
 * system source) comes back untouched.
 *
 * The read gate applies, alone, to the other record components whose island is
 * built from the table's declaration (`withheld-component.ts`): one container
 * down, a board or a calendar over a table the caller may not read is withheld
 * exactly as it is at the top of the page.
 */
export function gateNestedTableBinding(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  const isGrid = component.type === 'table'
  if (!isGrid && !isWithheldOverUnreadableTable(component)) return component
  const table = directlyBoundTable(component, ctx.app)
  if (table === undefined) return gateViewBoundGrid(component, ctx)
  const plan = resolveRenderPlan({
    matchedTable: table as TableLike,
    app: ctx.app,
    session: ctx.session,
  })
  const denied = denyWhenUnreadable(component, plan)
  if (denied !== undefined || !isGrid) return denied ?? component
  return withWritePermissionGates({ component, app: ctx.app, table, session: ctx.session })
}

/**
 * A grid reading through a view: its read is the view's own grant, checked on
 * the view's route, but its writes go to the table's records — so it carries
 * the table's write gates exactly as a table-bound grid does.
 */
function gateViewBoundGrid(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  const binding = tableBindingOf(component)
  const tableName = binding?.table
  const table =
    component.type === 'table' && binding?.view !== undefined
      ? (ctx.app.tables ?? []).find((t) => t.name === tableName)
      : undefined
  return table === undefined
    ? component
    : withWritePermissionGates({ component, app: ctx.app, table, session: ctx.session })
}
