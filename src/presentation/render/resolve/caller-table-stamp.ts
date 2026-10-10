/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  alternateViewsForReader,
  readableColumnsOf,
} from '@/presentation/render/props/caller-table-inputs'
import {
  isRecordViewForReader,
  recordViewForReader,
} from '@/presentation/render/props/record-view-for-reader'
import { isViewBoundSource } from '@/presentation/render/props/view-binding-inputs'
import { isWithheldOverUnreadableTable, withheldComponent } from './withheld-component'
import type { DataSourceDb } from './data-source-contracts'
import type { CallerTableView, ReadTableAsCaller } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/** The render-time-only key a drawer's related tables are stamped under, by table name. */
export const RELATED_CALLER_TABLES_KEY = '_relatedCallerTables'

interface StampContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly read: ReadTableAsCaller
}

const isDeclared = (app: App, tableName: unknown): tableName is string =>
  typeof tableName === 'string' && (app.tables ?? []).some((t) => t.name === tableName)

const withProps = (component: Component, props: Record<string, unknown>): Component =>
  ({ ...component, props: { ...(component.props ?? {}), ...props } }) as Component

/**
 * A grid: the table as its reader may see it, and — when it reads through one
 * of the table's views — that view's definition as the view's route answers
 * her. Its configured columns lose every column on a field she may not read,
 * and its switcher every alternate view laid out by one.
 */
async function stampGrid(component: Component, ctx: StampContext): Promise<Component> {
  const binding = component.dataSource as
    { readonly table?: unknown; readonly view?: unknown } | undefined
  const table = (ctx.app.tables ?? []).find((t) => t.name === binding?.table)
  if (table === undefined) return component
  const view = typeof binding?.view === 'string' ? binding.view : undefined
  const callerTable = await ctx.read(ctx.app, table.name, ctx.session, view)
  const { columns } = component as { readonly columns?: readonly unknown[] }
  const readable = view === undefined ? readableColumnsOf(columns, table, callerTable) : columns
  return alternateViewsForReader(
    {
      ...withProps(component, { _callerTable: callerTable }),
      ...(readable !== columns && { columns: readable }),
    } as Component,
    table,
    callerTable
  )
}

/**
 * A board, a calendar, a timeline, a chart or a KPI — or any record component
 * reading through a view: the table as its reader may see it, and its own
 * configuration without a dimension on a field she may not read — or
 * withheld, when it cannot be drawn without that field
 * (`record-view-for-reader.ts`). Through a view, the view's route decides
 * what she reads: its grant, not the table's, so a public view admits a
 * visitor, and a view that refuses her withholds the component.
 */
async function stampRecordView(component: Component, ctx: StampContext): Promise<Component> {
  const binding = component.dataSource as
    { readonly table?: unknown; readonly view?: unknown } | undefined
  const table = (ctx.app.tables ?? []).find((t) => t.name === binding?.table)
  if (table === undefined) return component
  const view = typeof binding?.view === 'string' ? binding.view : undefined
  const callerTable = await ctx.read(ctx.app, table.name, ctx.session, view)
  if (view !== undefined && callerTable.boundView === undefined) {
    return withheldComponent(component)
  }
  const forReader = recordViewForReader(component, table, callerTable)
  if (forReader === 'withheld') return withheldComponent(component)
  return withProps(forReader, { _callerTable: callerTable })
}

/** A record drawer: the table it edits, as its reader may see it. */
async function stampOwnTable(component: Component, ctx: StampContext): Promise<Component> {
  const binding = component.dataSource as { readonly table?: unknown } | undefined
  if (!isDeclared(ctx.app, binding?.table)) return component
  return withProps(component, { _callerTable: await ctx.read(ctx.app, binding.table, ctx.session) })
}

