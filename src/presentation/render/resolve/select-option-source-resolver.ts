/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  SELECT_OPTION_SOURCE_DEFAULT_LIMIT,
  SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD,
} from '@/domain/models/app/pages/components/component-types/form-controls/select-option-source'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { resolveSystemOptions } from '@/presentation/render/resolve/system-option-source-resolver'
import { resolveFilters, scopeTablesOf } from './current-user-resolver'
import type { SystemRowsFetcher } from './first-object-redirect-resolver'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type {
  SelectOptionSource,
  SelectSystemOptionSource,
} from '@/domain/models/app/pages/components/component-types/form-controls/select-option-source'
import type { OptionItem } from '@/domain/models/app/pages/components/shared-schemas'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/**
 * Pre-render resolver for a `select`'s dynamic option source.
 *
 * Turns `dataSource: { table, displayField, valueField?, filter?, sort?, limit? }`
 * into a concrete `options: [{ value, label }, …]` on the component, reading the
 * rows server-side, and REMOVES the binding from the node.
 *
 * ## Why it runs before `resolvePageDataSources`, and why it strips
 *
 * `resolveComponent` keys off `component.dataSource`. A `select` is not a
 * record-RENDERING component, so if one reached that walk still carrying a
 * binding it would be swept into `resolveByMode` and mangled (list mode stamps
 * `children` / `_dataSourceBound` onto a control that has neither). Running
 * this pass first AND deleting `dataSource` from the node makes that collision
 * impossible by construction rather than by an added exclusion branch there.
 *
 * Stripping is also what keeps the table name, the filter, and the sort out of
 * the client bundle: the island receives only the resolved label/value pairs
 * through `data-island-props` (security rule S4).
 *
 * ## Ordering
 *
 * Runs AFTER `applyPageComponentFilters` — that pass runs `expandFormRefs`, so
 * a `select` inside an embedded `formRef` is already inlined into the tree and
 * this walk can see it.
 *
 * ## The empty case
 *
 * When nothing resolves (no rows, an unreadable table, an unresolvable
 * `$currentUser` filter) the `options` key is OMITTED rather than set to `[]`.
 * `OptionsSchema` is `Schema.minItems(1)`, so an empty array is a value the
 * authored schema would REJECT. The resolved page is not re-decoded today, but
 * emitting one would be a trap for whoever adds re-validation later.
 */

/** Ambient context every binding resolution needs. */
export interface SelectOptionSourceContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly db: DataSourceDb
  /**
   * Server-side reader for a SYSTEM-backed option source, borrowing the
   * caller's own credentials. Supplied by the route layer, which is where the
   * request origin and cookies are known; absent (a unit test, a static build)
   * a system source resolves to no options and the control still renders.
   */
  readonly fetchSystemRows?: SystemRowsFetcher
}

/** A `select` node carrying either option-source binding. */
type BoundSelect = Component & {
  readonly dataSource?: SelectOptionSource | SelectSystemOptionSource
}

/** True for the endpoint-backed member of the binding union. */
function isSystemBinding(
  binding: SelectOptionSource | SelectSystemOptionSource
): binding is SelectSystemOptionSource {
  return 'system' in binding
}

/**
 * Hard ceiling on the resolved list, mirroring the schema's `limit` bound.
 * Applied again here because the resolver must stay bounded even if it is ever
 * called with a config that bypassed decode.
 */
const MAX_RESOLVED_OPTIONS = 1000

/** True for a `select` that declares the narrow option-source binding. */
function isBoundSelect(component: Component): component is BoundSelect {
  if (component.type !== 'select') return false
  const { dataSource } = component as { dataSource?: unknown }
  return dataSource !== null && typeof dataSource === 'object'
}

/** Remove the binding so no `select` reaches the renderer (or the client) with one. */
function stripBinding(component: BoundSelect): Component {
  const { dataSource: _binding, ...rest } = component as Component & { dataSource?: unknown }
  return rest as Component
}

/**
 * Decide whether this request may read the bound table's rows at all.
 *
 * Table-level `permissions.read` is the gate:
 * resolving options inlines row values into the HTML, so without it, binding a
 * dropdown to a table would be a way to exfiltrate it.
 *
 * The field-level check is the same rule one level down — a role that may read
 * the table but not the `displayField` column must not receive that column's
 * values as option labels. Both are fail-closed: a denied read yields no
 * options rather than an error, so the control still renders (anti-enumeration,
 * rule S1).
 */
