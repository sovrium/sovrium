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
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { resolveFilters, scopeTablesOf } from './current-user-resolver'
import { getRestrictedFields } from './field-permission-filter'
import type { DataSourceDb } from './data-source-resolver'
import type { App } from '@/domain/models/app'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SelectOptionSource } from '@/domain/models/app/pages/components/component-types/form-controls/select-option-source'
import type { OptionItem } from '@/domain/models/app/pages/components/shared-schemas'
import type { SessionInfo } from '@/domain/types/session-info'

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
}

/** A `select` node carrying the narrow option-source binding. */
type BoundSelect = Component & { readonly dataSource?: SelectOptionSource }

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

  const userRole = ctx.session?.role ?? ''
  if (!hasReadPermission(table, userRole, ctx.app.tables)) return false

  const restricted = getRestrictedFields(table.permissions, userRole)
  return !restricted.has(binding.displayField) && !restricted.has(valueField)
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
  if (!binding) return stripBinding(component)

  const valueField = binding.valueField ?? SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD
  const stripped = stripBinding(component)

  if (!canResolve(binding, valueField, ctx)) return stripped

  const options = await fetchOptions(binding, valueField, ctx)
  // Empty → omit the key entirely (see the module docstring: `Schema.minItems(1)`).
  if (options.length === 0) return stripped

  return { ...stripped, options } as Component
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

  const resolved = isBoundSelect(component) ? await resolveBoundSelect(component, ctx) : component

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
 * Walk a page and replace every `select` option-source binding with the
 * resolved `options` array. Safe to call on every page — a page with no bound
 * select returns after a cheap walk.
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