/**
 * The table a form draws inputs for: an edit form's — its `crud` update
 * action's table, or, for a form bound to one record with no action of its
 * own, which the renderer turns into an update form, the table it is bound to
 * — or the table a sign-in or sign-up form is bound to, whose fields it draws.
 * `undefined` for any other form (a page form never creates a row).
 */
function recordFormTable(component: Component): unknown {
  const { action, dataSource } = component as {
    readonly action?: {
      readonly type?: unknown
      readonly operation?: unknown
      readonly table?: unknown
    }
    readonly dataSource?: { readonly mode?: unknown; readonly table?: unknown }
  }
  if (action === undefined) return dataSource?.mode === 'single' ? dataSource.table : undefined
  if (action.type === 'auth') return dataSource?.table
  if (action.type !== 'crud') return undefined
  return action.operation === 'update' ? action.table : undefined
}

/**
 * An edit form: the table it writes into, as its reader may see it. Its
 * controls are drawn from that answer (`updateFieldDefsForReader`).
 */
async function stampRecordForm(component: Component, ctx: StampContext): Promise<Component> {
  const table = recordFormTable(component)
  if (!isDeclared(ctx.app, table)) return component
  const callerTable = await ctx.read(ctx.app, table, ctx.session)
  return withProps(component, { _callerTable: callerTable })
}

/** A drawer's related sections: each related table, as the drawer's reader may see it. */
async function stampRelatedSections(component: Component, ctx: StampContext): Promise<Component> {
  const { related } = component as { readonly related?: readonly unknown[] }
  if (!Array.isArray(related) || related.length === 0) return component
  const names = [
    ...new Set(
      related
        .map((entry) => (entry as { readonly table?: unknown } | null)?.table)
        .filter((name): name is string => isDeclared(ctx.app, name))
    ),
  ]
  if (names.length === 0) return component
  const byTable: Readonly<Record<string, CallerTableView>> = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await ctx.read(ctx.app, name, ctx.session)] as const)
    )
  )
  return withProps(component, { [RELATED_CALLER_TABLES_KEY]: byTable })
}

/**
 * Stamp what this caller may see of a component's table into its props
 * (`props._callerTable`, or {@link RELATED_CALLER_TABLES_KEY} for a drawer's
 * related tables): the views the table API lists her and the permission map it
 * answers her, computed by that API's own programs (`db.readTableAsCaller`) —
 * never by a second permission model here. Every surface that names the fields
 * of a table, or offers an input for one, is narrowed to it by the same two
 * questions (`caller-table-inputs.ts`: `readableFieldsOf`, `writableFieldsOf`):
 * a grid's views, permissions, field list and columns, an edit form's
 * controls, a drawer's related columns, and the dimensions of a board,
 * a calendar, a timeline or a chart.
 *
 * Applied AFTER the read gate, to a component it left bound. A no-op without
 * auth (the full-access model) and where no reader was injected — a render
 * outside the page route funnel (`renderWithCache`): the operator console's
 * mounted surfaces and unit tests. A static build is NOT one of them: it
 * renders every page through that funnel, so it is stamped exactly as a live
 * anonymous request is.
 */
export async function withCallerTableView(
  component: Component,
  ctx: {
    readonly app: App
    readonly session: SessionInfo | undefined
    readonly db: DataSourceDb
  }
): Promise<Component> {
  const read = ctx.db.readTableAsCaller
  if (!ctx.app.auth || read === undefined) return component
  const stampCtx = { app: ctx.app, session: ctx.session, read }
  if (component.type === 'table') return stampGrid(component, stampCtx)
  if (component.type === 'form') return stampRecordForm(component, stampCtx)
  if (component.type === 'drawer') {
    return stampRelatedSections(await stampOwnTable(component, stampCtx), stampCtx)
  }
  const throughView =
    isWithheldOverUnreadableTable(component) && isViewBoundSource(component.dataSource)
  if (isRecordViewForReader(component) || throughView) {
    return stampRecordView(component, stampCtx)
  }
  return component
}
