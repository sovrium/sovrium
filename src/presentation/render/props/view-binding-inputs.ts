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
 * grid ships every field of the table its reader may read in
 * `tableFields`/`fieldMeta`, and her permission map in `tablePermissions` —
 * each of which can name a column the view withholds (a field grant names its
 * field). So a view-bound grid is told only the view's own columns, and not the
 * permission block: nothing it offers needs it. Whether the grid may write is
 * decided server-side (`canUpdate`, `canCreate`) from the table's grants, as on
 * a table-bound grid; edits go to the table's records, on the view's columns.
 */

import { buttonUrlForReader } from '@/domain/models/app/tables/fields/field-types/advanced/button-url-redaction-service'
import { findViewByKey } from '@/domain/models/app/tables/views/view-read-service'
import type { TypeSpecificResolvedInputs } from './resolve-type-specific-inputs'
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

/** Whether a grid's data source reads through a view — no export and no live refresh then. */
export function isViewBoundSource(dataSource: unknown): boolean {
  return (
    typeof dataSource === 'object' &&
    dataSource !== null &&
    typeof (dataSource as { readonly view?: unknown }).view === 'string'
  )
}

/**
 * One field's meta with its `url` button told only the view's columns: a
 * `$record.<field>` naming a column the view does not serve is taken out, so
 * neither its value nor its name reaches the page; a url left with nothing to
 * open takes the button with it. Every other meta is returned unchanged.
 */
function withViewButtonUrl(meta: unknown, served: (name: string) => boolean): unknown {
  const button = (
    meta as { readonly button?: { readonly action?: unknown; readonly url?: unknown } }
  )?.button
  if (button?.action !== 'url' || typeof button.url !== 'string') return meta
  const url = buttonUrlForReader(button.url, (name) => name !== 'id' && !served(name))
  if (url === button.url) return meta
  const { button: _dropped, ...rest } = meta as Readonly<Record<string, unknown>>
  return url === undefined ? rest : { ...rest, button: { ...button, url } }
}

/**
 * The resolved grid inputs, narrowed to what a view-bound grid may be told:
 * the view's own columns (all of the table's when the view lists none), and
 * no permission block. `maskedFields` is the view's column
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
            Object.entries(inputs.dataTableFieldMeta)
              .filter(([name]) => keep(name))
              .map(([name, meta]) => [name, withViewButtonUrl(meta, keep)])
          ),
    dataTablePermissions: undefined,
  }
}
