/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SIGNED_OUT_VISITOR_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { CHOICE_FIELD_TYPES } from '@/domain/models/app/pages/components/component-types/form-controls/select-options-from-validation'
import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import { isFieldReadableUnderFieldRules } from '@/domain/models/app/tables/field-read-filter-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { OptionItem } from '@/domain/models/app/pages/components/shared-schemas'

/**
 * Pre-render resolver for a choice control's `optionsFrom: { table, field }`:
 * the binding becomes the concrete `options` the field declares, in declared
 * order — labelled by each option's label, else its value — and is REMOVED, so
 * neither name reaches the browser.
 *
 * `table` may be `$param.<segment>`: the page address names the table. An
 * address naming no declared table answers 404, as a route-bound grid does —
 * "no such table" must not render as an empty facet, which reads as "a table
 * with no states". A name the address did not supply is only ever unknown in
 * a document built without the app's tables, and offers no options there.
 *
 * The reader's read rules apply: a reader who may not read the field is offered
 * none of its options, and the control keeps only its unset row.
 */

/** What resolving a binding needs about the request. */
export interface SelectOptionsFromContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly routeParams: Readonly<Record<string, string>>
}

/** The table name an address segment supplies, or the literal name. */
const tableNameOf = (table: string, routeParams: Readonly<Record<string, string>>) =>
  table.startsWith('$param.') ? routeParams[table.slice('$param.'.length)] : table

/** Whether a binding's table name came from the page address. */
const namedByAddress = (table: string, routeParams: Readonly<Record<string, string>>) =>
  table.startsWith('$param.') || Object.values(routeParams).includes(table)

/** One declared option, as the control offers it. */
const toOption = (option: unknown): OptionItem | undefined => {
  if (typeof option === 'string') return { value: option, label: option }
  if (typeof option !== 'object' || option === null) return undefined
  const { value, label } = option as { readonly value?: unknown; readonly label?: unknown }
  if (typeof value !== 'string') return undefined
  return { value, label: typeof label === 'string' ? label : value }
}

/**
 * Whether `field` is open to everyone under its table's field rules: no `read`
 * grant of its own, or `read: 'all'`. Asked of a signed-out visitor's principal,
 * the one caller the evaluator lets through only those two rungs — and for whom
 * the built-in default rules are inert, as they are for a field the table
 * leaves undeclared.
 */
const fieldOpenToEveryone = (table: TableLike, field: string, app: App): boolean =>
  isFieldReadableUnderFieldRules(
    app,
    table.name,
    { role: SIGNED_OUT_VISITOR_ROLE, groups: [] },
    field
  )

/**
 * Whether the reader may be shown `field`'s options. The options are the
 * field's declaration, not record data, so a reader the table's own read gate
 * turns away still sees them — unless the field itself is read-restricted: then
 * the reader must hold that grant, as the records API decides.
 */
function mayRead(table: TableLike, field: string, ctx: SelectOptionsFromContext): boolean {
  if (!ctx.app.auth) return true
  const plan = buildReadAccessPlan({
    app: ctx.app,
    table,
    principal: tableReadPrincipal(table, callerReaderFromSession(ctx.session, ctx.app)),
    policy: CANONICAL_READ_POLICY,
  })
  if (plan.allowed) return !plan.restrictedColumns.has(field)
  return fieldOpenToEveryone(table, field, ctx.app)
}

/** Sentinel for an address naming no declared table. */
const NOT_FOUND = Symbol('not-found')

/** The options one binding offers, or {@link NOT_FOUND}. */
function bindingOptions(
  binding: { readonly table?: unknown; readonly field?: unknown },
  ctx: SelectOptionsFromContext
): readonly OptionItem[] | typeof NOT_FOUND {
  if (typeof binding.table !== 'string' || typeof binding.field !== 'string') return []
  const name = tableNameOf(binding.table, ctx.routeParams)
  const table = (ctx.app.tables ?? []).find((candidate) => candidate.name === name)
  // A name the ADDRESS supplied — still `$param.`, or already substituted to a
  // route value — naming no table is the page's 404. Any other unknown name met
  // here belongs to a document rendered from an app carrying no `tables` at all
  // (a console viewport frame, which by construction holds no data): the
  // control is offered nothing, as a reader allowed no option would be.
  if (table === undefined) return namedByAddress(binding.table, ctx.routeParams) ? NOT_FOUND : []
  const field = table.fields.find((candidate) => candidate.name === binding.field)
  if (field === undefined || !CHOICE_FIELD_TYPES.has(field.type)) return []
  if (!mayRead(table as TableLike, field.name, ctx)) return []
  const declared = (field as { readonly options?: readonly unknown[] }).options ?? []
  return declared.flatMap((option) => {
    const resolved = toOption(option)
    return resolved === undefined ? [] : [resolved]
  })
}

/** A list of nodes, each walked; the same list when none changed. */
function resolveList(nodes: readonly unknown[], ctx: SelectOptionsFromContext): unknown {
  const walked = nodes.map((child) => resolveNode(child, ctx))
  if (walked.includes(NOT_FOUND)) return NOT_FOUND
  return walked.every((child, index) => child === nodes[index]) ? nodes : walked
}

/** A node's own options, when it declares `optionsFrom`. */
const ownOptions = (
  optionsFrom: unknown,
  ctx: SelectOptionsFromContext
): readonly OptionItem[] | typeof NOT_FOUND | undefined =>
  typeof optionsFrom === 'object' && optionsFrom !== null
    ? bindingOptions(optionsFrom as Record<string, unknown>, ctx)
    : undefined

/** A node rebuilt with its resolved options (omitted when empty) and children. */
function rebuilt(
  record: Readonly<Record<string, unknown>>,
  own: readonly OptionItem[] | undefined,
  children: unknown
): unknown {
  if (own === undefined) return children === record['children'] ? record : { ...record, children }
  const { optionsFrom: _resolved, ...rest } = record
  // Empty → the key is omitted rather than `[]`: the authored schema refuses an
  // empty list, and the control keeps its unset row.
  return {
    ...rest,
    ...(own.length > 0 ? { options: own } : {}),
    ...(children === undefined ? {} : { children }),
  }
}

/** One node, its `optionsFrom` resolved and every descendant walked. */
function resolveNode(node: unknown, ctx: SelectOptionsFromContext): unknown {
  if (Array.isArray(node)) return resolveList(node, ctx)
  if (typeof node !== 'object' || node === null) return node
  const record = node as Readonly<Record<string, unknown>>
  if ('$ref' in record || 'component' in record) return node
  const own = ownOptions(record['optionsFrom'], ctx)
  const children = resolveNode(record['children'], ctx)
  if (own === NOT_FOUND || children === NOT_FOUND) return NOT_FOUND
  return rebuilt(record, own, children)
}

/**
 * The page with every `optionsFrom` replaced by its options, or `undefined`
 * when an address names no declared table — the page's 404.
 */
export function resolveSelectOptionsFrom(
  page: Page,
  ctx: SelectOptionsFromContext
): Page | undefined {
  if (!page.components || page.components.length === 0) return page
  const components = resolveNode(page.components, ctx)
  if (components === NOT_FOUND) return undefined
  return components === page.components
    ? page
    : { ...page, components: components as Page['components'] }
}