function canResolve(
  binding: SelectOptionSource,
  valueField: string,
  ctx: SelectOptionSourceContext
): boolean {
  // No auth configured → the full-access model; every table is readable.
  if (!ctx.app.auth) return true

  const table = (ctx.app.tables ?? []).find((t) => t.name === binding.table)
  if (!table) return false

  // One composed plan, not a table check plus a separately-derived field set.
  // The predecessor pair diverged from the records API twice: it gated the
  // table on the primary role alone (so a `group:`-granted table was invisible
  // to a member of that group) and it derived restrictions only from a declared
  // `permissions.fields` block (so the built-in default rules never applied).
  const plan = buildReadAccessPlan({
    app: ctx.app,
    table: table as TableLike,
    principal: readPrincipalFromSession(ctx.session),
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return false

  return (
    !plan.restrictedColumns.has(binding.displayField) && !plan.restrictedColumns.has(valueField)
  )
}

/**
 * Project one row into an option.
 *
 * A row whose label or value is nullish is DROPPED rather than rendered as an
 * empty choice: a blank row in a dropdown is a control the user cannot reason
 * about, and `String(null)` would paint the literal text `null`.
 */
function toOption(
  row: Readonly<Record<string, unknown>>,
  displayField: string,
  valueField: string
): OptionItem | undefined {
  const label = row[displayField]
  const value = row[valueField]
  if (label === null || label === undefined) return undefined
  if (value === null || value === undefined) return undefined
  return { label: String(label), value: String(value) }
}

/**
 * Fetch and project the option rows.
 *
 * `$currentUser.*` filter values are resolved here rather than at decode: the
 * reference is per-request by definition, and left unresolved it would reach
 * SQL as the literal string `$currentUser.id` and silently match zero rows.
 * An unresolvable reference (no session) yields NO options — fail closed, never
 * the unfiltered list.
 */
async function fetchOptions(
  binding: SelectOptionSource,
  valueField: string,
  ctx: SelectOptionSourceContext
): Promise<readonly OptionItem[]> {
  const filters = await resolveFilters(binding.filter, {
    session: ctx.session,
    cookies: ctx.cookies,
    fetchAssignments: ctx.db.fetchUserAssignments,
    scopeTables: scopeTablesOf(ctx.app),
  })
  if (filters.kind === 'unauthorized') return []

  const pageSize = Math.min(
    binding.limit ?? SELECT_OPTION_SOURCE_DEFAULT_LIMIT,
    MAX_RESOLVED_OPTIONS
  )
  // Project only the two columns the option list is built from — the rest of
  // the row has no destination and must not travel.
  const fields = [...new Set([valueField, binding.displayField])]

  const rows = await ctx.db.fetchRecords(binding.table, {
    fields,
    ...(filters.filter.length > 0 ? { filter: filters.filter } : {}),
    ...(binding.sort !== undefined ? { sort: binding.sort } : {}),
    pageSize,
  })

  return rows
    .map((row) => toOption(row, binding.displayField, valueField))
    .filter((o): o is OptionItem => o !== undefined)
}

/** Resolve ONE bound select: gate, fetch, stamp, strip. */
async function resolveBoundSelect(
  component: BoundSelect,
  ctx: SelectOptionSourceContext
): Promise<Component> {
  const binding = component.dataSource
  const stripped = stripBinding(component)
  if (!binding) return stripped

  const options = await resolveBindingOptions(binding, ctx)
  // Empty → omit the key entirely (see the module docstring: `Schema.minItems(1)`).
  if (options.length === 0) return stripped

  return { ...stripped, options } as Component
}

/**
 * Resolve EITHER member of the binding union into a concrete option list.
 *
 * The two gate differently, and deliberately: a table source is checked against
 * the caller's read-access plan HERE, because it reads the database directly; a
 * system source needs no such check, because the read goes back through the
 * endpoint's own guard carrying the caller's credentials, and a second gate
 * here would be a re-derivation of a decision the endpoint already owns.
 */
async function resolveBindingOptions(
  binding: SelectOptionSource | SelectSystemOptionSource,
  ctx: SelectOptionSourceContext
): Promise<readonly OptionItem[]> {
  if (isSystemBinding(binding)) return resolveSystemOptions(binding, ctx.fetchSystemRows)

  const valueField = binding.valueField ?? SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD
  if (!canResolve(binding, valueField, ctx)) return []
  return fetchOptions(binding, valueField, ctx)
}

/**
 * Replace an inline row editor's `optionsSource` with a concrete `options`
 * array, wherever one sits in a grid's action columns.
 *
 * The editor lives at `columns[].actions[].editSelect`, which the select walk
 * above never reaches: it visits `type: 'select'` nodes and their children, and
 * a column definition is neither. Left unresolved, the island receives an
 * editor with no options — a dropdown with nothing in it — which is exactly
 * what the `options` XOR `optionsSource` decode rule exists to make impossible.
 */
async function resolveEditSelectSources(
  component: Component,
  ctx: SelectOptionSourceContext
): Promise<Component> {
  const { columns } = component as { readonly columns?: readonly unknown[] }
  if (!Array.isArray(columns) || columns.length === 0) return component

  const resolved = await Promise.all(columns.map((column) => resolveColumn(column, ctx)))
  if (resolved.every((column, index) => column === columns[index])) return component
  return { ...component, columns: resolved } as Component
}

/**
 * Replace a form FIELD's `optionsSource` with a concrete `options` array.
 *
 * `form.fields[]` is the third position a choice list can be declared in, and
 * like `columns[].actions[].editSelect` it is invisible to the select walk
 * above: a field descriptor is not a `type: 'select'` component and is not a
 * child of one. Left unresolved the form renders a dropdown with nothing in it
 * — the same silent failure the `options` XOR `optionsSource` rule exists to
 * make impossible.
 *
 * Returns the SAME node when no field carries a binding, so a form with a
 * literal option list pays one `filter` and no copy.
 */
async function resolveFormFieldSources(
  component: Component,
  ctx: SelectOptionSourceContext
): Promise<Component> {
  const { fields } = component as { readonly fields?: readonly unknown[] }
  if (!Array.isArray(fields) || fields.length === 0) return component

  const resolved = await Promise.all(fields.map((field) => resolveFormField(field, ctx)))
  if (resolved.every((field, index) => field === fields[index])) return component
  return { ...component, fields: resolved } as Component
}

/** Resolve ONE field's `optionsSource`, stripping the binding. */
async function resolveFormField(field: unknown, ctx: SelectOptionSourceContext): Promise<unknown> {
  if (typeof field !== 'object' || field === null) return field
  const source = (field as Record<string, unknown>)['optionsSource']
  if (typeof source !== 'object' || source === null) return field

  const { optionsSource: _resolved, ...rest } = field as Record<string, unknown>
  const options = await resolveBindingOptions(
    source as SelectOptionSource | SelectSystemOptionSource,
    ctx
  )
  // Empty → omit the key entirely, exactly as `resolveBoundSelect` does: the
  // authored schema declares `Schema.minItems(1)`, so `[]` is a value it would
  // reject.
  return options.length === 0 ? rest : { ...rest, options }
}

/** Resolve every action's editor on ONE column. */
async function resolveColumn(column: unknown, ctx: SelectOptionSourceContext): Promise<unknown> {
  if (typeof column !== 'object' || column === null) return column
  const { actions } = column as { readonly actions?: readonly unknown[] }
  if (!Array.isArray(actions) || actions.length === 0) return column

  const resolved = await Promise.all(actions.map((action) => resolveAction(action, ctx)))
  if (resolved.every((action, index) => action === actions[index])) return column
  return { ...column, actions: resolved }
}

/** Resolve ONE action's `editSelect.optionsSource`, stripping the binding. */
async function resolveAction(action: unknown, ctx: SelectOptionSourceContext): Promise<unknown> {
  if (typeof action !== 'object' || action === null) return action
  const { editSelect } = action as { readonly editSelect?: Record<string, unknown> }
  if (!editSelect || typeof editSelect !== 'object') return action

  const source = editSelect['optionsSource']
  if (typeof source !== 'object' || source === null) return action

  const { optionsSource: _resolved, ...editor } = editSelect
  const options = await resolveBindingOptions(
    source as SelectOptionSource | SelectSystemOptionSource,
    ctx
  )
  return {
    ...action,
    editSelect: options.length === 0 ? editor : { ...editor, options },
  }
}

/**
 * Recursively resolve bound selects in a component tree.
 *
 * Component references pass through untouched — an unexpanded `$ref` has no
 * inlined children to walk (`expandFormRefs` has already run for the ones that
 * do).
 */
async function resolveComponentTree(
  item: Component | SimpleComponentReference | ComponentReference,
  ctx: SelectOptionSourceContext
): Promise<Component | SimpleComponentReference | ComponentReference> {
  if ('component' in item || '$ref' in item) return item
  const component = item as Component

  const resolved = isBoundSelect(component)
    ? await resolveBoundSelect(component, ctx)
    : await resolveFormFieldSources(await resolveEditSelectSources(component, ctx), ctx)

  const { children } = resolved as { children?: ReadonlyArray<unknown> }
  if (!children || children.length === 0) return resolved

  const resolvedChildren = await Promise.all(
    children.map(async (child) => {
      if (typeof child === 'string') return child
      return resolveComponentTree(
        child as Component | SimpleComponentReference | ComponentReference,
        ctx
      )
    })
  )

  return { ...resolved, children: resolvedChildren } as Component
}

/**
 * Walk a page and replace every option-source binding with the resolved
 * `options` array, in all three positions one can be declared: a `select`
 * component's `dataSource`, a grid's `columns[].actions[].editSelect`, and a
 * form's `fields[]`. Safe to call on every page — a page with none returns
 * after a cheap walk.
 */
export async function resolveSelectOptionSources(
  page: Page,
  ctx: SelectOptionSourceContext
): Promise<Page> {
  if (!page.components || page.components.length === 0) return page

  const resolvedComponents = await Promise.all(
    page.components.map((c) => resolveComponentTree(c, ctx))
  )

  return { ...page, components: resolvedComponents }
}
