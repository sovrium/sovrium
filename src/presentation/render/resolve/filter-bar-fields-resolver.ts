/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { nameInWords } from '@/domain/kernel/format/name-in-words'
import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import {
  optionLabel,
  optionValue,
  type SelectOptionLike,
} from '@/domain/models/app/tables/select-option'
import { isWriteOnlyField } from '@/domain/models/app/tables/write-only-field-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Pre-render resolver for a `filter-bar`'s `fieldsFrom: { table }`.
 *
 * The bar's island reads a concrete `fields` list; `fieldsFrom` names a table
 * instead, so this pass writes that list out — one entry per declared field of
 * the table, in declaration order — and drops `fieldsFrom`, so the table name
 * never reaches the browser. It runs inside the option-source pass, before a
 * field's own `optionsSource` would be resolved, so both reach the renderer as
 * the plain `fields` the island already draws.
 *
 * A field the reader may not read is not offered: the bar would otherwise name
 * a column the records API refuses to filter on for this reader, and the name
 * itself would leak. The gate is the records API's own read plan, as the
 * option-source pass uses it; a table the reader may not read offers nothing.
 */

/** What the island needs to know about one field. */
interface BarField {
  readonly name: string
  /** The field's declared label, else its name in words: `annual_revenue` reads "Annual revenue". */
  readonly label: string
  readonly kind: 'text' | 'number' | 'date' | 'select'
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  /** A link's choices: the related table's rows, resolved by the option-source pass. */
  readonly optionsSource?: {
    readonly table: string
    readonly displayField: string
    readonly sort: ReadonlyArray<{ readonly field: string; readonly direction: 'asc' }>
  }
}

/**
 * A many-to-one link, offered as a choice among the related table's rows by
 * their display field ("Client is any of Garage de la Gare"): the stored value
 * is the related row's id, which the records API compares as it is. The rows
 * are read for THIS reader by the option-source pass that runs right after
 * (`optionsSource`), so a related table the reader may not read offers no
 * choice. A link with no `displayField` names no readable choice and is left
 * out, as are the other relation shapes, which store no column to compare.
 */
const linkBarField = (
  field: Readonly<Record<string, unknown>>,
  name: string,
  label: string
): BarField | undefined => {
  const { relatedTable, displayField, relationType } = field
  if (relationType !== 'many-to-one' || typeof relatedTable !== 'string') return undefined
  if (typeof displayField !== 'string') return undefined
  return {
    name,
    label,
    kind: 'select',
    optionsSource: {
      table: relatedTable,
      displayField,
      sort: [{ field: displayField, direction: 'asc' }],
    },
  }
}

/** Field type → the kind the bar offers operators for; anything absent is text. */
const KIND_OF_TYPE: ReadonlyMap<string, BarField['kind']> = new Map([
  ['integer', 'number'],
  ['decimal', 'number'],
  ['number', 'number'],
  ['currency', 'number'],
  ['percentage', 'number'],
  ['progress', 'number'],
  ['rating', 'number'],
  ['duration', 'number'],
  ['date', 'date'],
  ['datetime', 'date'],
  ['time', 'date'],
  ['created-at', 'date'],
  ['updated-at', 'date'],
  ['single-select', 'select'],
  ['multi-select', 'select'],
  ['status', 'select'],
  ['checkbox', 'select'],
])

/** The two values a checkbox holds, as the records API compares them. */
const CHECKBOX_OPTIONS = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
] as const

/** One declared table field as a bar field, or `undefined` when it offers nothing to compare. */
const toBarField = (field: Readonly<Record<string, unknown>>): BarField | undefined => {
  const name = String(field['name'])
  const { label: declaredLabel } = field
  const label = typeof declaredLabel === 'string' ? declaredLabel : nameInWords(name)
  if (field['type'] === 'relationship') return linkBarField(field, name, label)
  const kind = KIND_OF_TYPE.get(String(field['type'])) ?? 'text'
  if (field['type'] === 'checkbox') return { name, label, kind, options: CHECKBOX_OPTIONS }
  const declared = field['options']
  if (kind !== 'select' || !Array.isArray(declared) || declared.length === 0) {
    return { name, label, kind }
  }
  const options = (declared as readonly SelectOptionLike[]).map((option) => ({
    value: optionValue(option),
    label: optionLabel(option),
  }))
  return { name, label, kind, options }
}

/** The names of `table`'s fields this reader may read; none when the table is closed to them. */
const readableFieldNames = (
  app: App,
  table: TableLike,
  session: SessionInfo | undefined
): ReadonlySet<string> => {
  const names = table.fields.map((field) => field.name)
  const open = names.filter((name) => !isWriteOnlyField(app, table.name, name))
  if (!app.auth) return new Set(open)
  const plan = buildReadAccessPlan({
    app,
    table,
    principal: tableReadPrincipal(table, callerReaderFromSession(session, app)),
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return new Set()
  return new Set(open.filter((name) => !plan.restrictedColumns.has(name)))
}

/** The bar fields `tableName` offers this reader, in declaration order. */
export function filterBarFieldsOf(
  app: App,
  tableName: string,
  session: SessionInfo | undefined
): readonly BarField[] {
  const table = (app.tables ?? []).find((candidate) => candidate.name === tableName)
  if (table === undefined) return []
  const readable = readableFieldNames(app, table as TableLike, session)
  return (table.fields as ReadonlyArray<Readonly<Record<string, unknown>>>)
    .filter((field) => readable.has(String(field['name'])))
    .flatMap((field) => {
      const barField = toBarField(field)
      return barField === undefined ? [] : [barField]
    })
}

/**
 * `component` with a filter bar's `fieldsFrom` written out as `fields`; any
 * other node, or a bar that declares its `fields`, is returned as is.
 */
export function withFilterBarFields(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  if (component.type !== 'filter-bar') return component
  const { fieldsFrom, ...rest } = component as Component & { readonly fieldsFrom?: unknown }
  if (typeof fieldsFrom !== 'object' || fieldsFrom === null) return component
  const { table } = fieldsFrom as { readonly table?: unknown }
  if (typeof table !== 'string') return rest as Component
  return { ...rest, fields: filterBarFieldsOf(ctx.app, table, ctx.session) } as Component
}
