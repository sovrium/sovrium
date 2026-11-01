/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The read gates a server-drawn data-bound component answers before any mode
 * resolves it: the composed read plan, the refusal it answers, and the plan
 * applied to a record a form inherited from its page. The mode resolvers that
 * read rows under that plan are `data-source-modes.ts`.
 */

import {
  callerReaderFromSession,
  noAuthReadPlan,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  stripRestrictedColumns,
  type ReadAccessPlan,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { componentField, keyOf, rewriteComponent, type RenderProps } from './component-rewrite'
import { emptyDataBoundComponent } from './withheld-component'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The columns a `form` must not render an input for: every declared field this
 * visitor may not read, from the composed plan. An input with no value still
 * renders and is submitted, so an unreadable field would be saved as blank over
 * its real value — and a field restricting only `read` inherits its write from
 * the table's `update`, so the records API cannot be relied on to refuse it.
 */
export function withheldFieldsProps(
  component: Component,
  plan: ReadAccessPlan | undefined
): Record<string, unknown> {
  if (component.type !== 'form' || plan === undefined || plan.restrictedColumns.size === 0)
    return {}
  return { _unreadableFields: [...plan.restrictedColumns] }
}

/**
 * The composed read plan for an SSR data-bound component.
 *
 * With no `auth` configured it is {@link noAuthReadPlan}: refused for a table
 * that does not open `read` to everyone, else no column restricted but the
 * write-only ones — and `undefined` only for a table the app does not declare.
 *
 * ROW-LEVEL SCOPING IS NOT PART OF THIS PLAN: `rowContext` is omitted, the
 * plan reports `'unresolved'`, and no caller reads that field. The row-level
 * rule is answered in memory against the fetched rows (`record-read-gate.ts`):
 * by `readRowsForCaller` for every server-drawn list, search, option list and
 * sidebar, and by the single-row checks of a `mode: single` binding, a
 * page-level `dataSource` and a collection page. A
 * grid's island reads through the records API, which applies it in SQL.
 */
export function resolveRenderPlan(ctx: {
  readonly matchedTable: TableLike | undefined
  readonly app: App
  readonly session: SessionInfo | undefined
}): ReadAccessPlan | undefined {
  // No `auth`: refused unless the table opens `read` to everyone, then full access.
  if (!ctx.app.auth) return noAuthReadPlan(ctx.app, ctx.matchedTable)
  return buildReadAccessPlan({
    app: ctx.app,
    table: ctx.matchedTable,
    principal: tableReadPrincipal(ctx.matchedTable, callerReaderFromSession(ctx.session, ctx.app)),
    policy: CANONICAL_READ_POLICY,
  })
}

/**
 * The read-plan gate every data-bound component answers, wherever it sits:
 * the denied shape when the composed plan refuses the caller, `undefined`
 * otherwise. `plan === undefined` is an undeclared table under no `auth`.
 */
export function denyWhenUnreadable(
  component: Component,
  plan: ReadAccessPlan | undefined
): Component | undefined {
  if (plan === undefined || plan.allowed) return undefined
  return emptyDataBoundComponent(component)
}

/**
 * True when a `form` holds a record its PAGE handed down rather than one it
 * resolved itself: it carries `_record` and declares no `mode`. That is the
 * shape `inheritsPageRecord` (`page-collection-resolver.ts`) produces.
 */
export function holdsInheritedRecord(component: Component): boolean {
  if (component.type !== 'form') return false
  const binding = componentField(component, 'dataSource')
  if (binding === undefined || keyOf(binding, 'mode') !== undefined) return false
  return keyOf(component.props, '_record') !== undefined
}

/**
 * The caller's read plan, applied to a record a form inherited from its page.
 *
 * The page resolved that record whole, before any per-caller plan existed —
 * the page binding holds no session — and a form serialises its `_record` into
 * its island props whole. So without this pass a prefilled form printed columns
 * the records API withholds from the same caller. A caller the plan refuses
 * gets the form with no record at all; any other gets the record less the
 * plan's restricted columns, through the records API's own projection
 * ({@link stripRestrictedColumns}). `plan === undefined` is an undeclared
 * table under no `auth` and changes nothing.
 */
export function gateInheritedRecord(
  component: Component,
  plan: ReadAccessPlan | undefined
): Component {
  if (plan === undefined) return component
  const denied = denyWhenUnreadable(component, plan)
  if (denied !== undefined) return denied
  const props: RenderProps = component.props ?? {}
  const record = props['_record'] as Readonly<Record<string, unknown>>
  return rewriteComponent(component, {
    props: {
      ...props,
      ...withheldFieldsProps(component, plan),
      _record: stripRestrictedColumns(plan, record),
    },
  })
}
