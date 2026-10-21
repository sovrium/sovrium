/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Baserow views, as the workspace export writes them: a grid's filters, its
 * sorts and the fields it shows. A Baserow view lists a field option only
 * once someone touched it, so a field with no option row is shown, at
 * Baserow's default order. Only a grid becomes a table view; every other kind
 * is reported by the mapper.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { idOf, type Json } from './baserow-field-service'
import type { CanonicalField, CanonicalTable } from './canonical-base'

type CanonicalView = CanonicalTable['views'][number]

/** The view kinds a Baserow view type is read as. */
const VIEW_KINDS: Readonly<Record<string, CanonicalView['kind']>> = {
  grid: 'grid',
  gallery: 'gallery',
  form: 'form',
  kanban: 'kanban',
  calendar: 'calendar',
  timeline: 'timeline',
}

/** Baserow's order for a field with no option row of its own, which shows it. */
const DEFAULT_ORDER = 32_767

/**
 * The fields a view shows: the primary field first, then every other field
 * the view does not hide, in the view's order (a field with no option row is
 * shown, at the default order), ties in table order.
 */
const visibleFieldsOf = (view: Json, fields: readonly CanonicalField[]): readonly string[] => {
  const options = new Map(
    arrayOf(view['field_options'])
      .filter(isRecord)
      .flatMap((option) => {
        const id = idOf(option['field_id'])
        return id === undefined ? [] : [[id, option] as const]
      })
  )
  const primary = fields.filter((field) => field.primary === true)
  const others = fields
    .map((field, index) => ({ field, index, option: options.get(field.sourceId) }))
    .filter((one) => one.field.primary !== true && one.option?.['hidden'] !== true)
    .toSorted(
      (a, b) =>
        Number(a.option?.['order'] ?? DEFAULT_ORDER) -
          Number(b.option?.['order'] ?? DEFAULT_ORDER) || a.index - b.index
    )
    .map((one) => one.field)
  return [...primary, ...others].map((field) => field.sourceId)
}

/** One serialized Baserow view as a canonical view. */
export const baserowView = (
  view: Json,
  fields: readonly CanonicalField[]
): CanonicalView | undefined => {
  const sourceId = idOf(view['id'])
  if (sourceId === undefined) return undefined
  const type = typeof view['type'] === 'string' ? view['type'] : ''
  return {
    sourceId,
    name: typeof view['name'] === 'string' && view['name'] !== '' ? view['name'] : sourceId,
    kind: VIEW_KINDS[type] ?? 'other',
    filters: arrayOf(view['filters'])
      .filter(isRecord)
      .flatMap((filter) => {
        const field = idOf(filter['field'])
        return field === undefined
          ? []
          : [{ field, operator: String(filter['type'] ?? ''), value: filter['value'] }]
      }),
    sorts: arrayOf(view['sortings'])
      .filter(isRecord)
      .flatMap((sort) => {
        const field = idOf(sort['field'])
        return field === undefined
          ? []
          : [{ field, direction: sort['order'] === 'DESC' ? ('desc' as const) : ('asc' as const) }]
      }),
    visibleFields: visibleFieldsOf(view, fields),
  }
}
