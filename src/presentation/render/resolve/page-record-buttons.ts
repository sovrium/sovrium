/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  componentField,
  entryAsComponent,
  keyOf,
  rewriteComponent,
  type RenderProps,
} from './component-rewrite'
import { walkComponentSlots, type ComponentListEntry } from './component-slot-walk'
import type { Component } from '@/domain/models/app/pages/components'

type Node = Readonly<Record<string, unknown>>

/** Whether `component` is a button whose `crud` action writes a record of `tableName`. */
const actsOnTable = (component: Component, tableName: string): boolean => {
  if (component.type !== 'button') return false
  const action = componentField(component, 'action')
  return keyOf(action, 'type') === 'crud' && keyOf(action, 'table') === tableName
}

/**
 * A page bound to one record hands that record's id to every `crud` button on
 * its table placed in the page — an update writes the page's record, a delete
 * removes it — as a row template hands its row to the buttons of each row.
 *
 * The id is read from the bound record, never from a route parameter: the
 * segment that names the record need not be called `id`, nor hold the id. A
 * node carrying its own `dataSource` is not entered (its children read their
 * own records), and a button that already holds a record keeps it.
 */
export function bindPageRecordToButtons(
  component: Component,
  record: Node,
  tableName: string
): Component {
  if (componentField(component, 'dataSource') !== undefined) return component
  return bindRecordToButtonsWithin(component, record, tableName)
}

/**
 * A component bound to one record by its own `dataSource` (`mode: 'single'`)
 * hands that record's id to the `crud` buttons on its table placed inside it,
 * as a page bound to one record does: the button writes the component's record,
 * not the page's and not the table's first row. The bound node itself is
 * entered; a node nested in it with its own `dataSource` is not.
 */
export function bindRecordToButtonsWithin(
  component: Component,
  record: Node,
  tableName: string
): Component {
  if (actsOnTable(component, tableName)) {
    const props: RenderProps = component.props ?? {}
    return props['_record'] !== undefined
      ? component
      : rewriteComponent(component, { props: { ...props, _record: { id: record['id'] } } })
  }
  const walk = (entries: readonly ComponentListEntry[]): readonly ComponentListEntry[] =>
    entries.map((entry) =>
      typeof entry === 'string'
        ? entry
        : bindPageRecordToButtons(entryAsComponent(entry), record, tableName)
    )
  return component.children === undefined
    ? rewriteComponent(component, walkComponentSlots(component, walk))
    : rewriteComponent(component, {
        ...walkComponentSlots(component, walk),
        children: walk(component.children),
      })
}
