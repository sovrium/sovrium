/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A board, a calendar, a timeline, a chart or a KPI, as its reader may see
 * it, on a table she may read.
 *
 * Each of them names fields of its table in its own configuration — the field
 * a board lays its columns out by, the one a calendar colours its events by,
 * the axis a chart groups by — and its island props carry that configuration
 * and what the server derives from it: the field's option labels, their
 * colours, its day-valued date fields. All of it is written into the page. So
 * a field the reader may not read (`readableFieldsOf`, the records API's own
 * answer) is a DIMENSION the component drops for her: the board is drawn
 * ungrouped, the events and bars uncoloured, the footer without that item —
 * and neither the field's name nor any of its options reaches the page.
 *
 * A dimension the component cannot be drawn without leaves it with nothing
 * meaningful to show, and it is WITHHELD exactly as over a table she may not
 * read (`withheld-component.ts`): a calendar whose date field she may not
 * read, a timeline whose start field she may not read, a chart whose category
 * or plotted value she may not read.
 *
 * Without a stamp — no auth, or a render outside the page route funnel — the
 * component is returned as written.
 */

import { readableFieldsForComponent } from './caller-table-inputs'
import type { CallerTableView } from '@/application/ports/services/page-renderer'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

type Bag = Readonly<Record<string, unknown>>

/** `true` for a declared field of the table its reader may not read. */
type IsHidden = (field: unknown) => boolean

/** The component, or the answer that it must leave the page. */
export type RecordViewForReader = Component | 'withheld'

const bagOf = (value: unknown): Bag | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Bag) : undefined

/** `bag` without `key`, when the field `key` names is hidden from the reader. */
const withoutHidden = (bag: Bag, key: string, isHidden: IsHidden): Bag => {
  if (!isHidden(bag[key])) return bag
  const { [key]: _hidden, ...rest } = bag
  return rest
}

/** `bag` without the keys naming hidden fields. */
const withoutHiddenKeys = (bag: Bag, keys: readonly string[], isHidden: IsHidden): Bag =>
  keys.reduce((acc, key) => withoutHidden(acc, key, isHidden), bag)

/** A nested object dropped whole when its own `field` is hidden. */
const withoutHiddenAxis = (bag: Bag, key: string, isHidden: IsHidden): Bag => {
  if (!isHidden(bagOf(bag[key])?.['field'])) return bag
  const { [key]: _hidden, ...rest } = bag
  return rest
}

/** A list of `{ field }` entries less those naming a hidden field. */
const withoutHiddenEntries = (entries: unknown, isHidden: IsHidden): unknown =>
  Array.isArray(entries) ? entries.filter((entry) => !isHidden(bagOf(entry)?.['field'])) : entries

/** The binding's own projection less the hidden fields. */
function bindingForReader(component: Bag, isHidden: IsHidden): Bag {
  const dataSource = bagOf(component['dataSource'])
  const fields = dataSource?.['fields']
  if (dataSource === undefined || !Array.isArray(fields)) return component
  return { ...component, dataSource: { ...dataSource, fields: fields.filter((f) => !isHidden(f)) } }
}

/**
 * A board's column axis for the reader: an empty `kanbanGroupBy` — present,
 * naming no field — when its field is hidden, which the island draws as ONE
 * column holding every card (an absent `kanbanGroupBy` stays the author's
 * missing-configuration notice). Its `collapsed` values go with it: they are
 * the hidden field's options. One column leaves no column to drag a card to.
 */
const ungroupedWhenHidden = (component: Bag, isHidden: IsHidden): Bag =>
  isHidden(bagOf(component['kanbanGroupBy'])?.['field'])
    ? { ...component, kanbanGroupBy: {}, drag: { enabled: false } }
    : component

