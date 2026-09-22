/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolving an author's declared option COLOURS, and the kanban columns that
 * read them, out of `app.tables`.
 *
 * Split out of `type-specific-props-builder.ts` when that file crossed its line
 * cap. The four functions below travel together — every one of them is either
 * `resolveFieldOptionColors` or a caller of it — so they make a module rather
 * than an arbitrary slice taken to get under a number.
 */

import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/** An option on a select/status field: a plain string, or a `{ value, color }` object. */
type FieldOption = string | { readonly value: string; readonly color?: string }

/**
 * Build an `optionValue → hex color` map from ONE named field's declared
 * options, or `undefined` when the field declares none.
 *
 * The single resolver behind every author-declared colour a page component
 * reads: the kanban column-header accents (keyed on `kanbanGroupBy.field`) and
 * the record views' `colorField`. They differ only in which field they name, so
 * they must not differ in how a declaration is read — a second resolver is how
 * "a status option's colour" ends up meaning two things on one page.
 *
 * Plain-string options (a bare `single-select`) carry no colour and yield
 * `undefined`, which is what keeps this an opt-in.
 */
export function resolveFieldOptionColors(
  table: Tables[number],
  fieldName: string | undefined
): Readonly<Record<string, string>> | undefined {
  if (!fieldName) return undefined
  const field = table.fields.find((f) => f.name === fieldName)
  if (!field || !('options' in field) || !Array.isArray(field.options)) return undefined
  const colored = (field.options as readonly FieldOption[]).flatMap((opt) =>
    typeof opt === 'string' || !opt.color ? [] : [[opt.value, opt.color] as const]
  )
  return colored.length > 0 ? Object.fromEntries(colored) : undefined
}

/**
 * Resolve the groupBy field's declared options from `app.tables`, or `undefined`
 * when the component has no `kanbanGroupBy.field` or the field carries no options.
 */
function resolveKanbanGroupByOptions(
  table: Tables[number],
  component: Component
): readonly FieldOption[] | undefined {
  const groupByField = (component as { kanbanGroupBy?: { field?: string } }).kanbanGroupBy?.field
  if (!groupByField) return undefined
  const groupField = table.fields.find((f) => f.name === groupByField)
  if (groupField && 'options' in groupField && Array.isArray(groupField.options)) {
    return groupField.options as readonly FieldOption[]
  }
  return undefined
}

/**
 * Resolve the kanban groupBy column options from `app.tables` so empty columns
 * (defined by select/status options but unused in the data) still render.
 *
 * Options are normalised to their string `value`: a `single-select` declares
 * plain strings, but a `status` field declares `{ value, color }` objects. The
 * board buckets/labels columns by string value only, so returning the raw object
 * makes each column key an object → React "object as child" crash. Mapping to
 * `.value` keeps `columnOptions` a `readonly string[]` for both field shapes.
 */
export function resolveKanbanColumnOptions(
  table: Tables[number],
  component: Component
): readonly string[] | undefined {
  const options = resolveKanbanGroupByOptions(table, component)
  return options?.map((opt) => (typeof opt === 'string' ? opt : opt.value))
}

/**
 * Resolve a `columnValue → hex color` map from a colored `status` groupBy field,
 * so each column can surface its option color as a header accent. Returns
 * `undefined` for plain string options (a `single-select`), which carry no color.
 */
export function resolveKanbanColumnColors(
  table: Tables[number],
  component: Component
): Readonly<Record<string, string>> | undefined {
  const groupByField = (component as { kanbanGroupBy?: { field?: string } }).kanbanGroupBy?.field
  return resolveFieldOptionColors(table, groupByField)
}

/**
 * Resolve the swimlane field's declared options from `app.tables`, so a lane
 * declared on the field but unused by the data still renders.
 *
 * The lane axis' counterpart to {@link resolveKanbanColumnOptions}, and
 * deliberately its twin down to the `.value` normalisation: `swimlanes`
 * inherits the column axis' ordering semantics wholesale, and two resolvers
 * reading a field's options two different ways is exactly how that stops being
 * true. Lane COLOURS have no counterpart — a lane is a band, not a chip, and
 * `KanbanSwimlanesSchema` declares no colour key to read.
 */
export function resolveKanbanSwimlaneOptions(
  table: Tables[number],
  component: Component
): readonly string[] | undefined {
  const laneField = (component as { swimlanes?: { field?: string } }).swimlanes?.field
  if (!laneField) return undefined
  const field = table.fields.find((f) => f.name === laneField)
  if (!field || !('options' in field) || !Array.isArray(field.options)) return undefined
  return (field.options as readonly FieldOption[]).map((opt) =>
    typeof opt === 'string' ? opt : opt.value
  )
}
