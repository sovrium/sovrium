/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a grid bound to one of its table's views (`dataSource.view`) is told
 * about that table.
 *
 * The island payload is public: it is serialised into the page, and a page
 * bound to a public view is read by visitors who hold no account. A table-bound
 * grid ships every field of the table in `tableFields`/`fieldMeta`, the whole
 * `views` catalogue in `tableViews`, and the table's permission block in
 * `tablePermissions` — each of which can name a column the view withholds (the
 * catalogue lists other views' `fields`; a field grant names its field). So a
 * view-bound grid is told only the view's own columns, and neither the
 * catalogue nor the permissions: it is read-only, and nothing it offers needs
 * them.
 */

import { findViewByKey } from '@/domain/models/app/tables/views/view-read-service'
import type { TypeSpecificResolvedInputs } from './type-specific-props-builder'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

type BoundView = NonNullable<Tables[number]['views']>[number]

/** The declared view a component's `dataSource.view` names, by id or name. */
export function resolveBoundView(
  component: Component,
  table: Tables[number]
): BoundView | undefined {
  const source = 'dataSource' in component ? component.dataSource : undefined
  const key =
    typeof source === 'object' && source !== null && 'view' in source ? source.view : undefined
  return typeof key === 'string' ? findViewByKey(table.views, key) : undefined
}

/** Whether a grid's data source reads through a view — the read-only switch the island honours. */
export function isViewBoundSource(dataSource: unknown): boolean {
  return (
    typeof dataSource === 'object' &&
    dataSource !== null &&
    typeof (dataSource as { readonly view?: unknown }).view === 'string'
  )
}

/**
 * The resolved grid inputs, narrowed to what a view-bound grid may be told:
 * the view's own columns (all of the table's when the view lists none), and
 * no views catalogue or permission block. `maskedFields` is the view's column
 * list as its route answers the grid's reader (`boundViewFieldsOf`), which
 * names no field she may not read — and, when given, is final: an empty list
 * is a reader the view's route refuses (or one who reads none of its fields),
 * and names nothing. Only the view's OWN empty list means "every column".
 */
export function narrowToBoundView(
  inputs: TypeSpecificResolvedInputs,
  view: BoundView,
  maskedFields?: readonly string[]
): TypeSpecificResolvedInputs {
  const listed = maskedFields ?? view.fields
  const everyColumn = maskedFields === undefined && (listed === undefined || listed.length === 0)
  const keep = everyColumn
    ? (name: string) => (inputs.dataTableTableFields ?? []).includes(name)
    : (name: string) => (listed ?? []).includes(name)
  return {
    ...inputs,
    dataTableTableFields: inputs.dataTableTableFields?.filter(keep),
    dataTableFieldMeta:
      inputs.dataTableFieldMeta === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(inputs.dataTableFieldMeta).filter(([name]) => keep(name))
          ),
    dataTablePermissions: undefined,
    dataTableViews: undefined,
  }
}
