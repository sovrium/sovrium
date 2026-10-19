/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { parseJsonArrayCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * The key a `button`'s node carries the record's current value of its
 * `editSelect.field` under, once a record has been substituted into it. Read
 * by the renderer (`button-edit-select.ts`), which pre-fills the picker with
 * it. Top-level on the node rather than in `props`, so it is never spread onto
 * the element.
 */
export const EDIT_SELECT_CURRENT_KEY = '_editSelectCurrent'

type Node = Readonly<Record<string, unknown>>

/** The edited field of a button's picker, or `undefined` for any other node. */
const pickerOf = (
  component: Node
): { readonly field: string; readonly multiple: boolean } | undefined => {
  if (component['type'] !== 'button') return undefined
  const editSelect = component['editSelect'] as
    { readonly field?: unknown; readonly multiple?: unknown } | undefined
  return typeof editSelect?.field === 'string'
    ? { field: editSelect.field, multiple: editSelect.multiple === true }
    : undefined
}

/**
 * The record's value of the edited field. A list is read as a list on both
 * engines: SQLite hands a multi-select back as its JSON text.
 */
const currentValueOf = (record: Node, field: string, multiple: boolean): unknown => {
  const stored = record[field] ?? null
  return multiple ? (parseJsonArrayCell(stored) ?? stored) : stored
}

/** `$record.<field>` written as itself, unescaped and not the start of a longer name. */
const fieldReference = (field: string): RegExp =>
  new RegExp(`(?<!\\\\)\\$record\\.${field.replace(/\W/g, '')}(?!\\w)`, 'g')

/**
 * A button picker's node, ready for the record to be substituted into it.
 *
 * Two things a plain substitution would get wrong. The action's
 * `$record.<field>` is the PICK, known only when the reader picks, so it is
 * escaped here and survives the substitution as the token itself, for the
 * browser to fill (`fetch-button-runtime.ts`); every other `$record` value is
 * the record's, filled now as on any button. And the picker opens on the
 * record's current value, which the substitution would otherwise print into
 * strings and drop, so it is kept on the node under
 * {@link EDIT_SELECT_CURRENT_KEY}.
 *
 * Applied on every substitution pass, so the binding nearest the button
 * decides: an outer pass consumes its escape and leaves the bare token, which
 * the row's own pass escapes again and stamps with the row's value. Every other
 * node is returned as it is.
 */
export const withEditSelectRecord = (component: Component, record: Node): Component => {
  const node = component as Node
  const picker = pickerOf(node)
  if (picker === undefined) return component
  const reference = fieldReference(picker.field)
  return {
    ...component,
    ...(node['action'] !== undefined && {
      action: mapStringsDeep(node['action'], (value) =>
        value.replace(reference, (token) => `\\${token}`)
      ),
    }),
    [EDIT_SELECT_CURRENT_KEY]: currentValueOf(record, picker.field, picker.multiple),
  } as Component
}

/**
 * The same for a picker on a page bound to one record, whose components are
 * substituted by the collection template (`data-source-rows.ts`): that pass
 * leaves an action's strings alone, so here the picker's action is filled
 * from the record — its field's token kept for the pick — and spread with the
 * record's value over the node. Empty for any other node.
 */
export const editSelectRecordPatch = (
  component: Node,
  record: Node
): Readonly<Record<string, unknown>> => {
  if (pickerOf(component) === undefined) return {}
  const { action, ...rest } = withEditSelectRecord(component as Component, record) as Node
  return {
    ...(action !== undefined && {
      action: mapStringsDeep(action, (value) => substituteRecordVars(value, record)),
    }),
    [EDIT_SELECT_CURRENT_KEY]: rest[EDIT_SELECT_CURRENT_KEY],
  }
}
