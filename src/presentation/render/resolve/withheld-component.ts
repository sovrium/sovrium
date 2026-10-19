/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a record component becomes over a table its visitor may not read.
 *
 * A board, a calendar, a gallery, a chart, a timeline and a record drawer all
 * mount an island whose props are built from their binding and from the
 * table's declaration — the date fields, the axis fields, a group field's
 * options, every field of a drawer with its type. Those props are written into
 * the page, so over a table the records API refuses the visitor the component
 * is WITHHELD: it leaves the page entirely, island and configuration alike.
 *
 * A KPI keeps its card. Its label is the author's words, not the table's, and
 * a public KPI whose visitor cannot read the records still shows its label and
 * a neutral value; it loses everything else — its binding, its aggregate and
 * its format — and its renderer draws the static card from the marker.
 */

import type { Component } from '@/domain/models/app/pages/components'

/** The marker a withheld component carries from the resolver to the renderer. */
export const READ_WITHHELD_MARKER = '_readWithheld'

/** The record components whose island would carry the table's shape. */
const WITHHELD_TYPES: ReadonlySet<string> = new Set([
  'kanban',
  'event-calendar',
  'gallery',
  'carousel',
  'chart',
  'timeline',
  'sheet',
  'kpi',
])

/** True for a type that is withheld, rather than emptied, over an unreadable table. */
export function isWithheldOverUnreadableTable(component: Component): boolean {
  return WITHHELD_TYPES.has(component.type)
}

/** The author's `data-testid`, the one prop a withheld KPI card keeps. */
function testIdOf(component: Component): Record<string, unknown> {
  const testId = (component.props as Record<string, unknown> | undefined)?.['data-testid']
  return testId === undefined ? {} : { 'data-testid': testId }
}

/**
 * The withheld shape of `component`: a KPI's static card (its label, nothing
 * of the table), or a marked node {@link dropWithheld} removes from the page.
 */
export function withheldComponent(component: Component): Component {
  const { label } = component as { readonly label?: unknown }
  return {
    type: component.type,
    ...(component.id !== undefined && { id: component.id }),
    ...(component.type === 'kpi' && label !== undefined && { label }),
    props: { ...testIdOf(component), [READ_WITHHELD_MARKER]: true },
  } as Component
}

/** True for a node {@link withheldComponent} marked to leave the page. */
export function isDroppedWithheld(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false
  const { type, props } = node as { readonly type?: unknown; readonly props?: unknown }
  return (
    type !== 'kpi' &&
    typeof props === 'object' &&
    props !== null &&
    (props as Record<string, unknown>)[READ_WITHHELD_MARKER] === true
  )
}

/**
 * True for any node {@link withheldComponent} marked — a KPI's static card
 * included — which no later pass resolves further.
 */
export function isReadWithheld(node: unknown): boolean {
  if (typeof node !== 'object' || node === null) return false
  const { props } = node as { readonly props?: unknown }
  return (
    typeof props === 'object' &&
    props !== null &&
    (props as Record<string, unknown>)[READ_WITHHELD_MARKER] === true
  )
}

/**
 * Returns a permission-denied data-bound component with no children or data.
 *
 * A `table` is reduced further, to its unbound (static) shape with no headers
 * and no rows. Dropping the children is enough for a binding whose rows the
 * server expands, but a grid's rows arrive through its island, and the island
 * props are built from the binding itself: the table name, the author's columns
 * and the field catalogue read out of `app.tables`. A grid the caller may not
 * read therefore mounted anyway, printed the column names of a table the
 * records API refuses them, and offered its toolbar. Without a `dataSource` the
 * renderer takes the static branch, which emits none of that.
 *
 * A board, a calendar, a gallery, a chart, a timeline, a drawer and a KPI are
 * withheld instead ({@link withheldComponent}): their islands are built from the
 * table's declaration, so they leave the page — a KPI keeping its label.
 */
export function emptyDataBoundComponent(component: Component): Component {
  if (isWithheldOverUnreadableTable(component)) return withheldComponent(component)
  // A record the page handed down (`_record`) leaves with the binding: a form
  // the caller may not read renders empty, not prefilled from the page.
  const { _record: _withheld, ...ownProps } = (component.props ?? {}) as Record<string, unknown>
  const props = { ...ownProps, _dataSourceBound: true }
  if (component.type === 'table') {
    return { type: component.type, ...(component.id && { id: component.id }), props } as Component
  }
  return { ...component, children: undefined, props }
}
