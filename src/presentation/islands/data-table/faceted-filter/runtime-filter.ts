/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { toServerFilterGroup, type ServerFilterGroup } from '../island/island-setup-helpers'
import { toServerFacetConditions, type FacetSelections } from './facet-filters'
import type { FilterConjunction, FilterRow } from '../island/use-ui-state'
import type { PaginationState } from '@tanstack/react-table'

/** What the reader narrowed the rows by, as the records API reads it. */
export interface RuntimeFilter {
  /** The filter-builder rows and the facets, ANDed; absent when neither narrows. */
  readonly filter: ServerFilterGroup | undefined
  /** The builder's rows travel with the request, so the browser must not apply them again. */
  readonly builderOnServer: boolean
  /** Changes whenever the narrowing does: a feed key, and the trigger of a page reset. */
  readonly key: string
}

/**
 * The reader's narrowing as one server filter, for every grid bound to a table:
 * filtering only the rows in hand would hide every match on a page not
 * fetched, and leave the pager and the summary counting the unfiltered table.
 * A builder row the API cannot express keeps the builder in the browser, while
 * the facets still narrow on the server: they always have a server spelling.
 */
export function resolveRuntimeFilter(
  rows: readonly FilterRow[],
  conjunction: FilterConjunction,
  selections: FacetSelections
): RuntimeFilter {
  const builder = toServerFilterGroup(rows, conjunction)
  const facets = toServerFacetConditions(selections)
  const filter =
    facets.length === 0 ? builder : { and: builder === undefined ? facets : [builder, ...facets] }
  return {
    filter,
    builderOnServer: builder !== undefined,
    key: JSON.stringify([builder ?? rows, conjunction, selections]),
  }
}

/**
 * The reader's narrowing for this grid, with the page reset it drives. A grid
 * bound to a read endpoint sends none: it is narrowed in the browser.
 */
export function useRuntimeFilter(
  ui: {
    readonly activeFilters: readonly FilterRow[]
    readonly filterConjunction: FilterConjunction
    readonly facetSelections: FacetSelections
  },
  systemBound: boolean,
  setPagination: (updater: (previous: PaginationState) => PaginationState) => void
): RuntimeFilter {
  const runtime = resolveRuntimeFilter(ui.activeFilters, ui.filterConjunction, ui.facetSelections)
  usePageResetOnNarrowing(runtime.key, setPagination)
  return systemBound ? { filter: undefined, builderOnServer: false, key: runtime.key } : runtime
}

/**
 * Back to the first page whenever the narrowing changes, so a numbered grid
 * never asks for a page past the end of the narrowed set.
 */
export function usePageResetOnNarrowing(
  key: string,
  setPagination: (updater: (previous: PaginationState) => PaginationState) => void
): void {
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    setPagination((current) => (current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }))
  }, [key, setPagination])
}