/** A board: ungrouped, un-laned and uncoloured by a hidden field; its footer without it. */
function kanbanForReader(component: Bag, isHidden: IsHidden): Bag {
  const card = bagOf(component['card'])
  const laidOut = withoutHiddenAxis(
    ungroupedWhenHidden(withoutHidden(component, 'colorField', isHidden), isHidden),
    'swimlanes',
    isHidden
  )
  if (card === undefined) return laidOut
  const cardForReader = withoutHidden(card, 'colorField', isHidden)
  return {
    ...laidOut,
    card:
      cardForReader['footer'] === undefined
        ? cardForReader
        : { ...cardForReader, footer: withoutHiddenEntries(cardForReader['footer'], isHidden) },
  }
}

/** A calendar: withheld without its date field, otherwise without the hidden ones. */
function calendarForReader(component: Bag, isHidden: IsHidden): Bag | 'withheld' {
  if (isHidden(component['dateField'])) return 'withheld'
  return withoutHiddenKeys(component, ['endDateField', 'labelField', 'colorField'], isHidden)
}

/** A timeline: withheld without its start field, otherwise without the hidden ones. */
function timelineForReader(component: Bag, isHidden: IsHidden): Bag | 'withheld' {
  const props = bagOf(component['props']) ?? {}
  if (isHidden(props['startField'])) return 'withheld'
  const keys = ['endField', 'labelField', 'groupBy', 'colorField', 'dependencyField']
  return { ...component, props: withoutHiddenKeys(props, keys, isHidden) }
}

/** `true` when a chart's category or its plotted value is a hidden field. */
function chartAxisHidden(component: Bag, isHidden: IsHidden): boolean {
  const aggregate = bagOf(component['chartAggregate'])
  const category = aggregate?.['groupBy'] ?? bagOf(component['xAxis'])?.['field']
  const value = aggregate === undefined ? bagOf(component['yAxis'])?.['field'] : aggregate['field']
  return isHidden(category) || isHidden(value)
}

/**
 * A chart: withheld when its category or its plotted value is hidden — the
 * island has no ungrouped drawing — otherwise without the hidden series.
 */
function chartForReader(component: Bag, isHidden: IsHidden): Bag | 'withheld' {
  if (chartAxisHidden(component, isHidden)) return 'withheld'
  const { series } = component
  if (!Array.isArray(series) || series.length === 0) return component
  const readable = withoutHiddenEntries(series, isHidden) as readonly unknown[]
  return readable.length === 0 ? 'withheld' : { ...component, series: readable }
}

/**
 * A KPI: withheld — its label kept, as over a table she may not read — when
 * the field it aggregates is hidden. Without its field the island would fall
 * back to a count, printing a number under a label that promises another.
 */
function kpiForReader(component: Bag, isHidden: IsHidden): Bag | 'withheld' {
  return isHidden(bagOf(component['kpiAggregate'])?.['field']) ? 'withheld' : component
}

const FOR_READER: Readonly<Record<string, (c: Bag, isHidden: IsHidden) => Bag | 'withheld'>> = {
  kpi: kpiForReader,
  kanban: kanbanForReader,
  calendar: calendarForReader,
  timeline: timelineForReader,
  chart: chartForReader,
}

/** True for a component type this module narrows. */
export function isRecordViewForReader(component: Component): boolean {
  return FOR_READER[component.type] !== undefined
}

/**
 * The component as `callerTable`'s reader may see it — see the module header —
 * or `'withheld'` when a field it cannot be drawn without is hidden from her.
 */
export function recordViewForReader(
  component: Component,
  table: Tables[number],
  callerTable: CallerTableView | undefined
): RecordViewForReader {
  const narrow = FOR_READER[component.type]
  if (narrow === undefined || callerTable === undefined) return component
  const readable = new Set(readableFieldsForComponent(table, component, callerTable))
  const declared = new Set(table.fields.map((f) => f.name))
  const isHidden: IsHidden = (field) =>
    typeof field === 'string' && declared.has(field) && !readable.has(field)
  const narrowed = narrow(bindingForReader(component as Bag, isHidden), isHidden)
  return narrowed === 'withheld' ? 'withheld' : (narrowed as Component)
}
