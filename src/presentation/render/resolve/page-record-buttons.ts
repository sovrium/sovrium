/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { walkComponentSlots, type ComponentListEntry } from './component-slot-walk'
import type { Component } from '@/domain/models/app/pages/components'

type Node = Readonly<Record<string, unknown>>

/** Whether `component` is a button whose `crud` action writes a record of `tableName`. */
const actsOnTable = (component: Component, tableName: string): boolean => {
  if (component.type !== 'button') return false
  const action = (component as { readonly action?: unknown }).action as Node | undefined
  return action?.['type'] === 'crud' && action['table'] === tableName
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
  if (component.dataSource !== undefined) return component
  if (actsOnTable(component, tableName)) {
    const props = (component.props ?? {}) as Node
    return props['_record'] !== undefined
      ? component
      : ({ ...component, props: { ...props, _record: { id: record['id'] } } } as Component)
  }
  const walk = (entries: readonly ComponentListEntry[]): readonly ComponentListEntry[] =>
    entries.map((entry) =>
      typeof entry === 'string' ? entry : bindPageRecordToButtons(entry, record, tableName)
    )
  return component.children === undefined
    ? { ...component, ...walkComponentSlots(component, walk) }
    : { ...component, ...walkComponentSlots(component, walk), children: walk(component.children) }
}
