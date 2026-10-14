/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../../runtime/types'
import type { ServerFilterCondition } from '../island/island-setup-helpers'

/** The values checked in each facet, by field. A facet with none is absent. */
export type FacetSelections = Readonly<Record<string, readonly string[]>>

/** The facets holding at least one checked value. */
const activeFacets = (selections: FacetSelections): ReadonlyArray<[string, readonly string[]]> =>
  Object.entries(selections).filter(([, values]) => values.length > 0)

/**
 * Keep the rows holding, for every facet with a checked value, ANY of its
 * checked values: one "is any of" per facet, and the facets ANDed.
 *
 * Applied to every grid, server-narrowed or not: on rows the server already
 * narrowed by the same conditions it removes nothing, so the browser and the
 * server can never disagree about what a facet shows.
 */
export function applyFacetFilters(
  records: readonly TableRecord[],
  selections: FacetSelections
): readonly TableRecord[] {
  const facets = activeFacets(selections)
  if (facets.length === 0) return records
  return records.filter((record) =>
    facets.every(([field, values]) => values.includes(String(record[field] ?? '')))
  )
}

/** Each facet with a checked value as the records API's `in` condition. */
export const toServerFacetConditions = (
  selections: FacetSelections
): readonly ServerFilterCondition[] =>
  activeFacets(selections).map(([field, values]) => ({ field, operator: 'in', value: values }))

/** The selections with `value` toggled in the facet on `field`. */
export function toggleFacetValue(
  selections: FacetSelections,
  field: string,
  value: string
): FacetSelections {
  const current = selections[field] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  const rest = clearFacet(selections, field)
  return next.length === 0 ? rest : { ...rest, [field]: next }
}

/** The selections with the facet on `field` emptied. */
export function clearFacet(selections: FacetSelections, field: string): FacetSelections {
  return Object.fromEntries(Object.entries(selections).filter(([key]) => key !== field))
}
